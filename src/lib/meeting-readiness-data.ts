import { prisma } from "@/lib/db";
import { getBillingReadiness } from "@/lib/meeting-lifecycle";

export async function getMeetingBillingReadiness(meetingId: number, now = new Date()) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: {
      id: true,
      date: true,
      endTime: true,
      isOpen: true,
      billingReviewConfirmedAt: true,
      participants: {
        select: {
          id: true,
          status: true,
          attendanceStatus: true,
        },
      },
      foodOrderItems: {
        select: {
          quantity: true,
          servedQuantity: true,
          cancelledAt: true,
        },
      },
      surfUsageSubmissions: {
        select: {
          participantId: true,
          status: true,
          confirmedAt: true,
        },
      },
    },
  });

  if (!meeting) return null;

  return getBillingReadiness({
    now,
    meeting,
    participants: meeting.participants,
    foodOrderItems: meeting.foodOrderItems,
    usageSubmissions: meeting.surfUsageSubmissions,
  });
}

export async function getMeetingGroupBillingReadiness(meetingIds: readonly number[], now = new Date()) {
  const dailyReadiness = await Promise.all(
    meetingIds.map((meetingId) => getMeetingBillingReadiness(meetingId, now))
  );
  if (dailyReadiness.some((readiness) => readiness === null)) return null;
  const resolved = dailyReadiness.filter((readiness): readiness is NonNullable<typeof readiness> => readiness !== null);
  const checkIds = resolved[0]?.checks.map((check) => check.id) ?? [];
  const checks = checkIds.map((checkId) => {
    const dailyChecks = resolved.map((readiness, index) => ({
      dayIndex: index + 1,
      check: readiness.checks.find((item) => item.id === checkId)!,
    }));
    const incomplete = dailyChecks.filter((item) => !item.check.complete);
    return {
      id: checkId,
      label: dailyChecks[0].check.label,
      complete: incomplete.length === 0,
      detail: incomplete.length === 0
        ? `1일차와 2일차 ${dailyChecks[0].check.label}을 모두 확인했습니다.`
        : incomplete.map((item) => `${item.dayIndex}일차: ${item.check.detail}`).join(" "),
      href: incomplete[0]?.check.href ?? dailyChecks[0].check.href,
    };
  });

  return {
    ready: checks.every((check) => check.complete),
    checks,
  };
}
