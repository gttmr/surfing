import { prisma } from "@/lib/db";
import { getFoodOrderParticipantAccess } from "@/lib/food-ordering";
import {
  getActualUsageReviewAvailability,
  type ActualUsageReviewAvailability,
} from "@/lib/meeting-lifecycle";
import { isOvernightMeeting, lastMeetingDate, meetingDays, type MeetingDay, type MeetingSchedule } from "@/lib/meeting-days";
import {
  DEFAULT_SURF_USAGE_ITEMS,
  billingPolicyFromRegularPrice,
  getSurfUsageLineShopAmount,
  regularUnitPrice,
  summarizeUsageBilling,
  type SurfUsageBillingLine,
  type SurfUsageServiceType,
} from "@/lib/surf-usage-billing";
import { getTodayInSeoul } from "@/lib/date";

// 실제 이용 기록. 이용 항목표는 모든 모임 공통이고, 기록할 때 이름·가격을 함께 저장한다.
// 참가자의 상태: 기록 없음(missing) → 기록됨·확인 필요(submitted) → 확정(confirmed). 확정된 이용만 청구에 반영한다.

type UsageItemRow = {
  id: number;
  name: string;
  description: string | null;
  serviceType: string;
  shopPrice: number;
  regularPrice: number | null;
  isActive: boolean;
  displayOrder: number;
};

type UsageEntryRow = {
  id: number;
  participantId: number;
  day: number;
  usageItemId: number;
  quantity: number;
  usageItemNameSnapshot: string;
  serviceTypeSnapshot: string;
  shopUnitPriceSnapshot: number;
  regularPriceSnapshot: number | null;
  source: string;
};

type UsageStatusFields = {
  usageSubmittedAt: Date | null;
  usageConfirmedAt: Date | null;
};

export type SurfUsageSubmissionStatus = "missing" | "submitted" | "confirmed";

const USAGE_ITEM_SELECT = {
  id: true,
  name: true,
  description: true,
  serviceType: true,
  shopPrice: true,
  regularPrice: true,
  isActive: true,
  displayOrder: true,
} as const;

const USAGE_ENTRY_SELECT = {
  id: true,
  participantId: true,
  day: true,
  usageItemId: true,
  quantity: true,
  usageItemNameSnapshot: true,
  serviceTypeSnapshot: true,
  shopUnitPriceSnapshot: true,
  regularPriceSnapshot: true,
  source: true,
} as const;

/**
 * 실제 이용은 본인, 연동된 동반인 본인, 동반인을 등록한 정회원이 고칠 수 있다.
 * 식음료 주문과 달리 연동된 동반인의 이용도 정회원이 대신 고칠 수 있다(현장에서 정회원이 챙기는 경우가 많다).
 */
function canEditParticipantUsage(
  sessionKakaoId: string,
  participant: {
    readonly kakaoId: string;
    readonly companionId: number | null;
    readonly companion: { readonly ownerKakaoId: string; readonly linkedKakaoId: string | null } | null;
  },
): boolean {
  if (participant.companionId === null) return participant.kakaoId === sessionKakaoId;
  return participant.companion?.ownerKakaoId === sessionKakaoId || participant.companion?.linkedKakaoId === sessionKakaoId;
}

/** 회원은 모임 첫날(또는 운영진이 먼저 종료한 때)부터 마지막 날까지 자기 실제 이용을 직접 고칠 수 있다. */
export function isParticipantActualUsageOpen(
  meeting: MeetingSchedule & { readonly endedAt?: Date | string | null },
  today = getTodayInSeoul(),
): boolean {
  return (meeting.date <= today || Boolean(meeting.endedAt)) && today <= lastMeetingDate(meeting);
}

