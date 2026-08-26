import { prisma } from "@/lib/db";
import { withResolvedProfileImage } from "@/lib/profile-image";
import { resolveProfileImage } from "@/lib/profile-image";
import {
  getParticipantChargeBreakdown,
  getSettlementPricingBundle,
  groupOvernightParticipantsForSettlement,
  groupParticipantsForSettlement,
  type SettlementRecipientGroup,
} from "@/lib/pricing";
import { DEFAULT_PENALTY_MESSAGE } from "@/lib/penalty";
import { getConfirmedSurfUsageBillingByParticipant } from "@/lib/surf-usage-data";
import { isMeetingBillingSnapshotPayload } from "@/lib/billing-snapshot";
import { getMeetingBillingReadiness, getMeetingGroupBillingReadiness } from "@/lib/meeting-readiness-data";
import {
  getMeetingWorkflowStage,
  MEETING_WORKFLOW_LABELS,
  type MeetingWorkflowStage,
} from "@/lib/meeting-lifecycle";
import type { AdminSettlementStatusSummary } from "@/lib/landing-types";
import { toOvernightMeetingGroupSummary, type OvernightMeetingGroupSummary } from "@/lib/meeting-group";
import {
  CANCELLATION_PENALTY_DAYS_KEY,
  CANCELLATION_PENALTY_MESSAGE_KEY,
  DEFAULT_CANCELLATION_PENALTY_DAYS,
  DEFAULT_FOOD_ORDER_SUPPORT_CAP,
  DEFAULT_PARTICIPANT_OPTION_PRICING_GUIDE,
  DEFAULT_PRICING_SETTINGS,
  DEFAULT_SETTLEMENT_ACCOUNT_HOLDER,
  DEFAULT_SETTLEMENT_ACCOUNT_NUMBER,
  DEFAULT_SETTLEMENT_BANK_NAME,
  FOOD_ORDER_SUPPORT_CAP_KEY,
  PARTICIPANT_OPTION_PRICING_GUIDE_KEY,
  PRICING_SETTING_KEYS,
  SETTLEMENT_ACCOUNT_HOLDER_KEY,
  SETTLEMENT_ACCOUNT_NUMBER_KEY,
  SETTLEMENT_BANK_NAME_KEY,
  type PricingSettingKey,
} from "@/lib/settings";

