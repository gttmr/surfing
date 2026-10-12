import { prisma } from "@/lib/db";
import { getBillingReadiness } from "@/lib/meeting-lifecycle";

export async function getMeetingBillingReadiness(meetingId: number, now = new Date()) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: {
      id: true,
      date: true,
      endDate: true,
      endTime: true,
      shopUsageCheckedAt: true,
      participants: {
        select: {
          id: true,
          status: true,
          absentAt: true,
          usageConfirmedAt: true,
        },
      },
      foodOrderItems: {
        select: {
          quantity: true,
          servedQuantity: true,
          cancelledAt: true,
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
  });
}
