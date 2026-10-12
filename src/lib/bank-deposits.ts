import { createHash, randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAdminSettlementData } from "@/lib/admin-page-data";
import { parseDepositNotification } from "@/lib/bank-deposit-parse";
import {
  matchDeposit,
  normalizeDepositorName,
  type DepositCandidate,
} from "@/lib/bank-deposit-match";
import {
  BANK_AUTO_ACTOR,
  billingDateLabel,
  releaseDepositOperations,
  verifyPaymentOperations,
} from "@/lib/payment-verification";

// 여러 폰이 같은 입금 알림을 전달할 수 있으므로 이 시간 안의 같은 문구는 한 건으로 본다.
const DUPLICATE_WINDOW_MS = 3 * 60 * 1000;

type OpenCandidates = {
  readonly candidates: DepositCandidate[];
  readonly dateLabels: ReadonlyMap<number, string>;
};

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

// ── 알림 전달 폰 ────────────────────────────────────────────

export async function registerBankWebhookDevice(label: string): Promise<string> {
  const token = randomBytes(24).toString("base64url");
  await prisma.bankWebhookDevice.create({ data: { label, tokenHash: sha256(token) } });
  return token;
}

export async function revokeBankWebhookDevice(deviceId: number): Promise<void> {
  await prisma.bankWebhookDevice.updateMany({ where: { id: deviceId, revokedAt: null }, data: { revokedAt: new Date() } });
}

/** 유효한 토큰이면 폰의 마지막 수신 시각을 갱신하고 id 를 반환한다. */
export async function authenticateBankWebhookDevice(token: string | null): Promise<number | null> {
  if (!token) return null;
  const device = await prisma.bankWebhookDevice.findUnique({ where: { tokenHash: sha256(token) } });
  if (!device || device.revokedAt) return null;
  await prisma.bankWebhookDevice.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
  return device.id;
}

// ── 대조 대상 ──────────────────────────────────────────────

/** 청구 공개 후 정산이 끝나지 않은 모임의 미확인 청구 */
export async function getOpenDepositCandidates(): Promise<OpenCandidates> {
  const meetings = await prisma.meeting.findMany({
    where: {
      settlementOpen: true,
      settlementCompletedAt: null,
      OR: [{ meetingGroupId: null }, { groupDayIndex: 1 }],
    },
    select: { id: true },
    orderBy: { date: "asc" },
  });

  const candidates: DepositCandidate[] = [];
  const dateLabels = new Map<number, string>();
  for (const { id } of meetings) {
    const data = await getAdminSettlementData(id);
    if (!data) continue;
    const dateLabel = billingDateLabel(data.meeting);
    dateLabels.set(data.meeting.id, dateLabel);
    for (const recipient of data.recipients) {
      if (recipient.totalFee <= 0 || recipient.verified) continue;
      candidates.push({
        meetingId: data.meeting.id,
        meetingLabel: `${dateLabel} ${data.meeting.location}`,
        recipientKakaoId: recipient.recipientKakaoId,
        recipientName: recipient.recipientName,
        totalFee: recipient.totalFee,
      });
    }
  }
  return { candidates, dateLabels };
}

async function getAliasMap(): Promise<Map<string, string>> {
  const aliases = await prisma.depositorAlias.findMany();
  return new Map(aliases.map((alias) => [alias.depositorName, alias.kakaoId]));
}

// ── 입금 연결 ──────────────────────────────────────────────

export class DepositMatchError extends Error {
  readonly name = "DepositMatchError";
}

