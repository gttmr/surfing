import { prisma } from "@/lib/db";
import { getFoodOrderSupportCap } from "@/lib/food-ordering-data";
import { type FoodOrderItemSnapshot } from "@/lib/food-ordering";
import { getPricingConfig, groupParticipantsForSettlement } from "@/lib/pricing";
import { getConfirmedSurfUsageBillingByParticipant } from "@/lib/surf-usage-data";
import {
  isMeetingBillingSnapshotPayload,
  type MeetingBillingSnapshotPayload,
} from "@/lib/billing-snapshot";
import type { OvernightMeetingGroupSummary } from "@/lib/meeting-group";
import {
  SETTLEMENT_ACCOUNT_HOLDER_KEY,
  SETTLEMENT_ACCOUNT_NUMBER_KEY,
  SETTLEMENT_BANK_NAME_KEY,
} from "@/lib/settings";

export type MemberPaymentStatus = "NO_PAYMENT_REQUIRED" | "PAYMENT_REQUIRED" | "REPORTED" | "VERIFIED";

export type SettlementMeetingGroup = {
  meeting: {
    id: number;
    date: string;
    startTime: string;
    endTime: string;
    location: string;
    settlementOpen: boolean;
    overnightGroup: OvernightMeetingGroupSummary | null;
  };
  group: ReturnType<typeof groupParticipantsForSettlement>[number];
  paymentStatus: MemberPaymentStatus;
  isReported: boolean;
  reportedAt: string | null;
  isVerified: boolean;
  verifiedAt: string | null;
  settlementAccount: {
    bankName: string;
    accountNumber: string;
    accountHolder: string;
  };
  publicationRevision: number | null;
  /** @deprecated Use isVerified. */
  isCompleted: boolean;
  /** @deprecated Use verifiedAt. */
  completedAt: string | null;
};

type SnapshotMeetingGroup = {
  meeting: SettlementMeetingGroup["meeting"];
  group: SettlementMeetingGroup["group"];
  settlementAccount: SettlementMeetingGroup["settlementAccount"];
  publicationRevision: number;
};

function paymentState(confirmation: {
  confirmedAt: Date;
  verifiedAt: Date | null;
} | null, totalFee: number) {
  if (totalFee === 0) {
    return {
      paymentStatus: "NO_PAYMENT_REQUIRED" as const,
      isReported: false,
      reportedAt: null,
      isVerified: false,
      verifiedAt: null,
      isCompleted: true,
      completedAt: null,
    };
  }
  const reportedAt = confirmation?.confirmedAt.toISOString() ?? null;
  const verifiedAt = confirmation?.verifiedAt?.toISOString() ?? null;
  const paymentStatus: MemberPaymentStatus = verifiedAt
    ? "VERIFIED"
    : reportedAt
      ? "REPORTED"
      : "PAYMENT_REQUIRED";

  return {
    paymentStatus,
    isReported: reportedAt !== null,
    reportedAt,
    isVerified: verifiedAt !== null,
    verifiedAt,
    isCompleted: verifiedAt !== null,
    completedAt: verifiedAt,
  };
}

function recipientFromSnapshot(
  data: unknown,
  recipientKakaoId: string
): MeetingBillingSnapshotPayload["recipients"][number] | null {
  if (!isMeetingBillingSnapshotPayload(data)) return null;
  return data.recipients.find((recipient) => recipient.recipientKakaoId === recipientKakaoId) ?? null;
}

