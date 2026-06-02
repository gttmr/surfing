import { prisma } from "@/lib/db";
import {
  getFoodOrderParticipantAccess,
  isMeetingOrderOpen,
} from "@/lib/food-ordering";
import {
  DEFAULT_SURF_USAGE_ITEMS,
  calculateUsageBillingForParticipant,
  getSurfUsageLineShopAmount,
  summarizeUsageBilling,
  type SurfUsageBillingLine,
  type SurfUsageMemberBillingPolicy,
  type SurfUsageServiceType,
} from "@/lib/surf-usage-billing";

type UsageItemRow = {
  id: number;
  name: string;
  description: string | null;
  serviceType: string;
  shopPrice: number;
  memberBillingPolicy: string;
  regularMemberPrice: number;
  isDefault: boolean;
  isActive: boolean;
  displayOrder: number;
};

type UsageEntryRow = {
  id: number;
  participantId: number;
  usageItemId: number;
  quantity: number;
  usageItemNameSnapshot: string;
  serviceTypeSnapshot: string;
  shopUnitPriceSnapshot: number;
  memberBillingPolicySnapshot: string;
  regularMemberPriceSnapshot: number;
  source: string;
  submittedByKakaoId: string | null;
  note: string | null;
  createdAt: Date;
};

type UsageSubmissionRow = {
  status: string;
  submittedByKakaoId: string | null;
  submittedAt: Date;
  confirmedAt: Date | null;
  confirmedByKakaoId: string | null;
  note: string | null;
};