export async function applyDepositMatch(input: {
  readonly depositId: number;
  readonly targets: readonly Pick<DepositCandidate, "meetingId" | "recipientKakaoId">[];
  readonly actorKakaoId: string;
  readonly rememberDepositorName?: boolean;
  readonly open?: OpenCandidates;
}): Promise<void> {
  const deposit = await prisma.bankDeposit.findUnique({ where: { id: input.depositId } });
  if (!deposit) throw new DepositMatchError("입금 기록을 찾을 수 없습니다.");
  if (deposit.status === "MATCHED") throw new DepositMatchError("이미 확인된 입금입니다.");

  const open = input.open ?? (await getOpenDepositCandidates());
  const targets = input.targets.map((target) => {
    const candidate = open.candidates.find(
      (item) => item.meetingId === target.meetingId && item.recipientKakaoId === target.recipientKakaoId,
    );
    if (!candidate) throw new DepositMatchError("이미 확인됐거나 청구 대상이 아닌 회원입니다.");
    return candidate;
  });
  if (targets.length === 0) throw new DepositMatchError("연결할 청구를 선택해 주세요.");

  const now = new Date();
  const operations: Prisma.PrismaPromise<unknown>[] = targets.flatMap((target) => [
    ...verifyPaymentOperations({
      meetingId: target.meetingId,
      recipientKakaoId: target.recipientKakaoId,
      actorKakaoId: input.actorKakaoId,
      dateLabel: open.dateLabels.get(target.meetingId) ?? "",
      totalFee: target.totalFee,
      verifiedAt: now,
      depositId: deposit.id,
    }),
  ]);
  operations.push(
    prisma.bankDeposit.update({
      where: { id: deposit.id },
      data: { status: "MATCHED", matchedByKakaoId: input.actorKakaoId, matchedAt: now, matchedCount: targets.length },
    }),
  );

  const recipientIds = new Set(targets.map((target) => target.recipientKakaoId));
  if (input.rememberDepositorName && deposit.depositorName && recipientIds.size === 1) {
    const depositorName = normalizeDepositorName(deposit.depositorName);
    const kakaoId = targets[0].recipientKakaoId;
    operations.push(
      prisma.depositorAlias.upsert({
        where: { depositorName },
        create: { depositorName, kakaoId },
        update: { kakaoId },
      }),
    );
  }

  await prisma.$transaction(operations);
}

export async function undoDepositMatch(depositId: number): Promise<void> {
  const deposit = await prisma.bankDeposit.findUnique({ where: { id: depositId }, select: { status: true } });
  if (deposit?.status !== "MATCHED") throw new DepositMatchError("연결된 청구가 없습니다.");
  await prisma.$transaction(await releaseDepositOperations(depositId, "REVIEW"));
}

/**
 * 청구 재공개·조정·회원 삭제 등은 입금 확인 기록을 지운다. 확인 기록이 지워지면 입금과의 연결도 함께 사라지므로,
 * 연결이 확인한 청구 수(matchedCount)보다 적어진 입금은 남은 확인까지 풀고 다시 자동 대조 대상으로 돌린다.
 */
async function releaseStaleMatches(): Promise<void> {
  const matched = await prisma.bankDeposit.findMany({
    where: { status: "MATCHED", matchedCount: { gt: 0 } },
    select: {
      id: true,
      matchedCount: true,
      _count: { select: { confirmations: { where: { verifiedAt: { not: null } } } } },
    },
  });
  const stale = matched.filter((deposit) => deposit._count.confirmations < deposit.matchedCount);
  for (const deposit of stale) {
    await prisma.$transaction(await releaseDepositOperations(deposit.id, "UNMATCHED"));
  }
}

