import { prisma } from "@/lib/db";
import { getFoodOrderSummary, parseAmount, type FoodOrderItemSnapshot } from "@/lib/food-ordering";
import { dayIndexForDate, meetingDays, seoulDateOf, type MeetingSchedule } from "@/lib/meeting-days";
import { DEFAULT_FOOD_ORDER_SUPPORT_CAP, DEFAULT_PRICING_SETTINGS, FOOD_ORDER_SUPPORT_CAP_KEY, PRICING_SETTING_KEYS, type PricingSettingKey } from "@/lib/settings";
import { calculateUsageBillingForParticipant, type SurfUsageBillingLine } from "@/lib/surf-usage-billing";

export type PricingConfig = Record<PricingSettingKey, number>;

export interface SettlementParticipantInput {
  id: number;
  name: string;
  kakaoId: string;
  usesClubLodging?: boolean;
  companionId: number | null;
  user?: {
    memberType: string;
    name: string | null;
  } | null;
  companion?: {
    id: number;
    name: string;
    ownerKakaoId: string;
    linkedKakaoId: string | null;
    owner?: {
      kakaoId: string;
      name: string | null;
    } | null;
  } | null;
}

export interface ParticipantChargeBreakdown {
  baseFee: number;
  lodgingFee: number;
  /** 예전 청구 기록(신청 기준 강습비) 호환용. 새 계산은 실제 이용으로만 청구하므로 0 */
  lessonFee: number;
  /** 예전 청구 기록(신청 기준 대여비) 호환용. 새 계산은 0 */
  rentalFee: number;
  surfUsageShopFee: number;
  surfUsageMemberFee: number;
  surfUsageCoveredFee: number;
  adjustmentFee: number;
  foodSubtotal: number;
  foodSupportApplied: number;
  foodCharge: number;
  totalFee: number;
}

export interface SettlementLineItem extends ParticipantChargeBreakdown {
  participantId: number;
  participantName: string;
  recipientType: "self" | "linked_companion" | "owner";
  memberType: "REGULAR" | "COMPANION";
  companionId: number | null;
  adjustments: { id: number; label: string; amount: number }[];
  foodOrders: FoodOrderItemSnapshot[];
  surfUsageLines: SurfUsageBillingLine[];
  dailyBreakdowns?: Array<{
    meetingId: number;
    date: string;
    label: string;
    lessonFee: number;
    rentalFee: number;
    surfUsageMemberFee: number;
    surfUsageShopFee: number;
    surfUsageCoveredFee: number;
    foodSubtotal: number;
    foodSupportApplied: number;
    foodCharge: number;
    adjustmentFee: number;
    totalFee: number;
    adjustments: { id: number; label: string; amount: number }[];
    foodOrders: FoodOrderItemSnapshot[];
    surfUsageLines: SurfUsageBillingLine[];
  }>;
}

export interface SettlementRecipientGroup {
  recipientKakaoId: string;
  recipientName: string;
  recipientType: "self" | "linked_companion" | "owner";
  items: SettlementLineItem[];
  totalFee: number;
}

/** 청구 계산에 필요한 모임 정보: 일정과 모임별 참가비·숙박비 */
export type SettlementMeetingInput = MeetingSchedule & {
  id: number;
  regularFee: number;
  companionFee: number;
  lodgingFee: number;
};

function buildPricingConfig(map: Map<string, string>): PricingConfig {
  return {
    [PRICING_SETTING_KEYS.regularBaseFee]: parseAmount(map.get(PRICING_SETTING_KEYS.regularBaseFee) ?? DEFAULT_PRICING_SETTINGS[PRICING_SETTING_KEYS.regularBaseFee]),
    [PRICING_SETTING_KEYS.companionBaseFee]: parseAmount(map.get(PRICING_SETTING_KEYS.companionBaseFee) ?? DEFAULT_PRICING_SETTINGS[PRICING_SETTING_KEYS.companionBaseFee]),
  };
}

/** 새 모임에 미리 채울 기본 참가비 */
export async function getPricingConfig(): Promise<PricingConfig> {
  const keys = Object.values(PRICING_SETTING_KEYS);
  const rows = await prisma.setting.findMany({
    where: { key: { in: keys } },
  });

  return buildPricingConfig(new Map(rows.map((row) => [row.key, row.value])));
}