export type ParticipantMeetingSurfUsageData = {
  meeting: {
    id: number;
    date: string;
    usageOpen: boolean;
    days: MeetingDay[];
  };
  usageItems: Array<{
    id: number;
    name: string;
    description: string | null;
    serviceType: SurfUsageServiceType;
    regularMemberUnitPrice: number;
    companionMemberUnitPrice: number;
  }>;
  participants: Array<{
    participantId: number;
    name: string;
    companionId: number | null;
    requestedOptionLabel: string;
    requestedServiceType: SurfUsageServiceType | null;
    /** 날짜별 신청 내용 (1일차, 2일차…) */
    requestedByDay: Array<SurfUsageServiceType | null>;
    canSubmit: boolean;
    roleLabel: string;
    lockedReason: string | null;
    submissionStatus: SurfUsageSubmissionStatus;
    entries: Array<{
      id: number;
      day: number;
      usageItemId: number;
      usageItemName: string;
      serviceType: SurfUsageServiceType;
      quantity: number;
      source: string;
    }>;
  }>;
};

export type ShopMeetingSurfUsageData = {
  meeting: {
    id: number;
    date: string;
    startTime: string;
    endTime: string;
    location: string;
    days: MeetingDay[];
    actualUsageReview: ActualUsageReviewAvailability;
    shopUsageCheckedAt: string | null;
  };
  usageItems: Array<{
    id: number;
    name: string;
    description: string | null;
    serviceType: SurfUsageServiceType;
    shopPrice: number;
    isActive: boolean;
    displayOrder: number;
  }>;
  summary: {
    approvedCount: number;
    submittedCount: number;
    missingCount: number;
    reviewCount: number;
    confirmedCount: number;
    submittedShopAmount: number;
    confirmedShopAmount: number;
  };
  itemRows: Array<{
    usageItemId: number;
    name: string;
    serviceType: SurfUsageServiceType;
    quantity: number;
    amount: number;
    confirmedQuantity: number;
    confirmedAmount: number;
    /** 1박이면 날짜별 확정 수량 */
    confirmedQuantityByDay: number[];
  }>;
  participantRows: Array<{
    participantId: number;
    participantName: string;
    companionId: number | null;
    requestedOptionLabel: string;
    requestedServiceType?: SurfUsageServiceType | null;
    /** 날짜별 신청 내용 (1일차, 2일차…) */
    requestedByDay: Array<SurfUsageServiceType | null>;
    submissionStatus: SurfUsageSubmissionStatus;
    submittedAt: string | null;
    confirmedAt: string | null;
    shopAmount: number;
    entries: Array<{
      id: number;
      day: number;
      usageItemId: number;
      usageItemName: string;
      serviceType: SurfUsageServiceType;
      quantity: number;
      shopUnitPrice: number;
      amount: number;
      source: string;
    }>;
  }>;
};

export type SurfUsageCatalogInput = {
  id?: number;
  name: string;
  description?: string | null;
  shopPrice: number;
  isActive?: boolean;
};

function asServiceType(value: string): SurfUsageServiceType {
  if (
    value === "LESSON_PACKAGE" ||
    value === "EQUIPMENT_RENTAL" ||
    value === "WETSUIT_ONLY" ||
    value === "SHOWER" ||
    value === "CUSTOM"
  ) {
    return value;
  }
  return "CUSTOM";
}

function getParticipantType(companionId: number | null) {
  return companionId === null ? "REGULAR" : "COMPANION";
}

type SignupChoice = { hasLesson: boolean; hasRental: boolean; hasDay2Rental?: boolean };

function getRequestedOptionLabel(participant: SignupChoice, overnight: boolean) {
  const firstDay = participant.hasLesson ? "강습" : participant.hasRental ? "장비 대여" : "장비 없음";
  if (!overnight) return firstDay;
  return `1일차 ${firstDay} · 2일차 ${participant.hasDay2Rental ? "장비 대여" : "장비 없음"}`;
}

function getRequestedServiceType(participant: SignupChoice): SurfUsageServiceType | null {
  if (participant.hasLesson) return "LESSON_PACKAGE";
  if (participant.hasRental) return "EQUIPMENT_RENTAL";
  return null;
}

/** 첫날은 강습/장비 신청, 1박 둘째 날은 둘째 날 장비 신청 */
function getRequestedByDay(participant: SignupChoice, dayCount: number): Array<SurfUsageServiceType | null> {
  return Array.from({ length: dayCount }, (_, index) => (
    index === 0
      ? getRequestedServiceType(participant)
      : index === 1 && participant.hasDay2Rental ? "EQUIPMENT_RENTAL" : null
  ));
}