/** 확인 대기 중인 입금을 오래된 순으로 다시 자동 대조한다. 자동 확인된 건수를 반환한다. */
export async function autoMatchPendingDeposits(): Promise<number> {
  await releaseStaleMatches();
  const pending = await prisma.bankDeposit.findMany({
    where: { status: "UNMATCHED", amount: { not: null } },
    orderBy: { depositedAt: "asc" },
  });
  if (pending.length === 0) return 0;

  const aliases = await getAliasMap();
  let open = await getOpenDepositCandidates();
  let matched = 0;
  for (const deposit of pending) {
    const result = matchDeposit({ depositorName: deposit.depositorName, amount: deposit.amount! }, open.candidates, aliases);
    if (result.kind !== "auto") continue;
    try {
      await applyDepositMatch({ depositId: deposit.id, targets: result.targets, actorKakaoId: BANK_AUTO_ACTOR, open });
      matched += 1;
      open = await getOpenDepositCandidates();
    } catch (error) {
      // 동시에 들어온 다른 입금이 먼저 같은 청구를 가져간 경우: 이 입금은 확인 대기로 남긴다.
      if (!(error instanceof DepositMatchError) && !isUniqueViolation(error)) throw error;
    }
  }
  return matched;
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

// ── 알림 수신 ──────────────────────────────────────────────

export type IngestResult = "ignored" | "duplicate" | "unparsed" | "stored";

export async function ingestDepositNotification(input: {
  readonly title: string | null;
  readonly text: string;
  readonly depositedAt: Date;
  readonly deviceId: number | null;
}): Promise<IngestResult> {
  const parsed = parseDepositNotification(input.title, input.text);
  if (parsed.kind === "ignored") return "ignored";

  const rawTitle = input.title;
  const stored = await prisma.$transaction(async (tx) => {
    // 같은 문구를 동시에 받은 요청끼리 순서를 정해 중복 저장을 막는다.
    const lockKey = createHash("sha256").update(`${rawTitle ?? ""}\n${input.text}`).digest().readInt32BE(0);
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(${lockKey})`;
    const duplicate = await tx.bankDeposit.findFirst({
      where: {
        rawTitle,
        rawText: input.text,
        depositedAt: {
          gte: new Date(input.depositedAt.getTime() - DUPLICATE_WINDOW_MS),
          lte: new Date(input.depositedAt.getTime() + DUPLICATE_WINDOW_MS),
        },
      },
      select: { id: true },
    });
    if (duplicate) return false;
    await tx.bankDeposit.create({
      data: {
        rawTitle,
        rawText: input.text,
        depositorName: parsed.kind === "deposit" ? parsed.depositorName : null,
        amount: parsed.kind === "deposit" ? parsed.amount : null,
        depositedAt: input.depositedAt,
        status: parsed.kind === "deposit" ? "UNMATCHED" : "UNPARSED",
        sourceDeviceId: input.deviceId,
      },
    });
    return true;
  });
  if (!stored) return "duplicate";

  if (parsed.kind !== "deposit") return "unparsed";
  await autoMatchPendingDeposits();
  return "stored";
}

// ── 운영진 화면 데이터 ──────────────────────────────────────

export type BankDepositView = {
  readonly id: number;
  readonly depositorName: string | null;
  readonly amount: number | null;
  readonly depositedAt: string;
  readonly status: string;
  readonly matchedAutomatically: boolean;
  readonly rawText: string;
  readonly matches: readonly { meetingLabel: string; recipientName: string }[];
  readonly suggestions: readonly DepositCandidate[];
};

export type BankDepositDashboard = {
  readonly devices: readonly { id: number; label: string; createdAt: string; lastSeenAt: string | null }[];
  readonly unpaidByMeeting: readonly { meetingId: number; meetingLabel: string; recipients: readonly DepositCandidate[] }[];
  readonly needsReview: readonly BankDepositView[];
  readonly matched: readonly BankDepositView[];
  readonly unrecognized: readonly BankDepositView[];
  readonly aliases: readonly { id: number; depositorName: string; memberName: string }[];
};

const RECENT_LIMIT = 50;

export async function getBankDepositDashboard(): Promise<BankDepositDashboard> {
  const [devices, open, aliases, deposits] = await Promise.all([
    prisma.bankWebhookDevice.findMany({ where: { revokedAt: null }, orderBy: { createdAt: "asc" } }),
    getOpenDepositCandidates(),
    prisma.depositorAlias.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.bankDeposit.findMany({
      orderBy: { depositedAt: "desc" },
      take: RECENT_LIMIT,
      include: { confirmations: { select: { meetingId: true, recipientKakaoId: true } } },
    }),
  ]);

  const kakaoIds = new Set([
    ...aliases.map((alias) => alias.kakaoId),
    ...deposits.flatMap((deposit) => deposit.confirmations.map((match) => match.recipientKakaoId)),
  ]);
  const meetingIds = new Set(deposits.flatMap((deposit) => deposit.confirmations.map((match) => match.meetingId)));
  const [users, meetings] = await Promise.all([
    prisma.user.findMany({ where: { kakaoId: { in: [...kakaoIds] } }, select: { kakaoId: true, name: true } }),
    prisma.meeting.findMany({ where: { id: { in: [...meetingIds] } }, select: { id: true, date: true, location: true } }),
  ]);
  const userName = new Map(users.map((user) => [user.kakaoId, user.name ?? "(이름 없음)"]));
  const meetingLabel = new Map(meetings.map((meeting) => [meeting.id, `${meeting.date} ${meeting.location}`]));
  const aliasMap = new Map(aliases.map((alias) => [alias.depositorName, alias.kakaoId]));

  const toView = (deposit: (typeof deposits)[number]): BankDepositView => {
    const reviewable = deposit.status === "UNMATCHED" || deposit.status === "REVIEW";
    return {
      id: deposit.id,
      depositorName: deposit.depositorName,
      amount: deposit.amount,
      depositedAt: deposit.depositedAt.toISOString(),
      status: deposit.status,
      matchedAutomatically: deposit.matchedByKakaoId === BANK_AUTO_ACTOR,
      rawText: [deposit.rawTitle, deposit.rawText].filter(Boolean).join(" / "),
      matches: deposit.confirmations.map((match) => ({
        meetingLabel: meetingLabel.get(match.meetingId) ?? `모임 #${match.meetingId}`,
        recipientName: userName.get(match.recipientKakaoId) ?? match.recipientKakaoId,
      })),
      suggestions: reviewable && deposit.amount !== null
        ? (() => {
            const result = matchDeposit({ depositorName: deposit.depositorName, amount: deposit.amount }, open.candidates, aliasMap);
            return result.kind === "auto" ? result.targets : result.suggestions;
          })()
        : [],
    };
  };

  const unpaid = new Map<number, { meetingId: number; meetingLabel: string; recipients: DepositCandidate[] }>();
  for (const candidate of open.candidates) {
    const entry = unpaid.get(candidate.meetingId) ?? { meetingId: candidate.meetingId, meetingLabel: candidate.meetingLabel, recipients: [] };
    entry.recipients.push(candidate);
    unpaid.set(candidate.meetingId, entry);
  }

  const views = deposits.map(toView);
  return {
    devices: devices.map((device) => ({
      id: device.id,
      label: device.label,
      createdAt: device.createdAt.toISOString(),
      lastSeenAt: device.lastSeenAt?.toISOString() ?? null,
    })),
    unpaidByMeeting: [...unpaid.values()],
    needsReview: views.filter((view) => view.status === "UNMATCHED" || view.status === "REVIEW"),
    matched: views.filter((view) => view.status === "MATCHED"),
    unrecognized: views.filter((view) => view.status === "UNPARSED" || view.status === "IGNORED"),
    aliases: aliases.map((alias) => ({
      id: alias.id,
      depositorName: alias.depositorName,
      memberName: userName.get(alias.kakaoId) ?? alias.kakaoId,
    })),
  };
}

/** 알림이 누락된 입금을 운영진이 직접 기록한다. */
export async function addManualDeposit(depositorName: string, amount: number): Promise<void> {
  const now = new Date();
  await prisma.bankDeposit.create({
    data: {
      rawText: `직접 입력: ${depositorName} ${amount.toLocaleString("ko-KR")}원`,
      depositorName,
      amount,
      depositedAt: now,
      status: "UNMATCHED",
    },
  });
  await autoMatchPendingDeposits();
}