export type AdminNoticeItem = {
  id: number;
  title: string;
  body: string;
  isPinned: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminMessageSettings = Record<string, string | undefined> & {
  [CANCELLATION_PENALTY_MESSAGE_KEY]?: string;
  [CANCELLATION_PENALTY_DAYS_KEY]?: string;
  [PARTICIPANT_OPTION_PRICING_GUIDE_KEY]?: string;
  [SETTLEMENT_BANK_NAME_KEY]?: string;
  [SETTLEMENT_ACCOUNT_NUMBER_KEY]?: string;
  [SETTLEMENT_ACCOUNT_HOLDER_KEY]?: string;
};

export type AdminMemberListItem = {
  id: number;
  kakaoId: string;
  name: string | null;
  profileImage: string | null;
  phoneNumber: string | null;
  role: string;
  memberType: string;
  penaltyCount: number;
  createdAt: string;
  _count: {
    participants: number;
  };
};

export type AdminMeetingListItem = {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  meetingType: string;
  isOpen: boolean;
  approvedCount: number;
  createdByKakaoId: string | null;
  overnightGroup: OvernightMeetingGroupSummary | null;
  workflowStage: MeetingWorkflowStage;
  workflowLabel: string;
  nextAction: string;
};

export type AdminSettingsFormData = {
  penaltyMessage: string;
  penaltyDays: string;
  participantOptionPricingGuide: string;
  settlementBankName: string;
  settlementAccountNumber: string;
  settlementAccountHolder: string;
};

export type AdminPricingState = Record<PricingSettingKey, string> & {
  foodOrderSupportCap: string;
};

export type AdminMeetingParticipant = {
  id: number;
  name: string;
  kakaoId: string;
  kakaoNickname: string;
  profileImage: string | null;
  note: string | null;
  hasLesson: boolean;
  hasBus: boolean;
  hasRental: boolean;
  usesClubLodging: boolean;
  status: string;
  attendanceStatus: string;
  waitlistPosition: number | null;
  isPenalized: boolean;
  cancelledAt: string | null;
  submittedAt: string;
  companionId: number | null;
};

export type AdminMeetingDetail = {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string | null;
  isOpen: boolean;
  meetingType: string;
  overnightGroup: OvernightMeetingGroupSummary | null;
  participants: AdminMeetingParticipant[];
  approvedCount: number;
};

export type AdminSettlementParticipant = {
  id: number;
  name: string;
  kakaoId: string;
  companionId: number | null;
  hasLesson: boolean;
  hasBus: boolean;
  hasRental: boolean;
  usesClubLodging: boolean;
  adjustments: { id: number; label: string; amount: number }[];
  foodOrders: {
    id: number;
    menuNameSnapshot: string;
    optionChoiceLabelSnapshot: string | null;
    unitPriceSnapshot: number;
    quantity: number;
    preparingQuantity: number;
    servedQuantity: number;
    cancelledAt?: string | null;
    cancelledReasonCode?: string | null;
    cancelledReasonText?: string | null;
  }[];
  surfUsageLines: {
    id: number;
    usageItemId: number;
    usageItemName: string;
    serviceType: string;
    quantity: number;
    shopUnitPrice: number;
    memberBillingPolicy: string;
    regularMemberUnitPrice: number;
  }[];
  breakdown: {
    baseFee: number;
    lodgingFee: number;
    lessonFee: number;
    rentalFee: number;
    surfUsageShopFee: number;
    surfUsageMemberFee: number;
    surfUsageCoveredFee: number;
    adjustmentFee: number;
    foodSubtotal: number;
    foodSupportApplied: number;
    foodCharge: number;
    totalFee: number;
  };
  dailyBreakdowns?: NonNullable<SettlementRecipientGroup["items"][number]["dailyBreakdowns"]>;
};

export type AdminSettlementRecipient = SettlementRecipientGroup & {
  reported: boolean;
  reportedAt: string | null;
  verified: boolean;
  verifiedAt: string | null;
  /** @deprecated Use verified. Kept while legacy UI migrates. */
  completed: boolean;
  /** @deprecated Use verifiedAt. Kept while legacy UI migrates. */
  completedAt: string | null;
};

export type AdminSettlementData = {
  meeting: {
    id: number;
    date: string;
    startTime: string;
    endTime: string;
    location: string;
    isOpen: boolean;
    settlementOpen: boolean;
    overnightGroup: OvernightMeetingGroupSummary | null;
  };
  participants: AdminSettlementParticipant[];
  surfUsageSummary: {
    shopChargeAmount: number;
    memberChargeAmount: number;
    operationsCoveredAmount: number;
  };
  reportedRecipientCount: number;
  verifiedRecipientCount: number;
  /** @deprecated Use verifiedRecipientCount. */
  confirmedRecipientCount: number;
  recipients: AdminSettlementRecipient[];
  readiness: NonNullable<Awaited<ReturnType<typeof getMeetingBillingReadiness>>>;
  workflowStage: MeetingWorkflowStage;
  workflowLabel: string;
  billing: {
    revision: number | null;
    publishedAt: string | null;
    correctionReason: string | null;
    account: {
      bankName: string;
      accountNumber: string;
      accountHolder: string;
    };
    totals: {
      memberChargeTotal: number;
      shopPayableTotal: number;
      foodPayableTotal: number;
      clubSupportTotal: number;
    };
    shopPayout: { paidAt: string | null; amount: number | null };
    foodPayout: { paidAt: string | null; amount: number | null };
    settlementCompletedAt: string | null;
    settlementNote: string | null;
  };
};

export async function getAdminSettingsMap(): Promise<AdminMessageSettings> {
  const settings = await prisma.setting.findMany();
  const map: AdminMessageSettings = {};

  for (const setting of settings) {
    map[setting.key] = setting.value;
  }

  return map;
}

export async function getAdminNotices(): Promise<AdminNoticeItem[]> {
  const notices = await prisma.notice.findMany({
    orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
  });

  return notices.map((notice) => ({
    ...notice,
    createdAt: notice.createdAt.toISOString(),
    updatedAt: notice.updatedAt.toISOString(),
  }));
}

export async function getAdminMembers(): Promise<AdminMemberListItem[]> {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: {
          participants: true,
        },
      },
    },
  });

  return users.map((user) => {
    const resolved = withResolvedProfileImage(user);
    return {
      ...resolved,
      createdAt: resolved.createdAt.toISOString(),
    };
  });
}