export async function getFoodSupportCap(): Promise<number> {
  const row = await prisma.setting.findUnique({ where: { key: FOOD_ORDER_SUPPORT_CAP_KEY } });
  return parseAmount(row?.value ?? DEFAULT_FOOD_ORDER_SUPPORT_CAP);
}

type ParticipantAdjustment = { id: number; label: string; amount: number };

/**
 * 정회원 장비 대여 지원은 장비(강습 포함)를 처음 쓴 날 하루만 적용한다. 그 뒤 날의 장비 대여는 샵 가격이다.
 * 당일 모임은 하루뿐이라 영향이 없다.
 */
function applyFirstDayEquipmentSupport(
  lines: readonly SurfUsageBillingLine[],
  isRegular: boolean,
): SurfUsageBillingLine[] {
  if (!isRegular) return [...lines];
  const usedEquipmentDays = lines
    .filter((line) => line.confirmed && line.quantity > 0
      && (line.serviceType === "EQUIPMENT_RENTAL" || line.serviceType === "LESSON_PACKAGE"))
    .map((line) => line.day);
  const supportDay = usedEquipmentDays.length > 0 ? Math.min(...usedEquipmentDays) : null;
  return lines.map((line) => (
    supportDay !== null && line.day > supportDay && line.confirmed && line.quantity > 0 && line.serviceType === "EQUIPMENT_RENTAL"
      ? { ...line, memberBillingPolicy: "ALL_SHOP" as const, regularMemberUnitPrice: 0 }
      : line
  ));
}

function foodDay(meeting: MeetingSchedule, item: FoodOrderItemSnapshot): number {
  return item.createdAt ? dayIndexForDate(meeting, seoulDateOf(item.createdAt)) : 1;
}

/** 참가자 한 명의 청구. 식음료 지원 한도는 하루마다 적용한다. */
export function getParticipantChargeBreakdown(
  meeting: SettlementMeetingInput,
  participant: Pick<SettlementParticipantInput, "companionId" | "usesClubLodging">,
  adjustments: readonly ParticipantAdjustment[],
  foodOrders: readonly FoodOrderItemSnapshot[],
  foodSupportCap: number,
  surfUsageLines: readonly SurfUsageBillingLine[],
): ParticipantChargeBreakdown & {
  surfUsageLines: SurfUsageBillingLine[];
  dailyBreakdowns?: SettlementLineItem["dailyBreakdowns"];
} {
  const isRegular = participant.companionId === null;
  const days = meetingDays(meeting);
  const lines = applyFirstDayEquipmentSupport(surfUsageLines, isRegular);
  const baseFee = isRegular ? meeting.regularFee : meeting.companionFee;
  const lodgingFee = participant.usesClubLodging ? Math.max(0, meeting.lodgingFee) : 0;
  const adjustmentFee = adjustments.reduce((sum, adjustment) => sum + adjustment.amount, 0);

  const perDay = days.map((day) => {
    const dayLines = lines.filter((line) => line.day === day.dayIndex);
    const dayFood = foodOrders.filter((item) => foodDay(meeting, item) === day.dayIndex);
    const usage = calculateUsageBillingForParticipant(dayLines);
    const food = getFoodOrderSummary(dayFood, foodSupportCap);
    return { day, dayLines, dayFood, usage, food };
  });
  const sum = (pick: (day: (typeof perDay)[number]) => number) => perDay.reduce((total, day) => total + pick(day), 0);

  const surfUsageMemberFee = sum((day) => day.usage.memberChargeAmount);
  const foodCharge = sum((day) => day.food.billableAmount);
  const breakdown: ParticipantChargeBreakdown = {
    baseFee,
    lodgingFee,
    lessonFee: 0,
    rentalFee: 0,
    surfUsageShopFee: sum((day) => day.usage.shopChargeAmount),
    surfUsageMemberFee,
    surfUsageCoveredFee: sum((day) => day.usage.operationsCoveredAmount),
    adjustmentFee,
    foodSubtotal: sum((day) => day.food.subtotal),
    foodSupportApplied: sum((day) => day.food.supportApplied),
    foodCharge,
    totalFee: baseFee + lodgingFee + surfUsageMemberFee + adjustmentFee + foodCharge,
  };

  if (days.length === 1) return { ...breakdown, surfUsageLines: lines };

  // 1박은 날짜별 내역도 함께 보여 준다. 조정 금액은 일정 전체에 한 번 붙으므로 첫날에 둔다.
  const dailyBreakdowns = perDay.map(({ day, dayLines, dayFood, usage, food }) => {
    const dayAdjustments = day.dayIndex === 1 ? [...adjustments] : [];
    const dayAdjustmentFee = day.dayIndex === 1 ? adjustmentFee : 0;
    return {
      meetingId: meeting.id,
      date: day.date,
      label: `${day.dayIndex}일차`,
      lessonFee: 0,
      rentalFee: 0,
      surfUsageMemberFee: usage.memberChargeAmount,
      surfUsageShopFee: usage.shopChargeAmount,
      surfUsageCoveredFee: usage.operationsCoveredAmount,
      foodSubtotal: food.subtotal,
      foodSupportApplied: food.supportApplied,
      foodCharge: food.billableAmount,
      adjustmentFee: dayAdjustmentFee,
      totalFee: usage.memberChargeAmount + food.billableAmount + dayAdjustmentFee,
      adjustments: dayAdjustments,
      foodOrders: dayFood,
      surfUsageLines: dayLines,
    };
  });
  return { ...breakdown, surfUsageLines: lines, dailyBreakdowns };
}

