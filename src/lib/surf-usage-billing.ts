export type SurfUsageServiceType =
  | "LESSON_PACKAGE"
  | "EQUIPMENT_RENTAL"
  | "WETSUIT_ONLY"
  | "SHOWER"
  | "CUSTOM";

export type SurfUsageMemberBillingPolicy =
  | "REGULAR_FIXED_COMPANION_SHOP"
  | "REGULAR_FREE_COMPANION_SHOP"
  | "ALL_SHOP";

export type SurfUsageParticipantType = "REGULAR" | "COMPANION";

export type SurfUsageBillingLine = {
  id: number;
  participantId: number;
  /** 1박의 몇째 날 (당일 모임은 1) */
  day: number;
  participantType: SurfUsageParticipantType;
  usageItemId: number;
  usageItemName: string;
  serviceType: SurfUsageServiceType;
  quantity: number;
  shopUnitPrice: number;
  memberBillingPolicy: SurfUsageMemberBillingPolicy;
  regularMemberUnitPrice: number;
  confirmed: boolean;
};

export type SurfUsageBillingResult = {
  shopChargeAmount: number;
  memberChargeAmount: number;
  operationsCoveredAmount: number;
};

export type SurfUsageDefaultItem = {
  name: string;
  description: string;
  serviceType: SurfUsageServiceType;
  shopPrice: number;
  /** 정회원 가격. 0 = 동호회 지원, 금액 = 고정, null = 샵 가격 */
  regularPrice: number | null;
  displayOrder: number;
};

/** 이용 항목표가 비어 있을 때 채우는 기본 항목 */
export const DEFAULT_SURF_USAGE_ITEMS: SurfUsageDefaultItem[] = [
  { name: "강습 패키지", description: "장비대여 + 샤워 포함", serviceType: "LESSON_PACKAGE", shopPrice: 50000, regularPrice: 10000, displayOrder: 10 },
  { name: "장비대여", description: "보드 + 슈트 포함", serviceType: "EQUIPMENT_RENTAL", shopPrice: 30000, regularPrice: 0, displayOrder: 20 },
  { name: "슈트만", description: "개별 대여", serviceType: "WETSUIT_ONLY", shopPrice: 10000, regularPrice: 0, displayOrder: 30 },
  { name: "샤워", description: "개별 이용", serviceType: "SHOWER", shopPrice: 5000, regularPrice: 0, displayOrder: 40 },
];

/** 저장된 정회원 가격(null = 샵 가격)을 청구 규칙으로 푼다. 동반인은 항상 샵 가격이다. */
export function billingPolicyFromRegularPrice(regularPrice: number | null): {
  memberBillingPolicy: SurfUsageMemberBillingPolicy;
  regularMemberUnitPrice: number;
} {
  if (regularPrice === null) return { memberBillingPolicy: "ALL_SHOP", regularMemberUnitPrice: 0 };
  if (regularPrice <= 0) return { memberBillingPolicy: "REGULAR_FREE_COMPANION_SHOP", regularMemberUnitPrice: 0 };
  return { memberBillingPolicy: "REGULAR_FIXED_COMPANION_SHOP", regularMemberUnitPrice: regularPrice };
}

/** 정회원이 실제로 내는 1개 가격 */
export function regularUnitPrice(item: { shopPrice: number; regularPrice: number | null }): number {
  return item.regularPrice === null ? item.shopPrice : Math.max(0, item.regularPrice);
}

export function getSurfUsageLineShopAmount(line: SurfUsageBillingLine) {
  return Math.max(0, line.quantity) * Math.max(0, line.shopUnitPrice);
}

export function getSurfUsageLineMemberAmount(line: SurfUsageBillingLine) {
  const quantity = Math.max(0, line.quantity);
  if (line.participantType === "COMPANION") {
    return quantity * Math.max(0, line.shopUnitPrice);
  }

  if (line.memberBillingPolicy === "ALL_SHOP") {
    return quantity * Math.max(0, line.shopUnitPrice);
  }

  if (line.memberBillingPolicy === "REGULAR_FIXED_COMPANION_SHOP") {
    return quantity * Math.max(0, line.regularMemberUnitPrice);
  }

  return 0;
}

export function calculateUsageBillingForParticipant(
  lines: SurfUsageBillingLine[]
): SurfUsageBillingResult {
  return summarizeUsageBilling(lines);
}

export function summarizeUsageBilling(lines: SurfUsageBillingLine[]): SurfUsageBillingResult {
  const confirmedLines = lines.filter((line) => line.confirmed);
  const shopChargeAmount = confirmedLines.reduce(
    (sum, line) => sum + getSurfUsageLineShopAmount(line),
    0
  );
  const memberChargeAmount = confirmedLines.reduce(
    (sum, line) => sum + getSurfUsageLineMemberAmount(line),
    0
  );

  return {
    shopChargeAmount,
    memberChargeAmount,
    operationsCoveredAmount: Math.max(shopChargeAmount - memberChargeAmount, 0),
  };
}