export async function getAdminMeetings(): Promise<AdminMeetingListItem[]> {
  const meetings = await prisma.meeting.findMany({
    where: {
      OR: [
        { meetingGroupId: null },
        { groupDayIndex: 1 },
      ],
    },
    orderBy: { date: "asc" },
    include: {
      meetingGroup: {
        include: {
          meetings: {
            orderBy: { groupDayIndex: "asc" },
          },
        },
      },
      billingSnapshot: true,
      settlementConfirmations: {
        select: { recipientKakaoId: true, verifiedAt: true },
      },
      _count: {
        select: { participants: { where: { status: "APPROVED" } } },
      },
    },
  });

  return meetings.map((meeting) => {
    const overnightGroup = toOvernightMeetingGroupSummary(meeting.meetingGroup);
    const finalDay = overnightGroup?.days.at(-1);
    const snapshot = meeting.billingSnapshot && isMeetingBillingSnapshotPayload(meeting.billingSnapshot.data)
      ? meeting.billingSnapshot.data
      : null;
    const verifiedRecipientIds = new Set(
      meeting.settlementConfirmations
        .filter((item) => item.verifiedAt)
        .map((item) => item.recipientKakaoId)
    );
    for (const recipient of snapshot?.recipients ?? []) {
      if (recipient.totalFee === 0) verifiedRecipientIds.add(recipient.recipientKakaoId);
    }
    const workflowStage = getMeetingWorkflowStage({
      date: finalDay?.date ?? meeting.date,
      endTime: finalDay?.endTime ?? meeting.endTime,
      isOpen: meeting.isOpen,
      settlementOpen: meeting.settlementOpen,
      billingEvidenceReady: Boolean(meeting.billingReviewConfirmedAt),
      recipientCount: snapshot?.recipients.length ?? meeting.settlementConfirmations.length,
      verifiedRecipientCount: verifiedRecipientIds.size,
      settlementCompletedAt: meeting.settlementCompletedAt,
    });
    const nextActionByStage: Record<MeetingWorkflowStage, string> = {
      RECRUITING: "참가 현황 보기",
      UPCOMING: "모임 준비 확인",
      ACTUALS_REVIEW: "참석·이용 확인",
      BILLING_REVIEW: "청구 검토",
      PAYMENT_CONFIRMATION: "입금 확인",
      FINAL_SETTLEMENT: "최종 정산",
      COMPLETED: "완료 보고서 보기",
    };
    return {
      id: meeting.id,
      date: meeting.date,
      startTime: meeting.startTime,
      endTime: meeting.endTime,
      location: meeting.location,
      meetingType: meeting.meetingType,
      isOpen: meeting.isOpen,
      createdByKakaoId: meeting.createdByKakaoId,
      overnightGroup,
      approvedCount: meeting._count.participants,
      workflowStage,
      workflowLabel: MEETING_WORKFLOW_LABELS[workflowStage],
      nextAction: nextActionByStage[workflowStage],
    };
  });
}

export async function getAdminMeetingDetail(meetingId: number): Promise<AdminMeetingDetail | null> {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
      meetingGroup: {
        include: {
          meetings: {
            orderBy: { groupDayIndex: "asc" },
          },
        },
      },
      participants: {
        orderBy: [{ status: "asc" }, { submittedAt: "asc" }],
        include: {
          user: {
            select: {
              profileImage: true,
              customProfileImageUrl: true,
            },
          },
        },
      },
    },
  });

  if (!meeting) return null;

  const participants = meeting.participants.map((participant) => ({
    id: participant.id,
    name: participant.name,
    kakaoId: participant.kakaoId,
    kakaoNickname: participant.kakaoNickname,
    note: participant.note,
    hasLesson: participant.hasLesson,
    hasBus: participant.hasBus,
    hasRental: participant.hasRental,
    usesClubLodging: participant.usesClubLodging,
    status: participant.status,
    attendanceStatus: participant.attendanceStatus,
    waitlistPosition: participant.waitlistPosition,
    isPenalized: participant.isPenalized,
    cancelledAt: participant.cancelledAt?.toISOString() ?? null,
    submittedAt: participant.submittedAt.toISOString(),
    companionId: participant.companionId,
    profileImage: resolveProfileImage(participant.user),
  }));

  return {
    id: meeting.id,
    date: meeting.date,
    startTime: meeting.startTime,
    endTime: meeting.endTime,
    location: meeting.location,
    description: meeting.description,
    isOpen: meeting.isOpen,
    meetingType: meeting.meetingType,
    overnightGroup: toOvernightMeetingGroupSummary(meeting.meetingGroup),
    approvedCount: participants.filter((participant) => participant.status === "APPROVED").length,
    participants,
  };
}

