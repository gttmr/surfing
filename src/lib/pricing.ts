import { prisma } from "@/lib/db";
import { getFoodOrderSummary, parseAmount, type FoodOrderItemSnapshot } from "@/lib/food-ordering";
import { DEFAULT_FOOD_ORDER_SUPPORT_CAP, DEFAULT_PRICING_SETTINGS, FOOD_ORDER_SUPPORT_CAP_KEY, PRICING_SETTING_KEYS, type PricingSettingKey } from "@/lib/settings";
import { calculateUsageBillingForParticipant, type SurfUsageBillingLine } from "@/lib/surf-usage-billing";
import { participantIdentity } from "@/lib/meeting-group";

export type PricingConfig = Record<PricingSettingKey, number>;

export interface SettlementParticipantInput {
  id: number;
  name: string;
  kakaoId: string;
  hasLesson: boolean;
  hasRental: boolean;
  hasBus: boolean;
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

export type OvernightSettlementDayInput = {
  meetingId: number;
  date: string;
  participants: SettlementParticipantInput[];
  adjustmentMap?: Map<number, { id: number; label: string; amount: number }[]>;
  foodOrderMap?: Map<number, FoodOrderItemSnapshot[]>;
  surfUsageMap?: Map<number, SurfUsageBillingLine[]>;
  surfUsageLedgerParticipantIds?: Set<number>;
};

function buildPricingConfig(map: Map<string, string>): PricingConfig {
  return {
    [PRICING_SETTING_KEYS.regularBaseFee]: parseAmount(map.get(PRICING_SETTING_KEYS.regularBaseFee) ?? DEFAULT_PRICING_SETTINGS[PRICING_SETTING_KEYS.regularBaseFee]),
    [PRICING_SETTING_KEYS.companionBaseFee]: parseAmount(map.get(PRICING_SETTING_KEYS.companionBaseFee) ?? DEFAULT_PRICING_SETTINGS[PRICING_SETTING_KEYS.companionBaseFee]),
    [PRICING_SETTING_KEYS.regularLessonFee]: parseAmount(map.get(PRICING_SETTING_KEYS.regularLessonFee) ?? DEFAULT_PRICING_SETTINGS[PRICING_SETTING_KEYS.regularLessonFee]),
    [PRICING_SETTING_KEYS.companionLessonFee]: parseAmount(map.get(PRICING_SETTING_KEYS.companionLessonFee) ?? DEFAULT_PRICING_SETTINGS[PRICING_SETTING_KEYS.companionLessonFee]),
    [PRICING_SETTING_KEYS.regularRentalFee]: parseAmount(map.get(PRICING_SETTING_KEYS.regularRentalFee) ?? DEFAULT_PRICING_SETTINGS[PRICING_SETTING_KEYS.regularRentalFee]),
    [PRICING_SETTING_KEYS.companionRentalFee]: parseAmount(map.get(PRICING_SETTING_KEYS.companionRentalFee) ?? DEFAULT_PRICING_SETTINGS[PRICING_SETTING_KEYS.companionRentalFee]),
  };
}

export async function getPricingConfig(): Promise<PricingConfig> {
  const keys = Object.values(PRICING_SETTING_KEYS);
  const rows = await prisma.setting.findMany({
    where: { key: { in: keys } },
  });

  return buildPricingConfig(new Map(rows.map((row) => [row.key, row.value])));
}

export async function getSettlementPricingBundle(): Promise<{ pricing: PricingConfig; foodSupportCap: number }> {
  const allKeys = [...Object.values(PRICING_SETTING_KEYS), FOOD_ORDER_SUPPORT_CAP_KEY];
  const rows = await prisma.setting.findMany({
    where: { key: { in: allKeys } },
  });

  const map = new Map(rows.map((row) => [row.key, row.value]));

  return {
    pricing: buildPricingConfig(map),
    foodSupportCap: parseAmount(map.get(FOOD_ORDER_SUPPORT_CAP_KEY) ?? DEFAULT_FOOD_ORDER_SUPPORT_CAP),
  };
}

export function getParticipantChargeBreakdown(
  participant: Pick<SettlementParticipantInput, "companionId" | "hasLesson" | "hasRental">,
  pricing: PricingConfig,
  adjustmentFee = 0,
  foodOrders: FoodOrderItemSnapshot[] = [],
  foodSupportCap = 0,
  surfUsageLines: SurfUsageBillingLine[] = [],
  useSurfUsageLedger = false
): ParticipantChargeBreakdown {
  const isCompanion = participant.companionId !== null;
  const baseFee = isCompanion ? pricing[PRICING_SETTING_KEYS.companionBaseFee] : pricing[PRICING_SETTING_KEYS.regularBaseFee];
  const lessonFee = !useSurfUsageLedger && participant.hasLesson ? (isCompanion ? pricing[PRICING_SETTING_KEYS.companionLessonFee] : pricing[PRICING_SETTING_KEYS.regularLessonFee]) : 0;
  const rentalFee = !useSurfUsageLedger && participant.hasRental ? (isCompanion ? pricing[PRICING_SETTING_KEYS.companionRentalFee] : pricing[PRICING_SETTING_KEYS.regularRentalFee]) : 0;
  const foodSummary = getFoodOrderSummary(foodOrders, foodSupportCap);
  const surfUsageBilling = calculateUsageBillingForParticipant(surfUsageLines);

  return {
    baseFee,
    lodgingFee: 0,
    lessonFee,
    rentalFee,
    surfUsageShopFee: surfUsageBilling.shopChargeAmount,
    surfUsageMemberFee: surfUsageBilling.memberChargeAmount,
    surfUsageCoveredFee: surfUsageBilling.operationsCoveredAmount,
    adjustmentFee,
    foodSubtotal: foodSummary.subtotal,
    foodSupportApplied: foodSummary.supportApplied,
    foodCharge: foodSummary.billableAmount,
    totalFee: baseFee + lessonFee + rentalFee + surfUsageBilling.memberChargeAmount + adjustmentFee + foodSummary.billableAmount,
  };
}

export function groupParticipantsForSettlement(
  participants: SettlementParticipantInput[],
  pricing: PricingConfig,
  adjustmentMap: Map<number, { id: number; label: string; amount: number }[]> = new Map(),
  foodOrderMap: Map<number, FoodOrderItemSnapshot[]> = new Map(),
  foodSupportCap = 0,
  surfUsageMap: Map<number, SurfUsageBillingLine[]> = new Map(),
  surfUsageLedgerParticipantIds: Set<number> = new Set()
): SettlementRecipientGroup[] {
  const groups = new Map<string, SettlementRecipientGroup>();

  for (const participant of participants) {
    const isCompanion = participant.companionId !== null;
    const adjustments = adjustmentMap.get(participant.id) ?? [];
    const foodOrders = foodOrderMap.get(participant.id) ?? [];
    const surfUsageLines = surfUsageMap.get(participant.id) ?? [];
    const adjustmentFee = adjustments.reduce((sum, adjustment) => sum + adjustment.amount, 0);
    const breakdown = getParticipantChargeBreakdown(
      participant,
      pricing,
      adjustmentFee,
      foodOrders,
      foodSupportCap,
      surfUsageLines,
      surfUsageLedgerParticipantIds.has(participant.id)
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
      adjustments,
      foodOrders,
      surfUsageLines,
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

export function groupOvernightParticipantsForSettlement(
  days: readonly [OvernightSettlementDayInput, OvernightSettlementDayInput],
  groupFees: { regular: number; companion: number; lodging: number },
  pricing: PricingConfig,
  foodSupportCap = 0,
): SettlementRecipientGroup[] {
  const groups = new Map<string, SettlementRecipientGroup>();
  const participantMaps = days.map((day) => new Map(
    day.participants.map((participant) => [
      participantIdentity(participant.kakaoId, participant.companionId),
      participant,
    ])
  ));

  for (const canonicalParticipant of days[0].participants) {
    const identity = participantIdentity(canonicalParticipant.kakaoId, canonicalParticipant.companionId);
    const dailyBreakdowns: NonNullable<SettlementLineItem["dailyBreakdowns"]> = [];
    const adjustments: { id: number; label: string; amount: number }[] = [];
    const foodOrders: FoodOrderItemSnapshot[] = [];
    const surfUsageLines: SurfUsageBillingLine[] = [];
    let regularEquipmentSupportUsed = false;
    const aggregate: ParticipantChargeBreakdown = {
      baseFee: canonicalParticipant.companionId === null ? groupFees.regular : groupFees.companion,
      lodgingFee: canonicalParticipant.usesClubLodging ? Math.max(0, groupFees.lodging) : 0,
      lessonFee: 0,
      rentalFee: 0,
      surfUsageShopFee: 0,
      surfUsageMemberFee: 0,
      surfUsageCoveredFee: 0,
      adjustmentFee: 0,
      foodSubtotal: 0,
      foodSupportApplied: 0,
      foodCharge: 0,
      totalFee: 0,
    };

    days.forEach((day, index) => {
      const participant = participantMaps[index].get(identity);
      if (!participant) return;
      const dayAdjustments = day.adjustmentMap?.get(participant.id) ?? [];
      const dayFoodOrders = day.foodOrderMap?.get(participant.id) ?? [];
      const rawDaySurfUsageLines = day.surfUsageMap?.get(participant.id) ?? [];
      const isRegular = participant.companionId === null;
      const daySurfUsageLines = rawDaySurfUsageLines.map((line) => {
        if (
          !isRegular
          || !line.confirmed
          || line.quantity <= 0
          || line.serviceType !== "EQUIPMENT_RENTAL"
        ) {
          return line;
        }
        return {
          ...line,
          memberBillingPolicy: regularEquipmentSupportUsed
            ? "ALL_SHOP" as const
            : "REGULAR_FREE_COMPANION_SHOP" as const,
          regularMemberUnitPrice: 0,
        };
      });
      const usedEquipmentThisDay = isRegular && rawDaySurfUsageLines.some((line) => (
        line.confirmed
        && line.quantity > 0
        && (line.serviceType === "EQUIPMENT_RENTAL" || line.serviceType === "LESSON_PACKAGE")
      ));
      const adjustmentFee = dayAdjustments.reduce((sum, adjustment) => sum + adjustment.amount, 0);
      const rawBreakdown = getParticipantChargeBreakdown(
        participant,
        pricing,
        adjustmentFee,
        dayFoodOrders,
        foodSupportCap,
        daySurfUsageLines,
        true,
      );
      const dayBreakdown = {
        ...rawBreakdown,
        baseFee: 0,
        totalFee: rawBreakdown.totalFee - rawBreakdown.baseFee,
      };

      aggregate.lessonFee += dayBreakdown.lessonFee;
      aggregate.rentalFee += dayBreakdown.rentalFee;
      aggregate.surfUsageShopFee += dayBreakdown.surfUsageShopFee;
      aggregate.surfUsageMemberFee += dayBreakdown.surfUsageMemberFee;
      aggregate.surfUsageCoveredFee += dayBreakdown.surfUsageCoveredFee;
      aggregate.adjustmentFee += dayBreakdown.adjustmentFee;
      aggregate.foodSubtotal += dayBreakdown.foodSubtotal;
      aggregate.foodSupportApplied += dayBreakdown.foodSupportApplied;
      aggregate.foodCharge += dayBreakdown.foodCharge;
      adjustments.push(...dayAdjustments);
      foodOrders.push(...dayFoodOrders);
      surfUsageLines.push(...daySurfUsageLines);
      dailyBreakdowns.push({
        meetingId: day.meetingId,
        date: day.date,
        label: `${index + 1}일차`,
        lessonFee: dayBreakdown.lessonFee,
        rentalFee: dayBreakdown.rentalFee,
        surfUsageMemberFee: dayBreakdown.surfUsageMemberFee,
        surfUsageShopFee: dayBreakdown.surfUsageShopFee,
        surfUsageCoveredFee: dayBreakdown.surfUsageCoveredFee,
        foodSubtotal: dayBreakdown.foodSubtotal,
        foodSupportApplied: dayBreakdown.foodSupportApplied,
        foodCharge: dayBreakdown.foodCharge,
        adjustmentFee: dayBreakdown.adjustmentFee,
        totalFee: dayBreakdown.totalFee,
        adjustments: dayAdjustments,
        foodOrders: dayFoodOrders,
        surfUsageLines: daySurfUsageLines,
      });
      if (usedEquipmentThisDay) regularEquipmentSupportUsed = true;
    });

    aggregate.totalFee = aggregate.baseFee
      + aggregate.lodgingFee
      + aggregate.lessonFee
      + aggregate.rentalFee
      + aggregate.surfUsageMemberFee
      + aggregate.adjustmentFee
      + aggregate.foodCharge;

    const isCompanion = canonicalParticipant.companionId !== null;
    let recipientKakaoId = canonicalParticipant.kakaoId;
    let recipientName = canonicalParticipant.user?.name || canonicalParticipant.name;
    let recipientType: SettlementLineItem["recipientType"] = "self";
    if (isCompanion && canonicalParticipant.companion) {
      if (canonicalParticipant.companion.linkedKakaoId) {
        recipientKakaoId = canonicalParticipant.companion.linkedKakaoId;
        recipientName = canonicalParticipant.name;
        recipientType = "linked_companion";
      } else {
        recipientKakaoId = canonicalParticipant.companion.ownerKakaoId;
        recipientName = canonicalParticipant.companion.owner?.name || canonicalParticipant.companion.ownerKakaoId;
        recipientType = "owner";
      }
    }

    const lineItem: SettlementLineItem = {
      participantId: canonicalParticipant.id,
      participantName: canonicalParticipant.name,
      recipientType,
      memberType: isCompanion ? "COMPANION" : "REGULAR",
      companionId: canonicalParticipant.companionId,
      adjustments,
      foodOrders,
      surfUsageLines,
      dailyBreakdowns,
      ...aggregate,
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
