import type { SettlementLineItem } from "@/lib/pricing";

export type SettlementChargeLine = {
  readonly key: string;
  readonly label: string;
  readonly amount: number;
};

type SettlementChargeInput = Pick<
  SettlementLineItem,
  | "adjustments"
  | "baseFee"
  | "foodCharge"
  | "foodSubtotal"
  | "foodSupportApplied"
  | "lessonFee"
  | "rentalFee"
  | "surfUsageMemberFee"
  | "totalFee"
> & {
  readonly lodgingFee?: SettlementLineItem["lodgingFee"];
  readonly surfUsageLines?: SettlementLineItem["surfUsageLines"];
};

export function getSettlementChargeLines(item: SettlementChargeInput): readonly SettlementChargeLine[] {
  const lines: SettlementChargeLine[] = [];

  if (item.baseFee !== 0) lines.push({ key: "base", label: "참가", amount: item.baseFee });
  const lodgingFee = item.lodgingFee ?? 0;
  if (lodgingFee !== 0) lines.push({ key: "lodging", label: "숙박", amount: lodgingFee });
  if (item.lessonFee !== 0) lines.push({ key: "lesson", label: "강습", amount: item.lessonFee });
  if (item.rentalFee !== 0) lines.push({ key: "rental", label: "대여", amount: item.rentalFee });
  if (item.surfUsageMemberFee !== 0 || (item.surfUsageLines?.length ?? 0) > 0) {
    lines.push({ key: "surf-usage", label: "실제 이용 · 회원 부담", amount: item.surfUsageMemberFee });
  }
  if (item.foodSubtotal !== 0) {
    lines.push({ key: "food-subtotal", label: "식음료", amount: item.foodSubtotal });
    if (item.foodSupportApplied !== 0) {
      lines.push({ key: "food-support", label: "식음료 지원", amount: -item.foodSupportApplied });
    }
  } else if (item.foodCharge !== 0) {
    lines.push({ key: "food-charge", label: "식음료", amount: item.foodCharge });
  }
  for (const adjustment of item.adjustments) {
    if (adjustment.amount !== 0) {
      lines.push({ key: `adjustment-${adjustment.id}`, label: adjustment.label, amount: adjustment.amount });
    }
  }

  const displayedTotal = lines.reduce((sum, line) => sum + line.amount, 0);
  const remainingAmount = item.totalFee - displayedTotal;
  if (remainingAmount !== 0) {
    lines.push({ key: "reconciliation", label: "기타 청구", amount: remainingAmount });
  }
  if (lines.length === 0) {
    lines.push({ key: "base", label: "참가", amount: 0 });
  }

  return lines;
}
