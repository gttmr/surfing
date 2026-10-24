import { prisma } from "@/lib/db";
import { getTodayInSeoul } from "@/lib/date";
import { getActualUsageReviewAvailability } from "@/lib/meeting-lifecycle";

export type PendingShopCountCheck = {
  readonly meetingId: number;
  readonly date: string;
  readonly location: string;
};

/**
 * 샵이 장비 수량을 아직 확인하지 않은 모임.
 * 모임이 끝났고, 청구 검토 전이며, 확정된 이용 기록이 하나라도 있는 날만 대상이다.
 */
export async function getPendingShopCountChecks(now = new Date()): Promise<PendingShopCountCheck[]> {
  const meetings = await prisma.meeting.findMany({
    where: {
      OR: [{ date: { lte: getTodayInSeoul(now) } }, { endedAt: { not: null } }],
      shopUsageCheckedAt: null,
      billingPublishedAt: null,
      participants: { some: { usageConfirmedAt: { not: null } } },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    select: { id: true, date: true, endDate: true, endTime: true, endedAt: true, location: true },
  });

  return meetings
    .filter((meeting) => getActualUsageReviewAvailability({ ...meeting, now }).state === "OPEN")
    .map((meeting) => ({ meetingId: meeting.id, date: meeting.date, location: meeting.location }));
}