/** 참가자별 청구를 낼 사람(본인, 연동된 동반인, 동반인을 등록한 정회원)별로 묶는다. */
export function groupParticipantsForSettlement(
  meeting: SettlementMeetingInput,
  participants: readonly SettlementParticipantInput[],
  adjustmentMap: ReadonlyMap<number, ParticipantAdjustment[]> = new Map(),
  foodOrderMap: ReadonlyMap<number, FoodOrderItemSnapshot[]> = new Map(),
  foodSupportCap = 0,
  surfUsageMap: ReadonlyMap<number, SurfUsageBillingLine[]> = new Map(),
): SettlementRecipientGroup[] {
  const groups = new Map<string, SettlementRecipientGroup>();

  for (const participant of participants) {
    const isCompanion = participant.companionId !== null;
    const adjustments = adjustmentMap.get(participant.id) ?? [];
    const foodOrders = foodOrderMap.get(participant.id) ?? [];
    const { surfUsageLines, dailyBreakdowns, ...breakdown } = getParticipantChargeBreakdown(
      meeting,
      participant,
      adjustments,
      foodOrders,
      foodSupportCap,
      surfUsageMap.get(participant.id) ?? [],
    );

    let recipientKakaoId = participant.kakaoId;
    let recipientName = participant.user?.name || participant.name;
    let recipientType: SettlementLineItem["recipientType"] = "self";

    if (isCompanion && participant.companion) {
      if (participant.companion.linkedKakaoId) {
        recipientKakaoId = participant.companion.linkedKakaoId;
        recipientName = participant.name;
        recipientType = "linked_companion";
      } else {
        recipientKakaoId = participant.companion.ownerKakaoId;
        recipientName = participant.companion.owner?.name || participant.companion.ownerKakaoId;
        recipientType = "owner";
      }
    }

    const lineItem: SettlementLineItem = {
      participantId: participant.id,
      participantName: participant.name,
      recipientType,
      memberType: isCompanion ? "COMPANION" : "REGULAR",
      companionId: participant.companionId,
      adjustments: [...adjustments],
      foodOrders: [...foodOrders],
      surfUsageLines,
      ...(dailyBreakdowns ? { dailyBreakdowns } : {}),
      ...breakdown,
    };

    const existing = groups.get(recipientKakaoId);
    if (existing) {
      existing.items.push(lineItem);
      existing.totalFee += lineItem.totalFee;
    } else {
      groups.set(recipientKakaoId, {
        recipientKakaoId,
        recipientName,
        recipientType,
        items: [lineItem],
        totalFee: lineItem.totalFee,
      });
    }
  }

  return Array.from(groups.values());
}