export type ParticipantMeetingSurfUsageData = {
  meeting: {
    id: number;
    date: string;
    usageOpen: boolean;
  };
  usageItems: Array<{
    id: number;
    name: string;
    description: string | null;
    serviceType: SurfUsageServiceType;
  }>;
  participants: Array<{
    participantId: number;
    name: string;
    companionId: number | null;
    canSubmit: boolean;
    roleLabel: string;
    lockedReason: string | null;
    submissionStatus: "missing" | "submitted" | "confirmed";
    entries: Array<{
      id: number;
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
  };
  usageItems: Array<{
    id: number;
    name: string;
    description: string | null;
    serviceType: SurfUsageServiceType;
    shopPrice: number;
    isDefault: boolean;
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
  }>;
  participantRows: Array<{
    participantId: number;
    participantName: string;
    companionId: number | null;
    requestedOptionLabel: string;
    submissionStatus: "missing" | "submitted" | "confirmed";
    submittedAt: string | null;
    confirmedAt: string | null;
    shopAmount: number;
    entries: Array<{
      id: number;
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

function asBillingPolicy(value: string): SurfUsageMemberBillingPolicy {
  if (
    value === "REGULAR_FIXED_COMPANION_SHOP" ||
    value === "REGULAR_FREE_COMPANION_SHOP" ||
    value === "ALL_SHOP"
  ) {
    return value;
  }
  return "ALL_SHOP";
}

function getParticipantType(companionId: number | null) {
  return companionId === null ? "REGULAR" : "COMPANION";
}

function getRequestedOptionLabel(participant: { hasLesson: boolean; hasRental: boolean }) {
  if (participant.hasLesson) return "신청: 강습+장비";
  if (participant.hasRental) return "신청: 장비만";
  return "신청: 참가만";
}

function getSubmissionStatus(submission: UsageSubmissionRow | null): "missing" | "submitted" | "confirmed" {
  if (!submission) return "missing";
  return submission.status === "CONFIRMED" ? "confirmed" : "submitted";
}

function entryToBillingLine(
  entry: UsageEntryRow,
  participant: { companionId: number | null },
  confirmed: boolean
): SurfUsageBillingLine {
  return {
    id: entry.id,
    participantId: entry.participantId,
    participantType: getParticipantType(participant.companionId),
    usageItemId: entry.usageItemId,
    usageItemName: entry.usageItemNameSnapshot,
    serviceType: asServiceType(entry.serviceTypeSnapshot),
    quantity: entry.quantity,
    shopUnitPrice: entry.shopUnitPriceSnapshot,
    memberBillingPolicy: asBillingPolicy(entry.memberBillingPolicySnapshot),
    regularMemberUnitPrice: entry.regularMemberPriceSnapshot,
    confirmed,
  };
}

function mapParticipantEntry(entry: UsageEntryRow) {
  return {
    id: entry.id,
    usageItemId: entry.usageItemId,
    usageItemName: entry.usageItemNameSnapshot,
    serviceType: asServiceType(entry.serviceTypeSnapshot),
    quantity: entry.quantity,
    source: entry.source,
  };
}

async function ensureMeetingSurfUsageItems(meetingId: number): Promise<UsageItemRow[]> {
  const existing = await prisma.surfUsageItem.findMany({
    where: { meetingId },
    orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      serviceType: true,
      shopPrice: true,
      memberBillingPolicy: true,
      regularMemberPrice: true,
      isDefault: true,
      isActive: true,
      displayOrder: true,
    },
  });

  if (existing.length > 0) return existing;

  await prisma.surfUsageItem.createMany({
    data: DEFAULT_SURF_USAGE_ITEMS.map((item) => ({
      meetingId,
      name: item.name,
      description: item.description,
      serviceType: item.serviceType,
      shopPrice: item.shopPrice,
      memberBillingPolicy: item.memberBillingPolicy,
      regularMemberPrice: item.regularMemberPrice,
      isDefault: true,
      isActive: true,
      displayOrder: item.displayOrder,
    })),
  });

  return prisma.surfUsageItem.findMany({
    where: { meetingId },
    orderBy: [{ displayOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      description: true,
      serviceType: true,
      shopPrice: true,
      memberBillingPolicy: true,
      regularMemberPrice: true,
      isDefault: true,
      isActive: true,
      displayOrder: true,
    },
  });
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
          companion: {
            select: {
              ownerKakaoId: true,
              linkedKakaoId: true,
            },
          },
          surfUsages: {
            where: { meetingId },
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              participantId: true,
              usageItemId: true,
              quantity: true,
              usageItemNameSnapshot: true,
              serviceTypeSnapshot: true,
              shopUnitPriceSnapshot: true,
              memberBillingPolicySnapshot: true,
              regularMemberPriceSnapshot: true,
              source: true,
              submittedByKakaoId: true,
              note: true,
              createdAt: true,
            },
          },
          surfUsageSubmissions: {
            where: { meetingId },
            select: {
              status: true,
              submittedByKakaoId: true,
              submittedAt: true,
              confirmedAt: true,
              confirmedByKakaoId: true,
              note: true,
            },
          },
        },
      },
    },
  });

  if (!meeting) return null;

  const usageItems = await ensureMeetingSurfUsageItems(meetingId);
  const usageOpen = isMeetingOrderOpen(meeting.date);

  return {
    meeting: {
      id: meeting.id,
      date: meeting.date,
      usageOpen,
    },
    usageItems: usageItems
      .filter((item) => item.isActive)
      .map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        serviceType: asServiceType(item.serviceType),
      })),
    participants: meeting.participants.map((participant) => {
      const access = getFoodOrderParticipantAccess({
        sessionKakaoId: kakaoId,
        participantKakaoId: participant.kakaoId,
        companionId: participant.companionId,
        companionOwnerKakaoId: participant.companion?.ownerKakaoId ?? null,
        companionLinkedKakaoId: participant.companion?.linkedKakaoId ?? null,
      });
      const submission = participant.surfUsageSubmissions[0] ?? null;
      const status = getSubmissionStatus(submission);
      const canSubmit = access.canOrder && usageOpen && status !== "confirmed";
      const lockedReason = !usageOpen
        ? "이용 내역은 모임 당일에만 제출할 수 있습니다."
        : status === "confirmed"
          ? "샵에서 이용 내역을 확정했습니다."
          : access.lockedReason;

      return {
        participantId: participant.id,
        name: participant.name,
        companionId: participant.companionId,
        canSubmit,
        roleLabel:
          access.orderRole === "owner_proxy"
            ? "미연동 · 대리입력"
            : access.orderRole === "linked_companion_locked"
              ? "직접 입력"
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
  usageItems: UsageItemRow[]
): Array<{ usageItem: UsageItemRow; quantity: number }> {
  if (!Array.isArray(rawItems)) {
    throw new Error("items가 필요합니다.");
  }

  const itemMap = new Map(usageItems.filter((item) => item.isActive).map((item) => [item.id, item]));
  const quantityByItemId = new Map<number, number>();

  for (const rawItem of rawItems) {
    if (!rawItem || typeof rawItem !== "object") continue;
    const usageItemId = Number((rawItem as { usageItemId?: unknown }).usageItemId);
    const quantity = Number((rawItem as { quantity?: unknown }).quantity);

    if (!Number.isInteger(usageItemId) || !itemMap.has(usageItemId)) {
      throw new Error("사용 가능한 이용 항목만 선택할 수 있습니다.");
    }
    if (!Number.isInteger(quantity) || quantity < 0 || quantity > 20) {
      throw new Error("수량은 0부터 20까지 입력할 수 있습니다.");
    }

    quantityByItemId.set(usageItemId, quantity);
  }

  return Array.from(quantityByItemId.entries()).map(([usageItemId, quantity]) => ({
    usageItem: itemMap.get(usageItemId)!,
    quantity,
  }));
}

export async function submitParticipantSurfUsage(
  meetingId: number,
  participantId: number,
  rawItems: unknown,
  kakaoId: string
) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: {
      id: true,
      date: true,
    },
  });

  if (!meeting) {
    throw new Error("모임을 찾을 수 없습니다.");
  }

  if (!isMeetingOrderOpen(meeting.date)) {
    throw new Error("이용 내역은 모임 당일에만 제출할 수 있습니다.");
  }

  const participant = await prisma.participant.findFirst({
    where: { id: participantId, meetingId, status: "APPROVED" },
    select: {
      id: true,
      kakaoId: true,
      companionId: true,
      companion: {
        select: {
          ownerKakaoId: true,
          linkedKakaoId: true,
        },
      },
      surfUsageSubmissions: {
        where: { meetingId },
        select: { status: true },
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

  if (!access.canOrder) {
    throw new Error(access.lockedReason ?? "이용 내역 제출 권한이 없습니다.");
  }

  if (participant.surfUsageSubmissions[0]?.status === "CONFIRMED") {
    throw new Error("샵에서 확정한 이용 내역은 다시 제출할 수 없습니다.");
  }

  const usageItems = await ensureMeetingSurfUsageItems(meetingId);
  const normalizedItems = normalizeUsageInput(rawItems, usageItems);
  const entriesToCreate = normalizedItems.filter((item) => item.quantity > 0);

  await prisma.$transaction([
    prisma.participantSurfUsage.deleteMany({
      where: { meetingId, participantId },
    }),
    prisma.participantSurfUsageSubmission.upsert({
      where: { meetingId_participantId: { meetingId, participantId } },
      update: {
        status: "SUBMITTED",
        submittedByKakaoId: kakaoId,
        submittedAt: new Date(),
        confirmedAt: null,
        confirmedByKakaoId: null,
      },
      create: {
        meetingId,
        participantId,
        status: "SUBMITTED",
        submittedByKakaoId: kakaoId,
      },
    }),
    ...(entriesToCreate.length > 0
      ? [
          prisma.participantSurfUsage.createMany({
            data: entriesToCreate.map(({ usageItem, quantity }) => ({
              meetingId,
              participantId,
              usageItemId: usageItem.id,
              quantity,
              usageItemNameSnapshot: usageItem.name,
              serviceTypeSnapshot: usageItem.serviceType,
              shopUnitPriceSnapshot: usageItem.shopPrice,
              memberBillingPolicySnapshot: usageItem.memberBillingPolicy,
              regularMemberPriceSnapshot: usageItem.regularMemberPrice,
              source: "participant",
              submittedByKakaoId: kakaoId,
            })),
          }),
        ]
      : []),
  ]);
}

export async function getShopMeetingSurfUsageData(meetingId: number): Promise<ShopMeetingSurfUsageData | null> {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: {
      id: true,
      date: true,
      startTime: true,
      endTime: true,
      location: true,
      participants: {
        where: { status: "APPROVED" },
        orderBy: { submittedAt: "asc" },
        select: {
          id: true,
          name: true,
          companionId: true,
          hasLesson: true,
          hasRental: true,
          surfUsages: {
            where: { meetingId },
            orderBy: { createdAt: "asc" },
            select: {
              id: true,
              participantId: true,
              usageItemId: true,
              quantity: true,
              usageItemNameSnapshot: true,
              serviceTypeSnapshot: true,
              shopUnitPriceSnapshot: true,
              memberBillingPolicySnapshot: true,
              regularMemberPriceSnapshot: true,
              source: true,
              submittedByKakaoId: true,
              note: true,
              createdAt: true,
            },
          },
          surfUsageSubmissions: {
            where: { meetingId },
            select: {
              status: true,
              submittedByKakaoId: true,
              submittedAt: true,
              confirmedAt: true,
              confirmedByKakaoId: true,
              note: true,
            },
          },
        },
      },
    },
  });

  if (!meeting) return null;

  const usageItems = await ensureMeetingSurfUsageItems(meetingId);
  const itemTotals = new Map<number, { quantity: number; amount: number; confirmedQuantity: number; confirmedAmount: number }>();
  let submittedShopAmount = 0;
  let confirmedShopAmount = 0;
  let submittedCount = 0;
  let reviewCount = 0;
  let confirmedCount = 0;

  const participantRows = meeting.participants.map((participant) => {
    const submission = participant.surfUsageSubmissions[0] ?? null;
    const submissionStatus = getSubmissionStatus(submission);
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
      };
      existing.quantity += entry.quantity;
      existing.amount += amount;
      if (confirmed) {
        existing.confirmedQuantity += entry.quantity;
        existing.confirmedAmount += amount;
      }
      itemTotals.set(entry.usageItemId, existing);
      return {
        id: entry.id,
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
      requestedOptionLabel: getRequestedOptionLabel(participant),
      submissionStatus,
      submittedAt: submission?.submittedAt.toISOString() ?? null,
      confirmedAt: submission?.confirmedAt?.toISOString() ?? null,
      shopAmount,
      entries,
    };
  });

  return {
    meeting: {
      id: meeting.id,
      date: meeting.date,
      startTime: meeting.startTime,
      endTime: meeting.endTime,
      location: meeting.location,
    },
    usageItems: usageItems.map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      serviceType: asServiceType(item.serviceType),
      shopPrice: item.shopPrice,
      isDefault: item.isDefault,
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
    itemRows: usageItems.map((item) => {
      const totals = itemTotals.get(item.id) ?? { quantity: 0, amount: 0, confirmedQuantity: 0, confirmedAmount: 0 };
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

export async function saveShopParticipantSurfUsage(
  meetingId: number,
  participantId: number,
  rawItems: unknown,
  actorKakaoId: string | null
) {
  const participant = await prisma.participant.findFirst({
    where: { id: participantId, meetingId, status: "APPROVED" },
    select: { id: true },
  });

  if (!participant) {
    throw new Error("참가자를 찾을 수 없습니다.");
  }

  const usageItems = await ensureMeetingSurfUsageItems(meetingId);
  const normalizedItems = normalizeUsageInput(rawItems, usageItems);
  const entriesToCreate = normalizedItems.filter((item) => item.quantity > 0);

  await prisma.$transaction([
    prisma.participantSurfUsage.deleteMany({
      where: { meetingId, participantId },
    }),
    prisma.participantSurfUsageSubmission.upsert({
      where: { meetingId_participantId: { meetingId, participantId } },
      update: {
        status: "SUBMITTED",
        submittedByKakaoId: actorKakaoId,
        submittedAt: new Date(),
        confirmedAt: null,
        confirmedByKakaoId: null,
      },
      create: {
        meetingId,
        participantId,
        status: "SUBMITTED",
        submittedByKakaoId: actorKakaoId,
      },
    }),
    ...(entriesToCreate.length > 0
      ? [
          prisma.participantSurfUsage.createMany({
            data: entriesToCreate.map(({ usageItem, quantity }) => ({
              meetingId,
              participantId,
              usageItemId: usageItem.id,
              quantity,
              usageItemNameSnapshot: usageItem.name,
              serviceTypeSnapshot: usageItem.serviceType,
              shopUnitPriceSnapshot: usageItem.shopPrice,
              memberBillingPolicySnapshot: usageItem.memberBillingPolicy,
              regularMemberPriceSnapshot: usageItem.regularMemberPrice,
              source: "shop",
              submittedByKakaoId: actorKakaoId,
            })),
          }),
        ]
      : []),
  ]);
}

export async function confirmShopParticipantSurfUsage(
  meetingId: number,
  participantId: number,
  actorKakaoId: string | null
) {
  const participant = await prisma.participant.findFirst({
    where: { id: participantId, meetingId, status: "APPROVED" },
    select: { id: true },
  });

  if (!participant) {
    throw new Error("참가자를 찾을 수 없습니다.");
  }

  await prisma.participantSurfUsageSubmission.upsert({
    where: { meetingId_participantId: { meetingId, participantId } },
    update: {
      status: "CONFIRMED",
      confirmedAt: new Date(),
      confirmedByKakaoId: actorKakaoId,
    },
    create: {
      meetingId,
      participantId,
      status: "CONFIRMED",
      submittedByKakaoId: actorKakaoId,
      confirmedAt: new Date(),
      confirmedByKakaoId: actorKakaoId,
    },
  });
}

export async function saveShopSurfUsageCatalog(
  meetingId: number,
  rawItems: SurfUsageCatalogInput[],
  actorKakaoId: string | null
) {
  if (!Array.isArray(rawItems)) {
    throw new Error("items가 필요합니다.");
  }

  await ensureMeetingSurfUsageItems(meetingId);

  const currentItems = await prisma.surfUsageItem.findMany({
    where: { meetingId },
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
      await prisma.surfUsageItem.create({
        data: {
          meetingId,
          name,
          description,
          shopPrice,
          serviceType: "CUSTOM",
          memberBillingPolicy: "ALL_SHOP",
          regularMemberPrice: 0,
          isDefault: false,
          isActive: true,
          displayOrder: nextDisplayOrder,
          createdByKakaoId: actorKakaoId,
        },
      });
      nextDisplayOrder += 10;
    }
  }
}

export async function getConfirmedSurfUsageBillingByParticipant(meetingId: number) {
  const participants = await prisma.participant.findMany({
    where: { meetingId, status: "APPROVED" },
    select: {
      id: true,
      companionId: true,
      surfUsages: {
        where: { meetingId },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          participantId: true,
          usageItemId: true,
          quantity: true,
          usageItemNameSnapshot: true,
          serviceTypeSnapshot: true,
          shopUnitPriceSnapshot: true,
          memberBillingPolicySnapshot: true,
          regularMemberPriceSnapshot: true,
          source: true,
          submittedByKakaoId: true,
          note: true,
          createdAt: true,
        },
      },
      surfUsageSubmissions: {
        where: { meetingId, status: "CONFIRMED" },
        select: { id: true },
      },
    },
  });

  const billingMap = new Map<number, SurfUsageBillingLine[]>();
  const confirmedParticipantIds = new Set<number>();
  const allLines: SurfUsageBillingLine[] = [];

  for (const participant of participants) {
    const confirmed = participant.surfUsageSubmissions.length > 0;
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

export function calculateConfirmedUsageBilling(lines: SurfUsageBillingLine[]) {
  return calculateUsageBillingForParticipant(lines);
}