export function getSubmissionStatus(participant: UsageStatusFields): SurfUsageSubmissionStatus {
  if (participant.usageConfirmedAt) return "confirmed";
  return participant.usageSubmittedAt ? "submitted" : "missing";
}

function entryToBillingLine(
  entry: UsageEntryRow,
  participant: { companionId: number | null },
  confirmed: boolean
): SurfUsageBillingLine {
  return {
    id: entry.id,
    participantId: entry.participantId,
    day: entry.day,
    participantType: getParticipantType(participant.companionId),
    usageItemId: entry.usageItemId,
    usageItemName: entry.usageItemNameSnapshot,
    serviceType: asServiceType(entry.serviceTypeSnapshot),
    quantity: entry.quantity,
    shopUnitPrice: entry.shopUnitPriceSnapshot,
    ...billingPolicyFromRegularPrice(entry.regularPriceSnapshot),
    confirmed,
  };
}

function mapParticipantEntry(entry: UsageEntryRow) {
  return {
    id: entry.id,
    day: entry.day,
    usageItemId: entry.usageItemId,
    usageItemName: entry.usageItemNameSnapshot,
    serviceType: asServiceType(entry.serviceTypeSnapshot),
    quantity: entry.quantity,
    source: entry.source,
  };
}

/** 이용 항목표. 비어 있으면 기본 항목으로 채운다. */
export async function getSurfUsageItems(): Promise<UsageItemRow[]> {
  const existing = await prisma.surfUsageItem.findMany({
    orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    select: USAGE_ITEM_SELECT,
  });
  if (existing.length > 0) return existing;

  await prisma.surfUsageItem.createMany({
    data: DEFAULT_SURF_USAGE_ITEMS.map((item) => ({ ...item, isActive: true })),
  });
  return prisma.surfUsageItem.findMany({
    orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    select: USAGE_ITEM_SELECT,
  });
}

function entrySnapshot(usageItem: UsageItemRow) {
  return {
    usageItemNameSnapshot: usageItem.name,
    serviceTypeSnapshot: usageItem.serviceType,
    shopUnitPriceSnapshot: usageItem.shopPrice,
    regularPriceSnapshot: usageItem.regularPrice,
  };
}

export async function getParticipantMeetingSurfUsageData(
  meetingId: number,
  kakaoId: string
): Promise<ParticipantMeetingSurfUsageData | null> {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: {
      id: true,
      date: true,
      endDate: true,
      endedAt: true,
      participants: {
        where: {
          status: "APPROVED",
          OR: [
            { kakaoId, companionId: null },
            { companion: { ownerKakaoId: kakaoId } },
            { companion: { linkedKakaoId: kakaoId } },
          ],
        },
        orderBy: [{ companionId: "asc" }, { submittedAt: "asc" }],
        select: {
          id: true,
          name: true,
          kakaoId: true,
          companionId: true,
          hasLesson: true,
          hasRental: true,
          hasDay2Rental: true,
          usageSubmittedAt: true,
          usageConfirmedAt: true,
          companion: {
            select: {
              ownerKakaoId: true,
              linkedKakaoId: true,
            },
          },
          surfUsages: {
            orderBy: [{ day: "asc" }, { createdAt: "asc" }],
            select: USAGE_ENTRY_SELECT,
          },
        },
      },
    },
  });

  if (!meeting) return null;

  const usageItems = await getSurfUsageItems();
  const usageOpen = isParticipantActualUsageOpen(meeting);
  const overnight = isOvernightMeeting(meeting);

  return {
    meeting: {
      id: meeting.id,
      date: meeting.date,
      usageOpen,
      days: meetingDays(meeting),
    },
    usageItems: usageItems
      .filter((item) => item.isActive)
      .map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        serviceType: asServiceType(item.serviceType),
        regularMemberUnitPrice: regularUnitPrice(item),
        companionMemberUnitPrice: item.shopPrice,
      })),
    participants: meeting.participants.map((participant) => {
      const access = getFoodOrderParticipantAccess({
        sessionKakaoId: kakaoId,
        participantKakaoId: participant.kakaoId,
        companionId: participant.companionId,
        companionOwnerKakaoId: participant.companion?.ownerKakaoId ?? null,
        companionLinkedKakaoId: participant.companion?.linkedKakaoId ?? null,
      });
      const status = getSubmissionStatus(participant);
      const canEdit = canEditParticipantUsage(kakaoId, participant);
      const canSubmit = canEdit && usageOpen && status !== "confirmed";
      const lockedReason = !usageOpen
        ? "이용 내역은 모임 기간에만 제출할 수 있습니다."
        : status === "confirmed"
          ? "샵에서 이용 내역을 확정했습니다."
          : canEdit ? null : access.lockedReason;

      return {
        participantId: participant.id,
        name: participant.name,
        companionId: participant.companionId,
        requestedOptionLabel: getRequestedOptionLabel(participant, overnight),
        requestedServiceType: getRequestedServiceType(participant),
        requestedByDay: getRequestedByDay(participant, meetingDays(meeting).length),
        canSubmit,
        roleLabel:
          access.orderRole === "owner_proxy"
            ? "미연동 · 대리입력"
            : access.orderRole === "linked_companion_locked"
              ? canEdit ? "대리입력" : "직접 입력"
              : "내 이용",
        lockedReason,
        submissionStatus: status,
        entries: participant.surfUsages.map(mapParticipantEntry),
      };
    }),
  };
}

