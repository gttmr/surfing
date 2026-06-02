export type ShopRevenueSummaryInput = {
  foodOrderAmount: number;
  foodCancelledAmount: number;
  foodOrderedQuantity: number;
  surfUsageConfirmedAmount: number;
  surfUsageSubmittedAmount: number;
  surfUsageReviewCount: number;
  surfUsageMissingCount: number;
  surfUsageConfirmedCount: number;
};

export type ShopRevenueSummary = {
  totalAmount: number;
  foodAmount: number;
  foodCancelledAmount: number;
  foodOrderedQuantity: number;
  surfUsageAmount: number;
  surfUsageSubmittedAmount: number;
  surfUsageReviewCount: number;
  surfUsageMissingCount: number;
  surfUsageConfirmedCount: number;
};

export function calculateShopRevenueSummary(input: ShopRevenueSummaryInput): ShopRevenueSummary {
  return {
    totalAmount: input.foodOrderAmount + input.surfUsageConfirmedAmount,
    foodAmount: input.foodOrderAmount,
    foodCancelledAmount: input.foodCancelledAmount,
    foodOrderedQuantity: input.foodOrderedQuantity,
    surfUsageAmount: input.surfUsageConfirmedAmount,
    surfUsageSubmittedAmount: input.surfUsageSubmittedAmount,
    surfUsageReviewCount: input.surfUsageReviewCount,
    surfUsageMissingCount: input.surfUsageMissingCount,
    surfUsageConfirmedCount: input.surfUsageConfirmedCount,
  };
}
