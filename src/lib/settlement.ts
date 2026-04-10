import { prisma } from "@/lib/db";
import { getFoodOrderSupportCap } from "@/lib/food-ordering-data";
import { type FoodOrderItemSnapshot } from "@/lib/food-ordering";
import { getPricingConfig, groupParticipantsForSettlement } from "@/lib/pricing";

export type SettlementMeetingGroup = {
  meeting: {
    id: number;
    date: string;
    startTime: string;
    endTime: string;
    location: string;
    settlementOpen: boolean;
  };
  group: ReturnType<typeof groupParticipantsForSettlement>[number];
  isCompleted: boolean;
  completedAt: string | null;
};

export async function getSettlementGroupsForKakaoId(kakaoId: string) {
  const [pricing, foodSupportCap, participants] = await Promise.all([
    getPricingConfig(),
    getFoodOrderSupportCap(),
    prisma.participant.findMany({
    where: {
      status: "APPROVED",
      meeting: { settlementOpen: true },
      OR: [
        { kakaoId, companionId: null },
        { companion: { linkedKakaoId: kakaoId } },
        { companion: { ownerKakaoId: kakaoId, linkedKakaoId: null } },
      ],
    },
    orderBy: [{ meeting: { date: "desc" } }, { submittedAt: "asc" }],
    include: {
      meeting: true,
      user: {
        select: {
          memberType: true,
          name: true,
        },
      },
      companion: {
        include: {
          owner: {
            select: {
              kakaoId: true,
              name: true,
            },
          },
        },
      },
      chargeAdjustments: {
        orderBy: { createdAt: "asc" },
      },
      foodOrderItems: {
        orderBy: { createdAt: "asc" },
      },
    },
    }),
  ]);

  if (!participants.length) return [];

  const meetingsMap = new Map<number, typeof participants>();
  for (const participant of participants) {
    const list = meetingsMap.get(participant.meetingId) ?? [];
    list.push(participant);
    meetingsMap.set(participant.meetingId, list);
  }

  const confirmations = await prisma.settlementConfirmation.findMany({
    where: {
      recipientKakaoId: kakaoId,
      meetingId: { in: Array.from(meetingsMap.keys()) },
    },
  });
  const completionMap = new Map(
    confirmations.map((item) => [item.meetingId, item.confirmedAt.toISOString()])
  );

  return Array.from(meetingsMap.values())
    .map((meetingParticipants) => {
      const meeting = meetingParticipants[0].meeting;
      const adjustmentMap = new Map(
        meetingParticipants.map((participant) => [
          participant.id,
          participant.chargeAdjustments.map((adjustment) => ({
            id: adjustment.id,
            label: adjustment.label,
            amount: adjustment.amount,
          })),
        ])
      );

      const foodOrderMap = new Map<number, FoodOrderItemSnapshot[]>(
        meetingParticipants.map((participant) => [
          participant.id,
          participant.foodOrderItems.map((item) => ({
            id: item.id,
            participantId: item.participantId,
            menuItemId: item.menuItemId,
            menuNameSnapshot: item.menuNameSnapshot,
            unitPriceSnapshot: item.unitPriceSnapshot,
            quantity: item.quantity,
            preparingQuantity: item.preparingQuantity,
            servedQuantity: item.servedQuantity,
          })),
        ])
      );

      const recipients = groupParticipantsForSettlement(
        meetingParticipants,
        pricing,
        adjustmentMap,
        foodOrderMap,
        foodSupportCap
      );
      const myGroup = recipients.find((recipient) => recipient.recipientKakaoId === kakaoId);
      if (!myGroup) return null;

      return {
        meeting: {
          id: meeting.id,
          date: meeting.date,
          startTime: meeting.startTime,
          endTime: meeting.endTime,
          location: meeting.location,
          settlementOpen: meeting.settlementOpen,
        },
        group: myGroup,
        isCompleted: completionMap.has(meeting.id),
        completedAt: completionMap.get(meeting.id) ?? null,
      } satisfies SettlementMeetingGroup;
    })
    .filter(Boolean) as SettlementMeetingGroup[];
}