function normalizeUsageInput(
  rawItems: unknown,
  usageItems: UsageItemRow[],
  dayCount: number,
): Array<{ usageItem: UsageItemRow; quantity: number; day: number }> {
  if (!Array.isArray(rawItems)) {
    throw new Error("items가 필요합니다.");
  }

  const itemMap = new Map(usageItems.filter((item) => item.isActive).map((item) => [item.id, item]));
  const quantityByKey = new Map<string, { usageItemId: number; day: number; quantity: number }>();

  for (const rawItem of rawItems) {
    if (!rawItem || typeof rawItem !== "object") continue;
    const usageItemId = Number((rawItem as { usageItemId?: unknown }).usageItemId);
    const quantity = Number((rawItem as { quantity?: unknown }).quantity);
    const rawDay = (rawItem as { day?: unknown }).day;
    const day = rawDay === undefined ? 1 : Number(rawDay);

    if (!Number.isInteger(usageItemId) || !itemMap.has(usageItemId)) {
      throw new Error("사용 가능한 이용 항목만 선택할 수 있습니다.");
    }
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 20) {
      throw new Error("수량은 0부터 20까지 입력할 수 있습니다.");
    }
    if (!Number.isInteger(day) || day < 1 || day > dayCount) {
      throw new Error("모임 일정 안의 날짜만 선택할 수 있습니다.");
    }

    quantityByKey.set(`${day}:${usageItemId}`, { usageItemId, day, quantity });
  }

  return Array.from(quantityByKey.values()).map(({ usageItemId, day, quantity }) => ({
    usageItem: itemMap.get(usageItemId)!,
    day,
    quantity,
  }));
}

/** 참가자의 이용 기록을 통째로 바꾸고 "기록됨·확인 필요"로 둔다. */
async function replaceParticipantUsage(input: {
  meetingId: number;
  participantId: number;
  rawItems: unknown;
  dayCount: number;
  source: "participant" | "shop";
  actorKakaoId: string | null;
}) {
  const usageItems = await getSurfUsageItems();
  const entriesToCreate = normalizeUsageInput(input.rawItems, usageItems, input.dayCount)
    .filter((item) => item.quantity > 0);

  await prisma.$transaction([
    resetShopUsageCheck(input.meetingId),
    prisma.participantSurfUsage.deleteMany({
      where: { meetingId: input.meetingId, participantId: input.participantId },
    }),
    prisma.participant.update({
      where: { id: input.participantId },
      data: { usageSubmittedAt: new Date(), usageConfirmedAt: null },
    }),
    ...(entriesToCreate.length > 0
      ? [
          prisma.participantSurfUsage.createMany({
            data: entriesToCreate.map(({ usageItem, quantity, day }) => ({
              meetingId: input.meetingId,
              participantId: input.participantId,
              day,
              usageItemId: usageItem.id,
              quantity,
              ...entrySnapshot(usageItem),
              source: input.source,
              submittedByKakaoId: input.actorKakaoId,
            })),
          }),
        ]
      : []),
  ]);
}

