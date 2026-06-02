import test from "node:test";
import assert from "node:assert/strict";
import { calculateShopRevenueSummary } from "./shop-revenue-summary";

test("shop revenue summary adds active food sales and confirmed surf usage only", () => {
  const summary = calculateShopRevenueSummary({
    foodOrderAmount: 43000,
    foodCancelledAmount: 12000,
    foodOrderedQuantity: 5,
    surfUsageConfirmedAmount: 92000,
    surfUsageSubmittedAmount: 130000,
    surfUsageReviewCount: 2,
    surfUsageMissingCount: 1,
    surfUsageConfirmedCount: 4,
  });

  assert.equal(summary.totalAmount, 135000);
  assert.equal(summary.foodAmount, 43000);
  assert.equal(summary.surfUsageAmount, 92000);
  assert.equal(summary.foodCancelledAmount, 12000);
  assert.equal(summary.foodOrderedQuantity, 5);
  assert.equal(summary.surfUsageReviewCount, 2);
  assert.equal(summary.surfUsageMissingCount, 1);
  assert.equal(summary.surfUsageConfirmedCount, 4);
});
