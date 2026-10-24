import { prisma } from "@/lib/db";
import { withResolvedProfileImage } from "@/lib/profile-image";
import { resolveProfileImage } from "@/lib/profile-image";
import {
  getFoodSupportCap,
  getParticipantChargeBreakdown,
  groupParticipantsForSettlement,
  type SettlementRecipientGroup,
} from "@/lib/pricing";
import { DEFAULT_PENALTY_MESSAGE } from "@/lib/penalty";
import { getConfirmedSurfUsageBillingByParticipant } from "@/lib/surf-usage-data";
import { isMeetingBillingSnapshotPayload } from "@/lib/billing-snapshot";
import { getMeetingBillingReadiness } from "@/lib/meeting-readiness-data";
import {
  getMeetingWorkflowStage,
  MEETING_WORKFLOW_LABELS,
  type MeetingWorkflowStage,
} from "@/lib/meeting-lifecycle";
import type { AdminSettlementStatusSummary } from "@/lib/landing-types";
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
  COMPANY_SUPPORT_PER_REGULAR_KEY,
  DEFAULT_COMPANY_SUPPORT_PER_REGULAR,
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
  /** 1박 이상이면 마지막 날 */
  endDate: string | null;
  workflowStage: MeetingWorkflowStage;
  workflowLabel: string;
  nextAction: string;
  lessonCount: number;
  recipientCount: number;
  verifiedRecipientCount: number;
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
  companySupportPerRegular: string;
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
  hasDay2Rental: boolean;
  usesClubLodging: boolean;
  status: string;
  absent: boolean;
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
  /** 1박 이상이면 마지막 날 */
  endDate: string | null;
  regularFee: number;
  companionFee: number;
  lodgingFee: number;
  /** 청구가 공개되면 참가비를 바꿀 수 없다 */
  billingPublished: boolean;
  /** 운영진이 모임 종료를 누른 시각 */
  endedAt: string | null;
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
    day?: number;
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
  /** 은행 입금으로 이 청구에 들어온 금액. 청구보다 크면 더 받은 것이다. */
  paidAmount: number;
  /** 자기 몫을 따로 입금한 참가자 */
  paidParticipantIds: number[];
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
    /** 1박 이상이면 마지막 날 */
    endDate: string | null;
    billingPublished: boolean;
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
    /** 장비와 식음료는 같은 샵에 한 번에 지급한다. */
    shopTotal: {
      payable: number;
      paidAt: string | null;
      paidAmount: number | null;
      complete: boolean;
    };
    /** 회사가 정회원 1명당 지원하는 금액(회원 청구와 무관, 정산 수지에만 반영). */
    companySupport: { perRegular: number; regularCount: number; total: number };
    /** 회원 입금 + 회사 지원 − 샵 지급 */
    balance: number;
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
    orderBy: { date: "asc" },
    include: {
      billingSnapshot: true,
      settlementConfirmations: {
        select: { recipientKakaoId: true, verifiedAt: true },
      },
      _count: {
        select: { participants: { where: { status: "APPROVED" } } },
      },
      participants: {
        where: { status: "APPROVED", hasLesson: true },
        select: { id: true },
      },
    },
  });

  return meetings.map((meeting) => {
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
      date: meeting.date,
      endDate: meeting.endDate,
      endTime: meeting.endTime,
      endedAt: meeting.endedAt,
      isOpen: meeting.isOpen,
      billingPublished: meeting.billingPublishedAt !== null,
      recipientCount: snapshot?.recipients.length ?? meeting.settlementConfirmations.length,
      verifiedRecipientCount: verifiedRecipientIds.size,
      settlementCompletedAt: meeting.settlementCompletedAt,
    });
    const nextActionByStage: Record<MeetingWorkflowStage, string> = {
      RECRUITING: "신청 관리",
      UPCOMING: "참가자 보기",
      ACTUALS_REVIEW: "이용 확인 후 청구 공개",
      PAYMENT_CONFIRMATION: "남은 입금 확인하기",
      FINAL_SETTLEMENT: "샵 지급 기록하고 마감",
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
      endDate: meeting.endDate,
      approvedCount: meeting._count.participants,
      workflowStage,
      workflowLabel: MEETING_WORKFLOW_LABELS[workflowStage],
      nextAction: nextActionByStage[workflowStage],
      lessonCount: meeting.participants.length,
      recipientCount: snapshot?.recipients.length ?? meeting.settlementConfirmations.length,
      verifiedRecipientCount: verifiedRecipientIds.size,
    };
  });
}