export async function submitParticipantSurfUsage(
  meetingId: number,
  participantId: number,
  rawItems: unknown,
  kakaoId: string
) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { id: true, date: true, endDate: true, endedAt: true, billingPublishedAt: true },
  });

  if (!meeting) {
    throw new Error("모임을 찾을 수 없습니다.");
  }

  if (!isParticipantActualUsageOpen(meeting)) {
    throw new Error("이용 내역은 모임 기간에만 제출할 수 있습니다.");
  }

  if (meeting.billingPublishedAt) {
    throw new Error("청구가 공개되어 실제 이용 내역이 잠겼습니다.");
  }

  const participant = await prisma.participant.findFirst({
    where: { id: participantId, meetingId, status: "APPROVED" },
    select: {
      id: true,
      kakaoId: true,
      companionId: true,
      usageConfirmedAt: true,
      companion: {
        select: {
          ownerKakaoId: true,
          linkedKakaoId: true,
        },
      },
    },
  });

  if (!participant) {
    throw new Error("이용 내역 제출 권한이 없습니다.");
  }

  const access = getFoodOrderParticipantAccess({
    sessionKakaoId: kakaoId,
    participantKakaoId: participant.kakaoId,
    companionId: participant.companionId,
    companionOwnerKakaoId: participant.companion?.ownerKakaoId ?? null,
    companionLinkedKakaoId: participant.companion?.linkedKakaoId ?? null,
  });

  if (!canEditParticipantUsage(kakaoId, participant)) {
    throw new Error(access.lockedReason ?? "이용 내역 제출 권한이 없습니다.");
  }

  if (participant.usageConfirmedAt) {
    throw new Error("샵에서 확정한 이용 내역은 다시 제출할 수 없습니다.");
  }

  await replaceParticipantUsage({
    meetingId,
    participantId,
    rawItems,
    dayCount: meetingDays(meeting).length,
    source: "participant",
    actorKakaoId: kakaoId,
  });
}

