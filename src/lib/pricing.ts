import { prisma } from "@/lib/db";
import { DEFAULT_PRICING_SETTINGS, PRICING_SETTING_KEYS, type PricingSettingKey } from "@/lib/settings";

export type PricingConfig = Record<PricingSettingKey, number>;

export interface SettlementParticipantInput {
  id: number;
  name: string;
  kakaoId: string;
  hasLesson: boolean;
  hasRental: boolean;
  hasBus: boolean;
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
  lessonFee: number;
  rentalFee: number;
  adjustmentFee: number;
  totalFee: number;
}

export interface SettlementLineItem extends ParticipantChargeBreakdown {
  participantId: number;
  participantName: string;
  recipientType: "self" | "linked_companion" | "owner";
  memberType: "REGULAR" | "COMPANION";
  companionId: number | null;
  adjustments: { id: number; label: string; amount: number }[];
}

export interface SettlementRecipientGroup {
  recipientKakaoId: string;
  recipientName: string;
  recipientType: "self" | "linked_companion" | "owner";
  items: SettlementLineItem[];
  totalFee: number;
}

function toAmount(value: string | undefined) {
  const digits = (value ?? "").replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

export async function getPricingConfig(): Promise<PricingConfig> {
  const keys = Object.values(PRICING_SETTING_KEYS);
  const rows = await prisma.setting.findMany({
    where: { key: { in: keys } },
  });

  const map = new Map(rows.map((row) => [row.key, row.value]));

  return {
    [PRICING_SETTING_KEYS.regularBaseFee]: toAmount(map.get(PRICING_SETTING_KEYS.regularBaseFee) ?? DEFAULT_PRICING_SETTINGS[PRICING_SETTING_KEYS.regularBaseFee]),
    [PRICING_SETTING_KEYS.companionBaseFee]: toAmount(map.get(PRICING_SETTING_KEYS.companionBaseFee) ?? DEFAULT_PRICING_SETTINGS[PRICING_SETTING_KEYS.companionBaseFee]),
    [PRICING_SETTING_KEYS.regularLessonFee]: toAmount(map.get(PRICING_SETTING_KEYS.regularLessonFee) ?? DEFAULT_PRICING_SETTINGS[PRICING_SETTING_KEYS.regularLessonFee]),
    [PRICING_SETTING_KEYS.companionLessonFee]: toAmount(map.get(PRICING_SETTING_KEYS.companionLessonFee) ?? DEFAULT_PRICING_SETTINGS[PRICING_SETTING_KEYS.companionLessonFee]),
    [PRICING_SETTING_KEYS.regularRentalFee]: toAmount(map.get(PRICING_SETTING_KEYS.regularRentalFee) ?? DEFAULT_PRICING_SETTINGS[PRICING_SETTING_KEYS.regularRentalFee]),
    [PRICING_SETTING_KEYS.companionRentalFee]: toAmount(map.get(PRICING_SETTING_KEYS.companionRentalFee) ?? DEFAULT_PRICING_SETTINGS[PRICING_SETTING_KEYS.companionRentalFee]),
  };
}

export function getParticipantChargeBreakdown(
  participant: Pick<SettlementParticipantInput, "companionId" | "hasLesson" | "hasRental">,
  pricing: PricingConfig,
  adjustmentFee = 0
): ParticipantChargeBreakdown {
  const isCompanion = participant.companionId !== null;
  const baseFee = isCompanion ? pricing[PRICING_SETTING_KEYS.companionBaseFee] : pricing[PRICING_SETTING_KEYS.regularBaseFee];
  const lessonFee = participant.hasLesson ? (isCompanion ? pricing[PRICING_SETTING_KEYS.companionLessonFee] : pricing[PRICING_SETTING_KEYS.regularLessonFee]) : 0;
  const rentalFee = participant.hasRental ? (isCompanion ? pricing[PRICING_SETTING_KEYS.companionRentalFee] : pricing[PRICING_SETTING_KEYS.regularRentalFee]) : 0;

  return {
    baseFee,
    lessonFee,
    rentalFee,
    adjustmentFee,
    totalFee: baseFee + lessonFee + rentalFee + adjustmentFee,
  };
}

export function groupParticipantsForSettlement(
  participants: SettlementParticipantInput[],
  pricing: PricingConfig,
  adjustmentMap: Map<number, { id: number; label: string; amount: number }[]> = new Map()
): SettlementRecipientGroup[] {
  const groups = new Map<string, SettlementRecipientGroup>();

  for (const participant of participants) {
    const isCompanion = participant.companionId !== null;
    const adjustments = adjustmentMap.get(participant.id) ?? [];
    const adjustmentFee = adjustments.reduce((sum, adjustment) => sum + adjustment.amount, 0);
    const breakdown = getParticipantChargeBreakdown(participant, pricing, adjustmentFee);

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