export async function getAdminMeetingDetail(meetingId: number): Promise<AdminMeetingDetail | null> {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: {
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
    hasDay2Rental: participant.hasDay2Rental,
    usesClubLodging: participant.usesClubLodging,
    status: participant.status,
    absent: participant.absentAt !== null,
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
    endDate: meeting.endDate,
    regularFee: meeting.regularFee,
    companionFee: meeting.companionFee,
    lodgingFee: meeting.lodgingFee,
    billingPublished: meeting.billingPublishedAt !== null,
    endedAt: meeting.endedAt?.toISOString() ?? null,
    approvedCount: participants.filter((participant) => participant.status === "APPROVED").length,
    participants,
  };
}

function sortSettlementItems<T extends { id: number; kakaoId: string; companionId: number | null }>(items: T[]) {
  const regulars = items.filter((item) => item.companionId === null);
  const companions = items.filter((item) => item.companionId !== null);
  const result: T[] = [];

  // 같은 카카오 계정으로 정회원 신청이 둘 있어도 동반인은 한 번만 넣는다.
  const placed = new Set<number>();
  for (const regular of regulars) {
    result.push(regular);
    for (const companion of companions) {
      if (companion.kakaoId === regular.kakaoId && !placed.has(companion.id)) {
        result.push(companion);
        placed.add(companion.id);
      }
    }
  }

  for (const companion of companions) {
    if (!placed.has(companion.id)) result.push(companion);
  }

  return result;
}

