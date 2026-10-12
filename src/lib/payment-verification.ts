import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { AdminSettlementData } from "@/lib/admin-page-data";

// 입금 확인/취소 DB 작업. 운영진 수동 확인과 은행 알림 자동 대조가 같은 기록을 남기도록 공유한다.
// 호출자가 다른 작업과 한 트랜잭션으로 묶을 수 있도록 PrismaPromise 배열을 반환한다.

export const BANK_AUTO_ACTOR = "bank-auto";

export function billingDateLabel(meeting: Pick<AdminSettlementData["meeting"], "date" | "overnightGroup">): string {
  const days = meeting.overnightGroup?.days;
  return days ? `${days[0].date}~${days[1].date}` : meeting.date;
}

export function verifyPaymentOperations(input: {
  readonly meetingId: number;
  readonly recipientKakaoId: string;
  readonly actorKakaoId: string;
  readonly dateLabel: string;
  readonly totalFee: number;
  readonly verifiedAt?: Date;
  /** 은행 입금으로 확인한 경우 그 입금 */
  readonly depositId?: number | null;
}) {
  const { meetingId, recipientKakaoId, actorKakaoId } = input;
  const verifiedAt = input.verifiedAt ?? new Date();
  const depositId = input.depositId ?? null;
  return [
    prisma.settlementConfirmation.upsert({
      where: { meetingId_recipientKakaoId: { meetingId, recipientKakaoId } },
      create: { meetingId, recipientKakaoId, confirmedAt: verifiedAt, verifiedAt, verifiedByKakaoId: actorKakaoId, depositId },
      update: { verifiedAt, verifiedByKakaoId: actorKakaoId, depositId },
    }),
    ...clearVerifiedNotice(meetingId, recipientKakaoId),
    prisma.userNotification.create({
      data: {
        meetingId,
        recipientKakaoId,
        type: "PAYMENT_VERIFIED",
        title: `${input.dateLabel} 입금이 확인되었습니다`,
        body: `입금 완료 · ${input.totalFee.toLocaleString("ko-KR")}원`,
      },
    }),
  ] as const;
}

function clearVerifiedNotice(meetingId: number, recipientKakaoId: string) {
  return [
    prisma.userNotification.deleteMany({
      where: { meetingId, recipientKakaoId, type: "PAYMENT_VERIFIED" },
    }),
  ] as const;
}

/**
 * 입금 확인을 취소한다. 은행 입금으로 확인한 청구라면 그 입금으로 함께 확인한 청구도 모두 풀고,
 * 입금은 자동 대조가 다시 확인하지 않도록 운영진 확인 대기(REVIEW)로 둔다.
 */
export async function unverifyPaymentOperations(
  meetingId: number,
  recipientKakaoId: string,
): Promise<Prisma.PrismaPromise<unknown>[]> {
  const confirmation = await prisma.settlementConfirmation.findUnique({
    where: { meetingId_recipientKakaoId: { meetingId, recipientKakaoId } },
    select: { depositId: true },
  });
  if (confirmation?.depositId) return releaseDepositOperations(confirmation.depositId, "REVIEW");
  return [
    prisma.settlementConfirmation.updateMany({
      where: { meetingId, recipientKakaoId },
      data: { verifiedAt: null, verifiedByKakaoId: null, depositId: null },
    }),
    ...clearVerifiedNotice(meetingId, recipientKakaoId),
    prisma.meeting.update({
      where: { id: meetingId },
      data: { settlementCompletedAt: null, settlementCompletedByKakaoId: null },
    }),
  ];
}

/** 입금 하나로 확인한 청구를 모두 미확인으로 되돌리고, 입금을 다시 대조 대상(status)으로 둔다. */
export async function releaseDepositOperations(
  depositId: number,
  status: "REVIEW" | "UNMATCHED",
): Promise<Prisma.PrismaPromise<unknown>[]> {
  const linked = await prisma.settlementConfirmation.findMany({
    where: { depositId },
    select: { meetingId: true, recipientKakaoId: true },
  });
  return [
    prisma.settlementConfirmation.updateMany({
      where: { depositId },
      data: { verifiedAt: null, verifiedByKakaoId: null, depositId: null },
    }),
    ...linked.flatMap((row) => [
      ...clearVerifiedNotice(row.meetingId, row.recipientKakaoId),
      prisma.meeting.updateMany({
        where: { id: row.meetingId },
        data: { settlementCompletedAt: null, settlementCompletedByKakaoId: null },
      }),
    ]),
    prisma.bankDeposit.update({
      where: { id: depositId },
      data: { status, matchedByKakaoId: null, matchedAt: null, matchedCount: 0 },
    }),
  ];
}
