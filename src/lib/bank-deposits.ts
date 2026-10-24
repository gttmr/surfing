import { createHash, randomBytes } from "crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getAdminSettlementData } from "@/lib/admin-page-data";
import { parseDepositNotification } from "@/lib/bank-deposit-parse";
import {
  matchDeposit,
  normalizeDepositorName,
  planDepositAllocation,
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
      billingPublishedAt: { not: null },
      settlementCompletedAt: null,
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
      const paidParticipants = new Set(recipient.paidParticipantIds);
      candidates.push({
        meetingId: data.meeting.id,
        meetingLabel: `${dateLabel} ${data.meeting.location}`,
        recipientKakaoId: recipient.recipientKakaoId,
        recipientName: recipient.recipientName,
        totalFee: recipient.totalFee,
        paidAmount: recipient.paidAmount,
        // 혼자 내는 청구는 몫을 나눌 필요가 없다.
        parts: recipient.items.length > 1
          ? recipient.items.map((item) => ({
              participantId: item.participantId,
              name: item.participantName,
              amount: item.totalFee,
              paid: paidParticipants.has(item.participantId),
            }))
          : [],
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
  /** 동반인 등 한 사람 몫만 들어온 경우 그 참가자 */
  readonly participantId?: number;
  /** 남은 금액보다 많이 들어온 입금을 운영진이 알고 확인한 경우 */
  readonly allowOverpayment?: boolean;
  readonly open?: OpenCandidates;
}): Promise<void> {
  const deposit = await prisma.bankDeposit.findUnique({ where: { id: input.depositId } });
  if (!deposit) throw new DepositMatchError("입금 기록을 찾을 수 없습니다.");
  if (deposit.status === "MATCHED") throw new DepositMatchError("이미 확인된 입금입니다.");
  if (deposit.amount === null) throw new DepositMatchError("금액을 읽지 못한 입금은 연결할 수 없습니다.");

  const open = input.open ?? (await getOpenDepositCandidates());
  const targets = input.targets.map((target) => {
    const candidate = open.candidates.find(
      (item) => item.meetingId === target.meetingId && item.recipientKakaoId === target.recipientKakaoId,
    );
    if (!candidate) throw new DepositMatchError("이미 확인됐거나 청구 대상이 아닌 회원입니다.");
    return candidate;
  });

  const plan = planDepositAllocation(deposit.amount, targets);
  if (plan.kind === "error") throw new DepositMatchError(plan.message);
  if (plan.overpaid > 0 && !input.allowOverpayment) {
    throw new DepositMatchError(`남은 청구 금액보다 ${plan.overpaid.toLocaleString("ko-KR")}원 많이 들어왔습니다. 확인 후 다시 연결해 주세요.`);
  }

  const now = new Date();
  const participantId = targets.length === 1 ? input.participantId ?? null : null;
  const operations: Prisma.PrismaPromise<unknown>[] = plan.allocations.map((allocation) =>
    prisma.bankDepositPayment.create({
      data: {
        depositId: deposit.id,
        meetingId: allocation.meetingId,
        recipientKakaoId: allocation.recipientKakaoId,
        amount: allocation.amount,
        billTotal: allocation.billTotal,
        participantId,
      },
    }),
  );
  const settled = targets.filter((_, index) => plan.allocations[index].settles);
  for (const target of settled) {
    operations.push(
      ...verifyPaymentOperations({
        meetingId: target.meetingId,
        recipientKakaoId: target.recipientKakaoId,
        actorKakaoId: input.actorKakaoId,
        dateLabel: open.dateLabels.get(target.meetingId) ?? "",
        totalFee: target.totalFee,
        verifiedAt: now,
        depositId: deposit.id,
      }),
    );
  }
  operations.push(
    prisma.bankDeposit.update({
      where: { id: deposit.id },
      data: { status: "MATCHED", matchedByKakaoId: input.actorKakaoId, matchedAt: now, matchedCount: settled.length },
    }),
  );

  // 동반인 몫 입금은 그 사람 이름이므로 정회원 입금자명으로 기억하지 않는다.
  const recipientIds = new Set(targets.map((target) => target.recipientKakaoId));
  // 입금자명이 회원 이름과 같으면 기억할 필요가 없다.
  const depositorName = deposit.depositorName ? normalizeDepositorName(deposit.depositorName) : null;
  if (
    input.rememberDepositorName
    && depositorName
    && recipientIds.size === 1
    && participantId === null
    && depositorName !== normalizeDepositorName(targets[0].recipientName)
  ) {
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
 * 청구 재공개·조정·회원 삭제 등으로 청구 금액이 바뀌거나 청구가 사라지면, 그 청구에 들어간 입금의 연결을 풀고
 * 다시 자동 대조 대상으로 돌린다. 금액이 그대로인데 확인 기록만 지워진 청구는 받은 돈이 충분하면 다시 확인한다.
 */
async function reconcileDepositPayments(open: OpenCandidates): Promise<boolean> {
  const [payments, verified] = await Promise.all([
    prisma.bankDepositPayment.findMany({
      where: { deposit: { status: "MATCHED" } },
      select: { depositId: true, meetingId: true, recipientKakaoId: true, billTotal: true },
      orderBy: { id: "asc" },
    }),
    prisma.settlementConfirmation.findMany({
      where: { verifiedAt: { not: null } },
      select: { meetingId: true, recipientKakaoId: true },
    }),
  ]);
  const key = (bill: { meetingId: number; recipientKakaoId: string }) => `${bill.meetingId}:${bill.recipientKakaoId}`;
  const verifiedBills = new Set(verified.map(key));
  const openBills = new Map(open.candidates.map((candidate) => [key(candidate), candidate]));

  const stale = new Set(
    payments
      .filter((payment) => !verifiedBills.has(key(payment)) && openBills.get(key(payment))?.totalFee !== payment.billTotal)
      .map((payment) => payment.depositId),
  );
  for (const depositId of stale) {
    await prisma.$transaction(await releaseDepositOperations(depositId, "UNMATCHED"));
  }

  let changed = stale.size > 0;
  if (!changed) {
    for (const candidate of open.candidates) {
      if (candidate.paidAmount < candidate.totalFee) continue;
      const lastPayment = payments.filter((payment) => key(payment) === key(candidate)).at(-1);
      await prisma.$transaction([
        ...verifyPaymentOperations({
          meetingId: candidate.meetingId,
          recipientKakaoId: candidate.recipientKakaoId,
          actorKakaoId: BANK_AUTO_ACTOR,
          dateLabel: open.dateLabels.get(candidate.meetingId) ?? "",
          totalFee: candidate.totalFee,
          depositId: lastPayment?.depositId ?? null,
        }),
      ]);
      changed = true;
    }
  }
  return changed;
}

/** 확인 대기 중인 입금을 오래된 순으로 다시 자동 대조한다. 자동 확인된 건수를 반환한다. */
export async function autoMatchPendingDeposits(): Promise<number> {
  if (await reconcileDepositPayments(await getOpenDepositCandidates())) {
    // 연결을 푼 뒤 남은 일부 입금으로 다 받은 청구가 생길 수 있어 한 번 더 맞춘다.
    await reconcileDepositPayments(await getOpenDepositCandidates());
  }
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
      await applyDepositMatch({
        depositId: deposit.id,
        targets: result.targets,
        participantId: result.participantId,
        actorKakaoId: BANK_AUTO_ACTOR,
        open,
      });
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
  readonly matches: readonly {
    meetingLabel: string;
    recipientName: string;
    /** 이 입금 중 이 청구에 들어간 금액 */
    amount: number;
    /** 청구 기준 남은 금액(+) 또는 더 받은 금액(-). 마지막으로 연결한 입금에만 있고, 나머지는 0 */
    balance: number;
  }[];
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
      include: { payments: { select: { id: true, meetingId: true, recipientKakaoId: true, amount: true, billTotal: true } } },
    }),
  ]);
  const billKey = (bill: { meetingId: number; recipientKakaoId: string }) => `${bill.meetingId}:${bill.recipientKakaoId}`;
  const paidBills = deposits.flatMap((deposit) => deposit.payments);
  const billPayments = await prisma.bankDepositPayment.findMany({
    where: { OR: paidBills.map((bill) => ({ meetingId: bill.meetingId, recipientKakaoId: bill.recipientKakaoId })) },
    select: { id: true, meetingId: true, recipientKakaoId: true, amount: true },
  });
  const billPaid = new Map<string, number>();
  // 남은·더 받은 금액은 그 청구에 마지막으로 연결한 입금에만 붙인다. 먼저 들어온 동반인 입금에는 책임이 없다.
  const lastPaymentId = new Map<string, number>();
  for (const payment of paidBills.length > 0 ? billPayments : []) {
    billPaid.set(billKey(payment), (billPaid.get(billKey(payment)) ?? 0) + payment.amount);
    lastPaymentId.set(billKey(payment), Math.max(lastPaymentId.get(billKey(payment)) ?? 0, payment.id));
  }

  const kakaoIds = new Set([
    ...aliases.map((alias) => alias.kakaoId),
    ...paidBills.map((match) => match.recipientKakaoId),
  ]);
  const meetingIds = new Set(paidBills.map((match) => match.meetingId));
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
      matches: deposit.payments.map((match) => ({
        meetingLabel: meetingLabel.get(match.meetingId) ?? `모임 #${match.meetingId}`,
        recipientName: userName.get(match.recipientKakaoId) ?? match.recipientKakaoId,
        amount: match.amount,
        balance: lastPaymentId.get(billKey(match)) === match.id ? match.billTotal - (billPaid.get(billKey(match)) ?? 0) : 0,
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