export async function getShopMeetingSurfUsageData(meetingId: number): Promise<ShopMeetingSurfUsageData | null> {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: {
      id: true,
      date: true,
      endDate: true,
      startTime: true,
      endTime: true,
      endedAt: true,
      location: true,
      billingPublishedAt: true,
      shopUsageCheckedAt: true,
      participants: {
        where: { status: "APPROVED" },
        orderBy: { submittedAt: "asc" },
        select: {
          id: true,
          name: true,
          companionId: true,
          hasLesson: true,
          hasRental: true,
          hasDay2Rental: true,
          usageSubmittedAt: true,
          usageConfirmedAt: true,
          surfUsages: {
            orderBy: [{ day: "asc" }, { createdAt: "asc" }],
            select: USAGE_ENTRY_SELECT,
          },
        },
      },
    },
  });

  if (!meeting) return null;

  const days = meetingDays(meeting);
  const overnight = days.length > 1;
  const usageItems = await getSurfUsageItems();
  const itemTotals = new Map<number, { quantity: number; amount: number; confirmedQuantity: number; confirmedAmount: number; confirmedQuantityByDay: number[] }>();
  let submittedShopAmount = 0;
  let confirmedShopAmount = 0;
  let submittedCount = 0;
  let reviewCount = 0;
  let confirmedCount = 0;

  const participantRows = meeting.participants.map((participant) => {
    const submissionStatus = getSubmissionStatus(participant);
    const confirmed = submissionStatus === "confirmed";
    if (submissionStatus !== "missing") submittedCount += 1;
    if (submissionStatus === "submitted") reviewCount += 1;
    if (confirmed) confirmedCount += 1;

    const entries = participant.surfUsages.map((entry) => {
      const amount = getSurfUsageLineShopAmount(entryToBillingLine(entry, participant, true));
      const existing = itemTotals.get(entry.usageItemId) ?? {
        quantity: 0,
        amount: 0,
        confirmedQuantity: 0,
        confirmedAmount: 0,
        confirmedQuantityByDay: days.map(() => 0),
      };
      existing.quantity += entry.quantity;
      existing.amount += amount;
      if (confirmed) {
        existing.confirmedQuantity += entry.quantity;
        existing.confirmedAmount += amount;
        if (existing.confirmedQuantityByDay[entry.day - 1] !== undefined) {
          existing.confirmedQuantityByDay[entry.day - 1] += entry.quantity;
        }
      }
      itemTotals.set(entry.usageItemId, existing);
      return {
        id: entry.id,
        day: entry.day,
        usageItemId: entry.usageItemId,
        usageItemName: entry.usageItemNameSnapshot,
        serviceType: asServiceType(entry.serviceTypeSnapshot),
        quantity: entry.quantity,
        shopUnitPrice: entry.shopUnitPriceSnapshot,
        amount,
        source: entry.source,
      };
    });
    const shopAmount = entries.reduce((sum, entry) => sum + entry.amount, 0);
    submittedShopAmount += shopAmount;
    if (confirmed) confirmedShopAmount += shopAmount;

    return {
      participantId: participant.id,
      participantName: participant.name,
      companionId: participant.companionId,
      requestedOptionLabel: getRequestedOptionLabel(participant, overnight),
      requestedServiceType: getRequestedServiceType(participant),
      requestedByDay: getRequestedByDay(participant, days.length),
      submissionStatus,
      submittedAt: participant.usageSubmittedAt?.toISOString() ?? null,
      confirmedAt: participant.usageConfirmedAt?.toISOString() ?? null,
      shopAmount,
      entries,
    };
  });

  // 지난 기록에만 남은 항목(이름·가격이 바뀌기 전 기록)도 합계에 보이도록 항목표에 없는 것을 덧붙인다.
  const knownItemIds = new Set(usageItems.map((item) => item.id));
  const extraItemRows = participantRows
    .flatMap((row) => row.entries)
    .filter((entry) => !knownItemIds.has(entry.usageItemId))
    .filter((entry, index, all) => all.findIndex((other) => other.usageItemId === entry.usageItemId) === index)
    .map((entry) => ({ id: entry.usageItemId, name: entry.usageItemName, serviceType: entry.serviceType }));

  return {
    meeting: {
      id: meeting.id,
      date: meeting.date,
      startTime: meeting.startTime,
      endTime: meeting.endTime,
      location: meeting.location,
      days,
      actualUsageReview: getActualUsageReviewAvailability(meeting),
      shopUsageCheckedAt: meeting.shopUsageCheckedAt?.toISOString() ?? null,
    },
    usageItems: usageItems.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      serviceType: asServiceType(item.serviceType),
      shopPrice: item.shopPrice,
      isActive: item.isActive,
      displayOrder: item.displayOrder,
    })),
    summary: {
      approvedCount: meeting.participants.length,
      submittedCount,
      missingCount: meeting.participants.length - submittedCount,
      reviewCount,
      confirmedCount,
      submittedShopAmount,
      confirmedShopAmount,
    },
    itemRows: [...usageItems, ...extraItemRows].map((item) => {
      const totals = itemTotals.get(item.id) ?? {
        quantity: 0,
        amount: 0,
        confirmedQuantity: 0,
        confirmedAmount: 0,
        confirmedQuantityByDay: days.map(() => 0),
      };
      return {
        usageItemId: item.id,
        name: item.name,
        serviceType: asServiceType(item.serviceType),
        ...totals,
      };
    }),
    participantRows,
  };
}