function sortSettlementItems<T extends { id: number; kakaoId: string; companionId: number | null }>(items: T[]) {
  const regulars = items.filter((item) => item.companionId === null);
  const companions = items.filter((item) => item.companionId !== null);
  const result: T[] = [];

  for (const regular of regulars) {
    result.push(regular);
    result.push(...companions.filter((companion) => companion.kakaoId === regular.kakaoId));
  }

  const placed = new Set(result.map((item) => item.id));
  for (const companion of companions) {
    if (!placed.has(companion.id)) result.push(companion);
  }

  return result;
}

async function loadSettlementContext(meetingId: number) {
  const requestedMeeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: {
      id: true,
      meetingGroup: {
        select: {
          meetings: {
            orderBy: { groupDayIndex: "asc" },
            select: { id: true, groupDayIndex: true },
          },
        },
      },
    },
  });
  if (!requestedMeeting) return null;
  const canonicalMeetingId = requestedMeeting.meetingGroup?.meetings.find((meeting) => meeting.groupDayIndex === 1)?.id
    ?? meetingId;
  const [meeting, { pricing, foodSupportCap }, confirmations, surfUsageBilling] = await Promise.all([
    prisma.meeting.findUnique({
      where: { id: canonicalMeetingId },
      include: {
        meetingGroup: {
          include: {
            meetings: { orderBy: { groupDayIndex: "asc" } },
          },
        },
        billingSnapshot: true,
        participants: {
          where: { status: "APPROVED" },
          orderBy: { submittedAt: "asc" },
          include: {
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
        },
      },
    }),
    getSettlementPricingBundle(),
    prisma.settlementConfirmation.findMany({
      where: { meetingId: canonicalMeetingId },
    }),
    getConfirmedSurfUsageBillingByParticipant(canonicalMeetingId),
  ]);

  if (!meeting) return null;

  const adjustmentMap = new Map(
    meeting.participants.map((participant) => [
      participant.id,
      participant.chargeAdjustments.map((adjustment) => ({
        id: adjustment.id,
        label: adjustment.label,
        amount: adjustment.amount,
      })),
    ])
  );

  const confirmationMap = new Map(
    confirmations.map((confirmation) => [
      confirmation.recipientKakaoId,
      {
        reportedAt: confirmation.confirmedAt.toISOString(),
        verifiedAt: confirmation.verifiedAt?.toISOString() ?? null,
      },
    ])
  );

  const foodOrderMap = new Map(
    meeting.participants.map((participant) => [
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

  let liveRecipients = groupParticipantsForSettlement(
    meeting.participants,
    pricing,
    adjustmentMap,
    foodOrderMap,
    foodSupportCap,
    surfUsageBilling.billingMap,
    surfUsageBilling.confirmedParticipantIds
  );
  let overnightContext: {
    group: OvernightMeetingGroupSummary;
    meetingIds: [number, number];
    finalDate: string;
    finalEndTime: string;
    liveParticipants: AdminSettlementParticipant[];
    surfUsageSummary: AdminSettlementData["surfUsageSummary"];
  } | null = null;
  const overnightGroup = toOvernightMeetingGroupSummary(meeting.meetingGroup);
  const secondDayId = overnightGroup?.days[1]?.id;
  if (overnightGroup && secondDayId) {
    const [secondMeeting, secondSurfUsageBilling] = await Promise.all([
      prisma.meeting.findUnique({
        where: { id: secondDayId },
        include: {
          participants: {
            where: { status: "APPROVED" },
            orderBy: { submittedAt: "asc" },
            include: {
              user: { select: { memberType: true, name: true } },
              companion: {
                include: { owner: { select: { kakaoId: true, name: true } } },
              },
              chargeAdjustments: { orderBy: { createdAt: "asc" } },
              foodOrderItems: { orderBy: { createdAt: "asc" } },
            },
          },
        },
      }),
      getConfirmedSurfUsageBillingByParticipant(secondDayId),
    ]);
    if (secondMeeting) {
      const secondAdjustmentMap = new Map(
        secondMeeting.participants.map((participant) => [
          participant.id,
          participant.chargeAdjustments.map((adjustment) => ({
            id: adjustment.id,
            label: adjustment.label,
            amount: adjustment.amount,
          })),
        ])
      );
      const secondFoodOrderMap = new Map(
        secondMeeting.participants.map((participant) => [
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
      liveRecipients = groupOvernightParticipantsForSettlement([
        {
          meetingId: meeting.id,
          date: meeting.date,
          participants: meeting.participants,
          adjustmentMap,
          foodOrderMap,
          surfUsageMap: surfUsageBilling.billingMap,
          surfUsageLedgerParticipantIds: surfUsageBilling.confirmedParticipantIds,
        },
        {
          meetingId: secondMeeting.id,
          date: secondMeeting.date,
          participants: secondMeeting.participants,
          adjustmentMap: secondAdjustmentMap,
          foodOrderMap: secondFoodOrderMap,
          surfUsageMap: secondSurfUsageBilling.billingMap,
          surfUsageLedgerParticipantIds: secondSurfUsageBilling.confirmedParticipantIds,
        },
      ], {
        regular: overnightGroup.regularBaseFee,
        companion: overnightGroup.companionBaseFee,
        lodging: overnightGroup.lodgingFee,
      }, pricing, foodSupportCap);
      const lineByParticipantId = new Map(
        liveRecipients.flatMap((recipient) => recipient.items).map((line) => [line.participantId, line])
      );
      const liveParticipants = sortSettlementItems(meeting.participants).flatMap((participant) => {
        const line = lineByParticipantId.get(participant.id);
        if (!line) return [];
        return [{
          id: participant.id,
          name: participant.name,
          kakaoId: participant.kakaoId,
          companionId: participant.companionId,
          hasLesson: participant.hasLesson,
          hasBus: participant.hasBus,
          hasRental: participant.hasRental,
          usesClubLodging: participant.usesClubLodging,
          adjustments: line.adjustments,
          foodOrders: line.foodOrders.map((item) => ({
            id: item.id,
            menuNameSnapshot: item.menuNameSnapshot,
            optionChoiceLabelSnapshot: item.optionChoiceLabelSnapshot,
            unitPriceSnapshot: item.unitPriceSnapshot,
            quantity: item.quantity,
            preparingQuantity: item.preparingQuantity,
            servedQuantity: item.servedQuantity,
            cancelledAt: item.cancelledAt instanceof Date ? item.cancelledAt.toISOString() : item.cancelledAt ?? null,
            cancelledReasonCode: item.cancelledReasonCode ?? null,
            cancelledReasonText: item.cancelledReasonText ?? null,
          })),
          surfUsageLines: line.surfUsageLines.map((usageLine) => ({
            id: usageLine.id,
            usageItemId: usageLine.usageItemId,
            usageItemName: usageLine.usageItemName,
            serviceType: usageLine.serviceType,
            quantity: usageLine.quantity,
            shopUnitPrice: usageLine.shopUnitPrice,
            memberBillingPolicy: usageLine.memberBillingPolicy,
            regularMemberUnitPrice: usageLine.regularMemberUnitPrice,
          })),
          breakdown: {
            baseFee: line.baseFee,
            lodgingFee: line.lodgingFee,
            lessonFee: line.lessonFee,
            rentalFee: line.rentalFee,
            surfUsageShopFee: line.surfUsageShopFee,
            surfUsageMemberFee: line.surfUsageMemberFee,
            surfUsageCoveredFee: line.surfUsageCoveredFee,
            adjustmentFee: line.adjustmentFee,
            foodSubtotal: line.foodSubtotal,
            foodSupportApplied: line.foodSupportApplied,
            foodCharge: line.foodCharge,
            totalFee: line.totalFee,
          },
          dailyBreakdowns: line.dailyBreakdowns,
        }];
      });
      overnightContext = {
        group: overnightGroup,
        meetingIds: [meeting.id, secondMeeting.id],
        finalDate: secondMeeting.date,
        finalEndTime: secondMeeting.endTime,
        liveParticipants,
        surfUsageSummary: liveParticipants.reduce((summary, participant) => ({
          shopChargeAmount: summary.shopChargeAmount + participant.breakdown.surfUsageShopFee,
          memberChargeAmount: summary.memberChargeAmount + participant.breakdown.surfUsageMemberFee,
          operationsCoveredAmount: summary.operationsCoveredAmount + participant.breakdown.surfUsageCoveredFee,
        }), { shopChargeAmount: 0, memberChargeAmount: 0, operationsCoveredAmount: 0 }),
      };
    }
  }
  const snapshotPayload = meeting.settlementOpen
    && meeting.billingSnapshot
    && isMeetingBillingSnapshotPayload(meeting.billingSnapshot.data)
      ? meeting.billingSnapshot.data
      : null;
  const sourceRecipients = snapshotPayload?.recipients ?? liveRecipients;
  const recipients = sourceRecipients.map((recipient) => {
    const confirmation = confirmationMap.get(recipient.recipientKakaoId) ?? null;
    const reportedAt = confirmation?.reportedAt ?? null;
    const verifiedAt = confirmation?.verifiedAt ?? null;
    return {
      ...recipient,
      reported: reportedAt !== null,
      reportedAt,
      verified: verifiedAt !== null,
      verifiedAt,
      completed: verifiedAt !== null,
      completedAt: verifiedAt,
    };
  });

  return {
    meeting,
    pricing,
    adjustmentMap,
    foodOrderMap,
    foodSupportCap,
    surfUsageBilling,
    recipients,
    snapshotPayload,
    liveRecipients,
    overnightContext,
  };
}

export async function getAdminSettlementData(meetingId: number): Promise<AdminSettlementData | null> {
  const context = await loadSettlementContext(meetingId);
  if (!context) return null;

  const {
    meeting,
    pricing,
    adjustmentMap,
    foodOrderMap,
    foodSupportCap,
    surfUsageBilling,
    recipients,
    snapshotPayload,
    overnightContext,
  } = context;

  const singleDayLiveParticipants = sortSettlementItems(meeting.participants).map((participant) => {
    const adjustments = adjustmentMap.get(participant.id) ?? [];
    const foodOrders = foodOrderMap.get(participant.id) ?? [];
    const surfUsageLines = surfUsageBilling.billingMap.get(participant.id) ?? [];
    const adjustmentFee = adjustments.reduce((sum, adjustment) => sum + adjustment.amount, 0);
    const breakdown = getParticipantChargeBreakdown(
      participant,
      pricing,
      adjustmentFee,
      foodOrders,
      foodSupportCap,
      surfUsageLines,
      surfUsageBilling.confirmedParticipantIds.has(participant.id)
    );

    return {
      id: participant.id,
      name: participant.name,
      kakaoId: participant.kakaoId,
      companionId: participant.companionId,
      hasLesson: participant.hasLesson,
      hasBus: participant.hasBus,
      hasRental: participant.hasRental,
      usesClubLodging: participant.usesClubLodging,
      adjustments,
      foodOrders,
      surfUsageLines: surfUsageLines.map((line) => ({
        id: line.id,
        usageItemId: line.usageItemId,
        usageItemName: line.usageItemName,
        serviceType: line.serviceType,
        quantity: line.quantity,
        shopUnitPrice: line.shopUnitPrice,
        memberBillingPolicy: line.memberBillingPolicy,
        regularMemberUnitPrice: line.regularMemberUnitPrice,
      })),
      breakdown,
    };
  });
  const liveParticipants = overnightContext?.liveParticipants ?? singleDayLiveParticipants;
  const participants = snapshotPayload
    ? snapshotPayload.participants.map((participant) => ({ ...participant }))
    : liveParticipants;
  const effectiveSurfUsageSummary = snapshotPayload?.surfUsageSummary
    ?? overnightContext?.surfUsageSummary
    ?? surfUsageBilling.summary;
  const readiness = overnightContext
    ? await getMeetingGroupBillingReadiness(overnightContext.meetingIds)
    : await getMeetingBillingReadiness(meeting.id);
  if (!readiness) return null;
  const evidenceReady = readiness.checks
    .filter((check) => check.id !== "billing-reviewed")
    .every((check) => check.complete);
  const workflowStage = getMeetingWorkflowStage({
    date: overnightContext?.finalDate ?? meeting.date,
    endTime: overnightContext?.finalEndTime ?? meeting.endTime,
    isOpen: meeting.isOpen,
    settlementOpen: meeting.settlementOpen,
    billingEvidenceReady: evidenceReady,
    recipientCount: recipients.length,
    verifiedRecipientCount: recipients.filter((recipient) => recipient.totalFee === 0 || recipient.verified).length,
    settlementCompletedAt: meeting.settlementCompletedAt,
  });
  const foodPayableTotal = meeting.billingSnapshot?.foodPayableTotal
    ?? participants.reduce((total, participant) => total + participant.breakdown.foodSubtotal, 0);
  const foodSupportTotal = participants.reduce(
    (total, participant) => total + participant.breakdown.foodSupportApplied,
    0
  );
  const legacyAccount = meeting.billingSnapshot ? null : await getAdminSettingsFormData();

  return {
    meeting: {
      id: meeting.id,
      date: meeting.date,
      startTime: meeting.startTime,
      endTime: meeting.endTime,
      location: meeting.location,
      isOpen: meeting.isOpen,
      settlementOpen: meeting.settlementOpen,
      overnightGroup: overnightContext?.group ?? null,
    },
    participants,
    surfUsageSummary: effectiveSurfUsageSummary,
    reportedRecipientCount: recipients.filter((recipient) => recipient.reported).length,
    verifiedRecipientCount: recipients.filter((recipient) => recipient.totalFee === 0 || recipient.verified).length,
    confirmedRecipientCount: recipients.filter((recipient) => recipient.totalFee === 0 || recipient.verified).length,
    recipients,
    readiness,
    workflowStage,
    workflowLabel: MEETING_WORKFLOW_LABELS[workflowStage],
    billing: {
      revision: meeting.billingSnapshot?.revision ?? null,
      publishedAt: meeting.billingPublishedAt?.toISOString() ?? meeting.billingSnapshot?.publishedAt.toISOString() ?? null,
      correctionReason: meeting.billingCorrectionReason,
      account: {
        bankName: meeting.billingSnapshot?.accountBankName ?? legacyAccount?.settlementBankName ?? "",
        accountNumber: meeting.billingSnapshot?.accountNumber ?? legacyAccount?.settlementAccountNumber ?? "",
        accountHolder: meeting.billingSnapshot?.accountHolder ?? legacyAccount?.settlementAccountHolder ?? "",
      },
      totals: {
        memberChargeTotal: meeting.billingSnapshot?.memberChargeTotal
          ?? recipients.reduce((total, recipient) => total + recipient.totalFee, 0),
        shopPayableTotal: meeting.billingSnapshot?.shopPayableTotal
          ?? effectiveSurfUsageSummary.shopChargeAmount,
        foodPayableTotal,
        clubSupportTotal: meeting.billingSnapshot?.clubSupportTotal
          ?? effectiveSurfUsageSummary.operationsCoveredAmount + foodSupportTotal,
      },
      shopPayout: {
        paidAt: meeting.shopPaidAt?.toISOString() ?? null,
        amount: meeting.shopPaidAmount,
      },
      foodPayout: {
        paidAt: meeting.foodPaidAt?.toISOString() ?? null,
        amount: meeting.foodPaidAmount,
      },
      settlementCompletedAt: meeting.settlementCompletedAt?.toISOString() ?? null,
      settlementNote: meeting.settlementNote,
    },
  };
}

export async function getAdminSettlementStatusData(meetingId: number): Promise<AdminSettlementStatusSummary | null> {
  const context = await loadSettlementContext(meetingId);
  if (!context) return null;

  const { meeting, recipients } = context;
  const sortedRecipients = [...recipients]
    .sort((a, b) => a.recipientType.localeCompare(b.recipientType))
    .sort((a, b) => a.recipientName.localeCompare(b.recipientName, "ko-KR"));

  const completedCount = meeting.settlementOpen
    ? sortedRecipients.filter((recipient) => recipient.completed).length
    : 0;
  const pendingCount = meeting.settlementOpen
    ? sortedRecipients.filter((recipient) => !recipient.completed).length
    : 0;

  return {
    meeting: {
      id: meeting.id,
      settlementOpen: meeting.settlementOpen,
    },
    summary: {
      totalRecipientCount: sortedRecipients.length,
      completedCount,
      pendingCount,
    },
    recipients: sortedRecipients.map((recipient) => ({
      recipientKakaoId: recipient.recipientKakaoId,
      recipientName: recipient.recipientName,
      recipientType: recipient.recipientType,
      totalFee: recipient.totalFee,
      itemCount: recipient.items.length,
      completed: meeting.settlementOpen ? recipient.completed : false,
      completedAt: meeting.settlementOpen ? recipient.completedAt : null,
    })),
  };
}

export async function getAdminSettingsFormData(): Promise<AdminSettingsFormData> {
  const settings = await getAdminSettingsMap();

  return {
    penaltyMessage: settings[CANCELLATION_PENALTY_MESSAGE_KEY] ?? DEFAULT_PENALTY_MESSAGE,
    penaltyDays: settings[CANCELLATION_PENALTY_DAYS_KEY] ?? DEFAULT_CANCELLATION_PENALTY_DAYS,
    participantOptionPricingGuide:
      settings[PARTICIPANT_OPTION_PRICING_GUIDE_KEY] ?? DEFAULT_PARTICIPANT_OPTION_PRICING_GUIDE,
    settlementBankName: settings[SETTLEMENT_BANK_NAME_KEY] ?? DEFAULT_SETTLEMENT_BANK_NAME,
    settlementAccountNumber:
      settings[SETTLEMENT_ACCOUNT_NUMBER_KEY] ?? DEFAULT_SETTLEMENT_ACCOUNT_NUMBER,
    settlementAccountHolder:
      settings[SETTLEMENT_ACCOUNT_HOLDER_KEY] ?? DEFAULT_SETTLEMENT_ACCOUNT_HOLDER,
  };
}

export async function getAdminPricingState(): Promise<AdminPricingState> {
  const settings = await getAdminSettingsMap();

  return {
    [PRICING_SETTING_KEYS.regularBaseFee]:
      settings[PRICING_SETTING_KEYS.regularBaseFee] ??
      DEFAULT_PRICING_SETTINGS[PRICING_SETTING_KEYS.regularBaseFee],
    [PRICING_SETTING_KEYS.companionBaseFee]:
      settings[PRICING_SETTING_KEYS.companionBaseFee] ??
      DEFAULT_PRICING_SETTINGS[PRICING_SETTING_KEYS.companionBaseFee],
    [PRICING_SETTING_KEYS.regularLessonFee]:
      settings[PRICING_SETTING_KEYS.regularLessonFee] ??
      DEFAULT_PRICING_SETTINGS[PRICING_SETTING_KEYS.regularLessonFee],
    [PRICING_SETTING_KEYS.companionLessonFee]:
      settings[PRICING_SETTING_KEYS.companionLessonFee] ??
      DEFAULT_PRICING_SETTINGS[PRICING_SETTING_KEYS.companionLessonFee],
    [PRICING_SETTING_KEYS.regularRentalFee]:
      settings[PRICING_SETTING_KEYS.regularRentalFee] ??
      DEFAULT_PRICING_SETTINGS[PRICING_SETTING_KEYS.regularRentalFee],
    [PRICING_SETTING_KEYS.companionRentalFee]:
      settings[PRICING_SETTING_KEYS.companionRentalFee] ??
      DEFAULT_PRICING_SETTINGS[PRICING_SETTING_KEYS.companionRentalFee],
    foodOrderSupportCap:
      settings[FOOD_ORDER_SUPPORT_CAP_KEY] ?? DEFAULT_FOOD_ORDER_SUPPORT_CAP,
  };
}
