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
}) {
  const { meetingId, recipientKakaoId, actorKakaoId } = input;
  const verifiedAt = input.verifiedAt ?? new Date();
  return [
    prisma.settlementConfirmation.upsert({
      where: { meetingId_recipientKakaoId: { meetingId, recipientKakaoId } },
      create: { meetingId, recipientKakaoId, confirmedAt: verifiedAt, verifiedAt, verifiedByKakaoId: actorKakaoId },
      update: { verifiedAt, verifiedByKakaoId: actorKakaoId },
    }),
    prisma.userNotification.deleteMany({
      where: { meetingId, recipientKakaoId, type: "PAYMENT_VERIFIED" },
    }),
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

export function unverifyPaymentOperations(meetingId: number, recipientKakaoId: string) {
  return [
    prisma.settlementConfirmation.updateMany({
      where: { meetingId, recipientKakaoId },
      data: { verifiedAt: null, verifiedByKakaoId: null },
    }),
    prisma.userNotification.deleteMany({
      where: { meetingId, recipientKakaoId, type: "PAYMENT_VERIFIED" },
    }),
    prisma.meeting.update({
      where: { id: meetingId },
      data: { settlementCompletedAt: null, settlementCompletedByKakaoId: null },
    }),
    // 은행 입금과 연결돼 있었다면 연결을 풀고, 자동 대조가 다시 확인하지 않도록 운영진 확인 대기로 둔다.
    prisma.bankDeposit.updateMany({
      where: { matches: { some: { meetingId, recipientKakaoId } } },
      data: { status: "REVIEW", matchedByKakaoId: null, matchedAt: null },
    }),
    prisma.bankDepositMatch.deleteMany({ where: { meetingId, recipientKakaoId } }),
  ] as const;
}