async function loadSettlementContext(meetingId: number) {
  const [meeting, foodSupportCap, confirmations, surfUsageBilling, depositPayments] = await Promise.all([
    prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
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
    getFoodSupportCap(),
    prisma.settlementConfirmation.findMany({
      where: { meetingId },
    }),
    getConfirmedSurfUsageBillingByParticipant(meetingId),
    prisma.bankDepositPayment.findMany({ where: { meetingId } }),
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
        createdAt: item.createdAt.toISOString(),
      })),
    ])
  );

  const liveRecipients = groupParticipantsForSettlement(
    meeting,
    meeting.participants,
    adjustmentMap,
    foodOrderMap,
    foodSupportCap,
    surfUsageBilling.billingMap,
  );
  // 공개된 청구는 공개 시점에 고정한 금액을 쓴다.
  const snapshotPayload = meeting.billingPublishedAt
    && meeting.billingSnapshot
    && isMeetingBillingSnapshotPayload(meeting.billingSnapshot.data)
      ? meeting.billingSnapshot.data
      : null;
  const sourceRecipients = snapshotPayload?.recipients ?? liveRecipients;
  const recipients = sourceRecipients.map((recipient) => {
    const confirmation = confirmationMap.get(recipient.recipientKakaoId) ?? null;
    const reportedAt = confirmation?.reportedAt ?? null;
    const verifiedAt = confirmation?.verifiedAt ?? null;
    // 청구 금액이 바뀌기 전에 들어온 일부 입금은 다시 대조할 때까지 세지 않는다.
    const payments = depositPayments.filter((payment) => (
      payment.recipientKakaoId === recipient.recipientKakaoId
      && (verifiedAt !== null || payment.billTotal === recipient.totalFee)
    ));
    return {
      ...recipient,
      paidAmount: payments.reduce((total, payment) => total + payment.amount, 0),
      paidParticipantIds: payments.flatMap((payment) => (payment.participantId === null ? [] : [payment.participantId])),
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
    adjustmentMap,
    foodOrderMap,
    foodSupportCap,
    surfUsageBilling,
    recipients,
    snapshotPayload,
    liveRecipients,
  };
}

export async function getAdminSettlementData(meetingId: number): Promise<AdminSettlementData | null> {
  const context = await loadSettlementContext(meetingId);
  if (!context) return null;

  const {
    meeting,
    adjustmentMap,
    foodOrderMap,
    foodSupportCap,
    surfUsageBilling,
    recipients,
    snapshotPayload,
  } = context;

  const liveParticipants: AdminSettlementParticipant[] = sortSettlementItems(meeting.participants).map((participant) => {
    const adjustments = adjustmentMap.get(participant.id) ?? [];
    const foodOrders = foodOrderMap.get(participant.id) ?? [];
    const { surfUsageLines, dailyBreakdowns, ...breakdown } = getParticipantChargeBreakdown(
      meeting,
      participant,
      adjustments,
      foodOrders,
      foodSupportCap,
      surfUsageBilling.billingMap.get(participant.id) ?? [],
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
        day: line.day,
        usageItemId: line.usageItemId,
        usageItemName: line.usageItemName,
        serviceType: line.serviceType,
        quantity: line.quantity,
        shopUnitPrice: line.shopUnitPrice,
        memberBillingPolicy: line.memberBillingPolicy,
        regularMemberUnitPrice: line.regularMemberUnitPrice,
      })),
      breakdown,
      ...(dailyBreakdowns ? { dailyBreakdowns } : {}),
    };
  });
  const participants = snapshotPayload
    ? snapshotPayload.participants.map((participant) => ({ ...participant }))
    : liveParticipants;
  const liveSurfUsageSummary = liveParticipants.reduce((summary, participant) => ({
    shopChargeAmount: summary.shopChargeAmount + participant.breakdown.surfUsageShopFee,
    memberChargeAmount: summary.memberChargeAmount + participant.breakdown.surfUsageMemberFee,
    operationsCoveredAmount: summary.operationsCoveredAmount + participant.breakdown.surfUsageCoveredFee,
  }), { shopChargeAmount: 0, memberChargeAmount: 0, operationsCoveredAmount: 0 });
  const effectiveSurfUsageSummary = snapshotPayload?.surfUsageSummary ?? liveSurfUsageSummary;
  const readiness = await getMeetingBillingReadiness(meeting.id);
  if (!readiness) return null;
  const billingPublished = meeting.billingPublishedAt !== null;
  const workflowStage = getMeetingWorkflowStage({
    date: meeting.date,
    endDate: meeting.endDate,
    endTime: meeting.endTime,
    endedAt: meeting.endedAt,
    isOpen: meeting.isOpen,
    billingPublished,
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
  const companySupportSetting = await prisma.setting.findUnique({ where: { key: COMPANY_SUPPORT_PER_REGULAR_KEY } });
  const companySupportPerRegular = Math.max(0, Number(companySupportSetting?.value ?? DEFAULT_COMPANY_SUPPORT_PER_REGULAR) || 0);
  const regularCount = participants.filter((participant) => participant.companionId === null).length;
  const memberChargeTotal = meeting.billingSnapshot?.memberChargeTotal
    ?? recipients.reduce((total, recipient) => total + recipient.totalFee, 0);
  const shopPayableTotal = meeting.billingSnapshot?.shopPayableTotal ?? effectiveSurfUsageSummary.shopChargeAmount;
  const shopTotalPayable = shopPayableTotal + foodPayableTotal;

  return {
    meeting: {
      id: meeting.id,
      date: meeting.date,
      startTime: meeting.startTime,
      endTime: meeting.endTime,
      location: meeting.location,
      isOpen: meeting.isOpen,
      endDate: meeting.endDate,
      billingPublished,
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
        memberChargeTotal,
        shopPayableTotal,
        foodPayableTotal,
        clubSupportTotal: meeting.billingSnapshot?.clubSupportTotal
          ?? effectiveSurfUsageSummary.operationsCoveredAmount + foodSupportTotal,
      },
      shopTotal: {
        payable: shopTotalPayable,
        paidAt: meeting.shopPaidAt?.toISOString() ?? null,
        paidAmount: meeting.shopPaidAt ? meeting.shopPaidAmount : null,
        complete: shopTotalPayable === 0 || meeting.shopPaidAt !== null,
      },
      companySupport: {
        perRegular: companySupportPerRegular,
        regularCount,
        total: companySupportPerRegular * regularCount,
      },
      balance: memberChargeTotal + companySupportPerRegular * regularCount - shopTotalPayable,
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

  const billingPublished = meeting.billingPublishedAt !== null;
  const completedCount = billingPublished
    ? sortedRecipients.filter((recipient) => recipient.completed).length
    : 0;
  const pendingCount = billingPublished
    ? sortedRecipients.filter((recipient) => !recipient.completed).length
    : 0;

  return {
    meeting: {
      id: meeting.id,
      billingPublished,
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
      completed: billingPublished ? recipient.completed : false,
      completedAt: billingPublished ? recipient.completedAt : null,
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
    foodOrderSupportCap:
      settings[FOOD_ORDER_SUPPORT_CAP_KEY] ?? DEFAULT_FOOD_ORDER_SUPPORT_CAP,
    companySupportPerRegular:
      settings[COMPANY_SUPPORT_PER_REGULAR_KEY] ?? DEFAULT_COMPANY_SUPPORT_PER_REGULAR,
  };
}
