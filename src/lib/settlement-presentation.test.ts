import test from "node:test";
import assert from "node:assert/strict";
import { getSettlementChargeLines } from "./settlement-presentation";

function chargeInput(overrides: Partial<Parameters<typeof getSettlementChargeLines>[0]> = {}) {
  return {
    adjustments: [],
    baseFee: 0,
    foodCharge: 0,
    foodSubtotal: 0,
    foodSupportApplied: 0,
    lessonFee: 0,
    rentalFee: 0,
    surfUsageMemberFee: 0,
    totalFee: 0,
    ...overrides,
  };
}

test("settlement lines explain a food-only 17,750 won total without a misleading zero participation line", () => {
  const lines = getSettlementChargeLines(chargeInput({
    foodCharge: 17_750,
    foodSubtotal: 27_750,
    foodSupportApplied: 10_000,
    totalFee: 17_750,
  }));

  assert.deepEqual(lines, [
    { key: "food-subtotal", label: "식음료", amount: 27_750 },
    { key: "food-support", label: "식음료 지원", amount: -10_000 },
  ]);
  assert.equal(lines.reduce((sum, line) => sum + line.amount, 0), 17_750);
});

test("settlement lines reconcile every displayed component to the authoritative participant total", () => {
  const lines = getSettlementChargeLines(chargeInput({
    adjustments: [{ id: 3, label: "현장 조정", amount: -500 }],
    baseFee: 10_000,
    lessonFee: 5_000,
    surfUsageMemberFee: 2_000,
    totalFee: 17_250,
  }));

  assert.equal(lines.reduce((sum, line) => sum + line.amount, 0), 17_250);
  assert.deepEqual(lines.at(-1), { key: "reconciliation", label: "기타 청구", amount: 750 });
});

test("settlement lines keep a zero-won actual usage line when confirmed usage exists", () => {
  const lines = getSettlementChargeLines(chargeInput({
    surfUsageLines: [{
      id: 9,
      participantId: 1,
      participantType: "REGULAR",
      usageItemId: 4,
      usageItemName: "샤워",
      serviceType: "SHOWER",
      quantity: 1,
      shopUnitPrice: 5_000,
      memberBillingPolicy: "REGULAR_FREE_COMPANION_SHOP",
      regularMemberUnitPrice: 0,
      confirmed: true,
    }],
    surfUsageMemberFee: 0,
    totalFee: 0,
  }));

  assert.deepEqual(lines, [{ key: "surf-usage", label: "실제 이용 · 회원 부담", amount: 0 }]);
});
