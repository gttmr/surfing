import { prisma } from "@/lib/db";
import { withResolvedProfileImage } from "@/lib/profile-image";
import { resolveProfileImage } from "@/lib/profile-image";
import { getPricingConfig, getParticipantChargeBreakdown, groupParticipantsForSettlement } from "@/lib/pricing";
import type { AdminSettlementStatusSummary } from "@/lib/landing-types";
import {
  DEFAULT_PARTICIPANT_OPTION_PRICING_GUIDE,
  DEFAULT_PRICING_SETTINGS,
  DEFAULT_SETTLEMENT_ACCOUNT_HOLDER,
  DEFAULT_SETTLEMENT_ACCOUNT_NUMBER,
  DEFAULT_SETTLEMENT_BANK_NAME,
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
  cancellation_penalty_message?: string;
  cancellation_penalty_days?: string;
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
};

export type AdminSettingsFormData = {
  penaltyMessage: string;
  penaltyDays: string;
  participantOptionPricingGuide: string;
  settlementBankName: string;
  settlementAccountNumber: string;
  settlementAccountHolder: string;
};

export type AdminPricingState = Record<PricingSettingKey, string>;

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
  status: string;
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
  adjustments: { id: number; label: string; amount: number }[];
  breakdown: {
    baseFee: number;
    lessonFee: number;
    rentalFee: number;
    adjustmentFee: number;
    totalFee: number;
  };
};

export type AdminSettlementRecipient = {
  recipientKakaoId: string;
  recipientName: string;
  recipientType: "self" | "linked_companion" | "owner";
  totalFee: number;
  confirmed: boolean;
  confirmedAt: string | null;
  items: {
    participantId: number;
    participantName: string;
    totalFee: number;
  }[];
};

export type AdminSettlementData = {
  meeting: {
    id: number;
    date: string;
    startTime: string;
    endTime: string;
    location: string;
    settlementOpen: boolean;
  };
  participants: AdminSettlementParticipant[];
  confirmedRecipientCount: number;
  recipients: AdminSettlementRecipient[];
};

const DEFAULT_PENALTY_MESSAGE =
  "일정 2일 이내 취소로 패널티가 부과됩니다. 잦은 직전 취소는 다른 회원들에게 피해를 줄 수 있으니 신중하게 결정해 주세요.";

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
      participants: {
        select: { status: true },
      },
    },
  });

  return meetings.map((meeting) => ({
    id: meeting.id,
    date: meeting.date,
    startTime: meeting.startTime,
    endTime: meeting.endTime,
    location: meeting.location,
    meetingType: meeting.meetingType,
    isOpen: meeting.isOpen,
    createdByKakaoId: meeting.createdByKakaoId,
    approvedCount: meeting.participants.filter((participant) => participant.status === "APPROVED").length,
  }));
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
    status: participant.status,
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
  const [meeting, pricing, confirmations] = await Promise.all([
    prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
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
          },
        },
      },
    }),
    getPricingConfig(),
    prisma.settlementConfirmation.findMany({
      where: { meetingId },
    }),
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
      confirmation.confirmedAt.toISOString(),
    ])
  );

  const recipients = groupParticipantsForSettlement(meeting.participants, pricing, adjustmentMap).map((recipient) => {
    const confirmedAt = confirmationMap.get(recipient.recipientKakaoId) ?? null;
    return {
      ...recipient,
      confirmed: confirmedAt !== null,
      confirmedAt,
    };
  });

  return {
    meeting,
    pricing,
    adjustmentMap,
    recipients,
  };
}

export async function getAdminSettlementData(meetingId: number): Promise<AdminSettlementData | null> {
  const context = await loadSettlementContext(meetingId);
  if (!context) return null;

  const { meeting, pricing, adjustmentMap, recipients } = context;

  const participants = sortSettlementItems(meeting.participants).map((participant) => {
    const adjustments = adjustmentMap.get(participant.id) ?? [];
    const adjustmentFee = adjustments.reduce((sum, adjustment) => sum + adjustment.amount, 0);
    const breakdown = getParticipantChargeBreakdown(participant, pricing, adjustmentFee);

    return {
      id: participant.id,
      name: participant.name,
      kakaoId: participant.kakaoId,
      companionId: participant.companionId,
      hasLesson: participant.hasLesson,
      hasBus: participant.hasBus,
      hasRental: participant.hasRental,
      adjustments,
      breakdown,
    };
  });

  return {
    meeting: {
      id: meeting.id,
      date: meeting.date,
      startTime: meeting.startTime,
      endTime: meeting.endTime,
      location: meeting.location,
      settlementOpen: meeting.settlementOpen,
    },
    participants,
    confirmedRecipientCount: recipients.filter((recipient) => recipient.confirmed).length,
    recipients,
  };
}

export async function getAdminSettlementStatusData(meetingId: number): Promise<AdminSettlementStatusSummary | null> {
  const context = await loadSettlementContext(meetingId);
  if (!context) return null;

  const { meeting, recipients } = context;
  const sortedRecipients = [...recipients]
    .sort((a, b) => a.recipientType.localeCompare(b.recipientType))
    .sort((a, b) => a.recipientName.localeCompare(b.recipientName, "ko-KR"));

  const confirmedCount = meeting.settlementOpen
    ? sortedRecipients.filter((recipient) => recipient.confirmed).length
    : 0;
  const unconfirmedCount = meeting.settlementOpen
    ? sortedRecipients.filter((recipient) => !recipient.confirmed).length
    : 0;

  return {
    meeting: {
      id: meeting.id,
      settlementOpen: meeting.settlementOpen,
    },
    summary: {
      totalRecipientCount: sortedRecipients.length,
      confirmedCount,
      unconfirmedCount,
    },
    recipients: sortedRecipients.map((recipient) => ({
      recipientKakaoId: recipient.recipientKakaoId,
      recipientName: recipient.recipientName,
      recipientType: recipient.recipientType,
      totalFee: recipient.totalFee,
      itemCount: recipient.items.length,
      confirmed: meeting.settlementOpen ? recipient.confirmed : false,
      confirmedAt: meeting.settlementOpen ? recipient.confirmedAt : null,
    })),
  };
}

export async function getAdminSettingsFormData(): Promise<AdminSettingsFormData> {
  const settings = await getAdminSettingsMap();

  return {
    penaltyMessage: settings.cancellation_penalty_message ?? DEFAULT_PENALTY_MESSAGE,
    penaltyDays: settings.cancellation_penalty_days ?? "2",
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
  };
}
