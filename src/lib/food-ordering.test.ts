import test from "node:test";
import assert from "node:assert/strict";
import {
  canCancelFoodOrderItems,
  getFoodOrderParticipantAccess,
  getFoodOrderSummary,
  type FoodOrderItemSnapshot,
} from "./food-ordering";

function orderItem(overrides: Partial<FoodOrderItemSnapshot> = {}): FoodOrderItemSnapshot {
  return {
    id: 1,
    participantId: 10,
    menuItemId: 20,
    menuOptionChoiceId: null,
    menuNameSnapshot: "김치볶음밥",
    optionGroupNameSnapshot: null,
    optionChoiceLabelSnapshot: null,
    unitPriceSnapshot: 8000,
    quantity: 1,
    preparingQuantity: 0,
    servedQuantity: 0,
    cancelledAt: null,
    cancelledReasonCode: null,
    cancelledReasonText: null,
    ...overrides,
  };
}

test("food order summary excludes cancelled order items", () => {
  const summary = getFoodOrderSummary(
    [
      orderItem({ id: 1, quantity: 2, unitPriceSnapshot: 8000 }),
      orderItem({ id: 2, quantity: 1, unitPriceSnapshot: 7000, cancelledAt: "2026-06-02T08:00:00.000Z" }),
    ],
    5000
  );

  assert.equal(summary.subtotal, 16000);
  assert.equal(summary.totalQuantity, 2);
  assert.equal(summary.supportApplied, 5000);
  assert.equal(summary.billableAmount, 11000);
});

test("food order participant access distinguishes self, owner proxy, and locked linked companion", () => {
  assert.deepEqual(
    getFoodOrderParticipantAccess({
      sessionKakaoId: "owner",
      participantKakaoId: "owner",
      companionId: null,
      companionOwnerKakaoId: null,
      companionLinkedKakaoId: null,
    }),
    {
      canOrder: true,
      orderRole: "self",
      roleLabel: "내 주문",
      lockedReason: null,
    }
  );

  assert.deepEqual(
    getFoodOrderParticipantAccess({
      sessionKakaoId: "owner",
      participantKakaoId: "owner",
      companionId: 1,
      companionOwnerKakaoId: "owner",
      companionLinkedKakaoId: null,
    }),
    {
      canOrder: true,
      orderRole: "owner_proxy",
      roleLabel: "미연동 · 대리주문",
      lockedReason: null,
    }
  );

  assert.deepEqual(
    getFoodOrderParticipantAccess({
      sessionKakaoId: "owner",
      participantKakaoId: "owner",
      companionId: 2,
      companionOwnerKakaoId: "owner",
      companionLinkedKakaoId: "linked",
    }),
    {
      canOrder: false,
      orderRole: "linked_companion_locked",
      roleLabel: "직접 주문",
      lockedReason: "연동된 동반인이 직접 주문해야 합니다.",
    }
  );

  assert.deepEqual(
    getFoodOrderParticipantAccess({
      sessionKakaoId: "linked",
      participantKakaoId: "owner",
      companionId: 2,
      companionOwnerKakaoId: "owner",
      companionLinkedKakaoId: "linked",
    }),
    {
      canOrder: true,
      orderRole: "self",
      roleLabel: "내 주문",
      lockedReason: null,
    }
  );
});

test("only unserved order items can be cancelled", () => {
  assert.equal(canCancelFoodOrderItems([orderItem({ servedQuantity: 0, preparingQuantity: 1 })]), true);
  assert.equal(canCancelFoodOrderItems([orderItem({ servedQuantity: 1 })]), false);
  assert.equal(canCancelFoodOrderItems([orderItem({ cancelledAt: "2026-06-02T08:00:00.000Z" })]), false);
});