export async function getSettlementGroupsForKakaoId(kakaoId: string) {
  const [pricing, foodSupportCap, participants, snapshots, accountSettings] = await Promise.all([
    getPricingConfig(),
    getFoodOrderSupportCap(),
    prisma.participant.findMany({
    where: {
      status: "APPROVED",
      meeting: {
        settlementOpen: true,
        OR: [
          { meetingGroupId: null },
          { groupDayIndex: 1 },
        ],
      },
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
    prisma.meetingBillingSnapshot.findMany({
      where: {
        meeting: {
          settlementOpen: true,
          OR: [
            { meetingGroupId: null },
            { groupDayIndex: 1 },
          ],
        },
      },
      orderBy: { publishedAt: "desc" },
      include: {
        meeting: {
          select: {
            id: true,
            date: true,
            startTime: true,
            endTime: true,
            location: true,
            settlementOpen: true,
          },
        },
      },
    }),
    prisma.setting.findMany({
      where: {
        key: {
          in: [SETTLEMENT_BANK_NAME_KEY, SETTLEMENT_ACCOUNT_NUMBER_KEY, SETTLEMENT_ACCOUNT_HOLDER_KEY],
        },
      },
    }),
  ]);
  const accountSettingsMap = new Map(accountSettings.map((setting) => [setting.key, setting.value]));
  const legacyAccount = {
    bankName: accountSettingsMap.get(SETTLEMENT_BANK_NAME_KEY) ?? "",
    accountNumber: accountSettingsMap.get(SETTLEMENT_ACCOUNT_NUMBER_KEY) ?? "",
    accountHolder: accountSettingsMap.get(SETTLEMENT_ACCOUNT_HOLDER_KEY) ?? "",
  };

  const snapshotMeetingIds = new Set(snapshots.map((snapshot) => snapshot.meetingId));
  const snapshotGroups: SnapshotMeetingGroup[] = snapshots.flatMap((snapshot) => {
    if (!isMeetingBillingSnapshotPayload(snapshot.data)) return [];
    const payload = snapshot.data;
    const recipient = recipientFromSnapshot(payload, kakaoId);
    if (!recipient) return [];
    return [{
      meeting: {
        ...snapshot.meeting,
        overnightGroup: payload.version === 2 ? payload.overnightGroup : null,
      },
      group: recipient,
      settlementAccount: {
        bankName: snapshot.accountBankName ?? "",
        accountNumber: snapshot.accountNumber ?? "",
        accountHolder: snapshot.accountHolder ?? "",
      },
      publicationRevision: snapshot.revision,
    }];
  });

  const meetingsMap = new Map<number, typeof participants>();
  for (const participant of participants) {
    if (snapshotMeetingIds.has(participant.meetingId)) continue;
    const list = meetingsMap.get(participant.meetingId) ?? [];
    list.push(participant);
    meetingsMap.set(participant.meetingId, list);
  }

  const visibleMeetingIds = [
    ...snapshotGroups.map((item) => item.meeting.id),
    ...meetingsMap.keys(),
  ];
  if (visibleMeetingIds.length === 0) return [];

  const confirmations = await prisma.settlementConfirmation.findMany({
    where: {
      recipientKakaoId: kakaoId,
      meetingId: { in: visibleMeetingIds },
    },
  });
  const confirmationMap = new Map(confirmations.map((item) => [item.meetingId, item]));
  const surfUsageBillingEntries = await Promise.all(
    Array.from(meetingsMap.keys()).map(async (meetingId) => [
      meetingId,
      await getConfirmedSurfUsageBillingByParticipant(meetingId),
    ] as const)
  );
  const surfUsageBillingByMeeting = new Map(surfUsageBillingEntries);

  const legacyGroups = Array.from(meetingsMap.values())
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
            menuOptionChoiceId: item.menuOptionChoiceId,
            menuNameSnapshot: item.menuNameSnapshot,
            optionGroupNameSnapshot: item.optionGroupNameSnapshot,
            optionChoiceLabelSnapshot: item.optionChoiceLabelSnapshot,
            unitPriceSnapshot: item.unitPriceSnapshot,
            quantity: item.quantity,
            preparingQuantity: item.preparingQuantity,
            servedQuantity: item.servedQuantity,
            cancelledAt: item.cancelledAt?.toISOString() ?? null,
            cancelledReasonCode: item.cancelledReasonCode,
            cancelledReasonText: item.cancelledReasonText,
          })),
        ])
      );

      const surfUsageBilling = surfUsageBillingByMeeting.get(meeting.id);
      const recipients = groupParticipantsForSettlement(
        meetingParticipants,
        pricing,
        adjustmentMap,
        foodOrderMap,
        foodSupportCap,
        surfUsageBilling?.billingMap ?? new Map(),
        surfUsageBilling?.confirmedParticipantIds ?? new Set()
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
          overnightGroup: null,
        },
        group: myGroup,
        ...paymentState(confirmationMap.get(meeting.id) ?? null, myGroup.totalFee),
        settlementAccount: legacyAccount,
        publicationRevision: null,
      } satisfies SettlementMeetingGroup;
    })
    .filter(Boolean) as SettlementMeetingGroup[];

  const publishedGroups: SettlementMeetingGroup[] = snapshotGroups.map((item) => ({
    ...item,
    ...paymentState(confirmationMap.get(item.meeting.id) ?? null, item.group.totalFee),
  }));

  return [...publishedGroups, ...legacyGroups]
    .sort((a, b) => b.meeting.date.localeCompare(a.meeting.date));
}