/** 이용 내역이 바뀌면 샵의 수량 확인을 다시 받아야 한다. */
function resetShopUsageCheck(meetingId: number) {
  return prisma.meeting.updateMany({
    where: { id: meetingId, shopUsageCheckedAt: { not: null } },
    data: { shopUsageCheckedAt: null, shopUsageCheckedByKakaoId: null },
  });
}

export async function markShopUsageChecked(meetingId: number, actorKakaoId: string | null) {
  await requireActualUsageReviewOpen(meetingId);
  const pending = await prisma.participant.count({
    where: { meetingId, status: "APPROVED", absentAt: null, usageConfirmedAt: null },
  });
  if (pending > 0) throw new Error("확정되지 않은 이용 내역이 있어 수량을 확인할 수 없습니다.");
  await prisma.meeting.update({
    where: { id: meetingId },
    data: { shopUsageCheckedAt: new Date(), shopUsageCheckedByKakaoId: actorKakaoId },
  });
}

async function requireActualUsageReviewOpen(meetingId: number) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: {
      date: true,
      endDate: true,
      endTime: true,
      endedAt: true,
      billingPublishedAt: true,
    },
  });

  if (!meeting) throw new Error("모임을 찾을 수 없습니다.");

  const availability = getActualUsageReviewAvailability(meeting);
  if (!availability.editable) throw new Error(availability.reason);
  return meeting;
}

export async function saveShopParticipantSurfUsage(
  meetingId: number,
  participantId: number,
  rawItems: unknown,
  actorKakaoId: string | null
) {
  const meeting = await requireActualUsageReviewOpen(meetingId);

  const participant = await prisma.participant.findFirst({
    where: { id: participantId, meetingId, status: "APPROVED" },
    select: { id: true },
  });

  if (!participant) {
    throw new Error("참가자를 찾을 수 없습니다.");
  }

  await replaceParticipantUsage({
    meetingId,
    participantId,
    rawItems,
    dayCount: meetingDays(meeting).length,
    source: "shop",
    actorKakaoId,
  });
}

export async function confirmShopParticipantSurfUsage(meetingId: number, participantId: number) {
  await requireActualUsageReviewOpen(meetingId);

  const participant = await prisma.participant.findFirst({
    where: { id: participantId, meetingId, status: "APPROVED" },
    select: { id: true, usageSubmittedAt: true },
  });

  if (!participant) {
    throw new Error("참가자를 찾을 수 없습니다.");
  }

  const now = new Date();
  await prisma.$transaction([
    resetShopUsageCheck(meetingId),
    prisma.participant.update({
      where: { id: participantId },
      data: { usageSubmittedAt: participant.usageSubmittedAt ?? now, usageConfirmedAt: now },
    }),
  ]);
}

/**
 * 아직 이용 기록이 없는 참가자를 신청 내용으로 채우고 확정한다.
 * 첫날: 강습 → 강습 패키지, 장비 대여 필요 → 장비대여. 1박 둘째 날: 둘째 날 장비 대여 필요 → 장비대여.
 * 운영진은 이후 다르게 이용한 사람만 고친다. 불참자와 이미 기록된 참가자는 건드리지 않는다.
 * 채운 참가자 수를 반환한다.
 */
export async function fillMissingSurfUsageFromSignup(meetingId: number, actorKakaoId: string | null): Promise<number> {
  const meeting = await requireActualUsageReviewOpen(meetingId);
  const dayCount = meetingDays(meeting).length;

  const [usageItems, participants] = await Promise.all([
    getSurfUsageItems(),
    prisma.participant.findMany({
      where: {
        meetingId,
        status: "APPROVED",
        absentAt: null,
        usageSubmittedAt: null,
        usageConfirmedAt: null,
      },
      select: { id: true, hasLesson: true, hasRental: true, hasDay2Rental: true },
    }),
  ]);
  if (participants.length === 0) return 0;

  const itemFor = (serviceType: SurfUsageServiceType) =>
    usageItems.find((item) => item.isActive && item.serviceType === serviceType) ?? null;

  const now = new Date();
  await resetShopUsageCheck(meetingId);
  return prisma.$transaction(async (tx) => {
    let filled = 0;
    for (const participant of participants) {
      // 다른 운영진이 그사이 기록했다면 건너뛴다.
      const { count } = await tx.participant.updateMany({
        where: { id: participant.id, usageSubmittedAt: null, usageConfirmedAt: null },
        data: { usageSubmittedAt: now, usageConfirmedAt: now },
      });
      if (count === 0) continue;
      filled += 1;

      const planned = getRequestedByDay(participant, dayCount);
      for (const [index, serviceType] of planned.entries()) {
        const day = index + 1;
        const usageItem = serviceType ? itemFor(serviceType) : null;
        if (!usageItem) continue;
        await tx.participantSurfUsage.create({
          data: {
            meetingId,
            participantId: participant.id,
            day,
            usageItemId: usageItem.id,
            quantity: 1,
            ...entrySnapshot(usageItem),
            source: "signup",
            submittedByKakaoId: actorKakaoId,
          },
        });
      }
    }
    return filled;
  });
}

