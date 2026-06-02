import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateUsageBillingForParticipant,
  summarizeUsageBilling,
  type SurfUsageBillingLine,
} from "./surf-usage-billing";

function usageLine(overrides: Partial<SurfUsageBillingLine> = {}): SurfUsageBillingLine {
  return {
    id: 1,
    participantId: 10,
    participantType: "REGULAR",
    usageItemId: 100,
    usageItemName: "강습 패키지",
    serviceType: "LESSON_PACKAGE",
    quantity: 1,
    shopUnitPrice: 50000,
    memberBillingPolicy: "REGULAR_FIXED_COMPANION_SHOP",
    regularMemberUnitPrice: 10000,
    confirmed: true,
    ...overrides,
  };
}

test("regular lesson package charges the shop amount to operations and the configured fixed amount to the member", () => {
  const billing = calculateUsageBillingForParticipant([
    usageLine({ participantType: "REGULAR", shopUnitPrice: 50000, regularMemberUnitPrice: 10000 }),
  ]);

  assert.equal(billing.shopChargeAmount, 50000);
  assert.equal(billing.memberChargeAmount, 10000);
  assert.equal(billing.operationsCoveredAmount, 40000);
});

test("companion usage is charged to the member at the confirmed shop amount", () => {
  const billing = calculateUsageBillingForParticipant([
    usageLine({ participantType: "COMPANION", serviceType: "EQUIPMENT_RENTAL", shopUnitPrice: 30000 }),
  ]);

  assert.equal(billing.shopChargeAmount, 30000);
  assert.equal(billing.memberChargeAmount, 30000);
  assert.equal(billing.operationsCoveredAmount, 0);
});

test("regular non-lesson default usage is covered by operations", () => {
  const billing = calculateUsageBillingForParticipant([
    usageLine({
      serviceType: "WETSUIT_ONLY",
      usageItemName: "슈트만",
      shopUnitPrice: 10000,
      memberBillingPolicy: "REGULAR_FREE_COMPANION_SHOP",
      regularMemberUnitPrice: 0,
    }),
    usageLine({
      id: 2,
      serviceType: "SHOWER",
      usageItemName: "샤워",
      shopUnitPrice: 5000,
      memberBillingPolicy: "REGULAR_FREE_COMPANION_SHOP",
      regularMemberUnitPrice: 0,
    }),
  ]);

  assert.equal(billing.shopChargeAmount, 15000);
  assert.equal(billing.memberChargeAmount, 0);
  assert.equal(billing.operationsCoveredAmount, 15000);
});

test("shop-added custom usage defaults to charging both regular and companion members at the shop amount", () => {
  assert.equal(
    calculateUsageBillingForParticipant([
      usageLine({
        serviceType: "CUSTOM",
        usageItemName: "현장 추가",
        shopUnitPrice: 12000,
        memberBillingPolicy: "ALL_SHOP",
        regularMemberUnitPrice: 0,
      }),
    ]).memberChargeAmount,
    12000
  );

  assert.equal(
    calculateUsageBillingForParticipant([
      usageLine({
        participantType: "COMPANION",
        serviceType: "CUSTOM",
        usageItemName: "현장 추가",
        shopUnitPrice: 12000,
        memberBillingPolicy: "ALL_SHOP",
        regularMemberUnitPrice: 0,
      }),
    ]).memberChargeAmount,
    12000
  );
});

test("usage billing summary separates shop charges, member charges, and operations coverage", () => {
  const summary = summarizeUsageBilling([
    usageLine({ participantId: 1, participantType: "REGULAR", shopUnitPrice: 50000, regularMemberUnitPrice: 10000 }),
    usageLine({ participantId: 2, participantType: "COMPANION", serviceType: "EQUIPMENT_RENTAL", shopUnitPrice: 30000 }),
    usageLine({
      id: 3,
      participantId: 3,
      participantType: "REGULAR",
      serviceType: "CUSTOM",
      usageItemName: "현장 추가",
      shopUnitPrice: 12000,
      memberBillingPolicy: "ALL_SHOP",
      regularMemberUnitPrice: 0,
    }),
  ]);

  assert.equal(summary.shopChargeAmount, 92000);
  assert.equal(summary.memberChargeAmount, 52000);
  assert.equal(summary.operationsCoveredAmount, 40000);
});