/** 이용 항목표 저장. 모든 모임 공통이며 이미 기록된 이용은 기록 시점 가격을 유지한다. */
export async function saveShopSurfUsageCatalog(rawItems: SurfUsageCatalogInput[]) {
  if (!Array.isArray(rawItems)) {
    throw new Error("items가 필요합니다.");
  }

  await getSurfUsageItems();
  const currentItems = await prisma.surfUsageItem.findMany({
    select: { id: true, displayOrder: true },
    orderBy: { displayOrder: "desc" },
  });
  const currentIds = new Set(currentItems.map((item) => item.id));
  let nextDisplayOrder = (currentItems[0]?.displayOrder ?? 0) + 10;

  for (const rawItem of rawItems) {
    const id = rawItem.id === undefined ? null : Number(rawItem.id);
    const name = String(rawItem.name ?? "").trim().slice(0, 40);
    const shopPrice = Number(rawItem.shopPrice);
    const description = rawItem.description === undefined || rawItem.description === null
      ? null
      : String(rawItem.description).trim().slice(0, 80) || null;

    if (!name) throw new Error("항목 이름을 입력해 주세요.");
    if (!Number.isInteger(shopPrice) || shopPrice < 0 || shopPrice > 1000000) {
      throw new Error("샵 가격은 0원부터 1,000,000원까지 입력할 수 있습니다.");
    }

    if (id && currentIds.has(id)) {
      await prisma.surfUsageItem.update({
        where: { id },
        data: {
          name,
          description,
          shopPrice,
          isActive: rawItem.isActive ?? true,
        },
      });
    } else {
      // 샵에서 새로 만든 항목은 정회원도 샵 가격을 낸다.
      await prisma.surfUsageItem.create({
        data: {
          name,
          description,
          shopPrice,
          serviceType: "CUSTOM",
          regularPrice: null,
          isActive: true,
          displayOrder: nextDisplayOrder,
        },
      });
      nextDisplayOrder += 10;
    }
  }
}

/** 청구 계산용: 참가자별 이용 기록. 확정된 참가자의 기록만 청구에 반영된다. */
export async function getConfirmedSurfUsageBillingByParticipant(meetingId: number) {
  const participants = await prisma.participant.findMany({
    where: { meetingId, status: "APPROVED" },
    select: {
      id: true,
      companionId: true,
      usageConfirmedAt: true,
      surfUsages: {
        orderBy: [{ day: "asc" }, { createdAt: "asc" }],
        select: USAGE_ENTRY_SELECT,
      },
    },
  });

  const billingMap = new Map<number, SurfUsageBillingLine[]>();
  const confirmedParticipantIds = new Set<number>();
  const allLines: SurfUsageBillingLine[] = [];

  for (const participant of participants) {
    const confirmed = participant.usageConfirmedAt !== null;
    if (confirmed) confirmedParticipantIds.add(participant.id);
    const lines = participant.surfUsages.map((entry) => entryToBillingLine(entry, participant, confirmed));
    billingMap.set(participant.id, lines);
    allLines.push(...lines);
  }

  return {
    billingMap,
    confirmedParticipantIds,
    summary: summarizeUsageBilling(allLines),
  };
}
