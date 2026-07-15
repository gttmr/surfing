import assert from "node:assert/strict";
import test from "node:test";
import { buildMobileUxFixture } from "../../tests/fixtures/mobile-ux";
import {
  buildOrderMenuVariants,
  filterOrderMenuVariants,
  getOrderCartSummary,
  getOrderPresentation,
  getParticipantOrderSubtotal,
  prefillOrderDraft,
  selectedOrderLines,
} from "./participant-order-ui";
import type {
  ParticipantFoodOrderData,
  ParticipantFoodOrderItemData,
  ParticipantMeetingFoodOrdersData,
} from "./food-ordering-data";

function denseMenus(): ParticipantMeetingFoodOrdersData["menus"] {
  const fixture = buildMobileUxFixture("2026-07-15");
  const categoryById = new Map(fixture.categories.map((category) => [category.id, category]));
  return fixture.menus.filter((menu) => menu.isActive).map((menu) => {
    const category = categoryById.get(menu.categoryId);
    if (!category) throw new Error("fixture category missing");
    return {
      id: menu.id,
      categoryId: menu.categoryId,
      categoryName: category.name,
      categoryDisplayOrder: category.displayOrder,
      name: menu.name,
      price: menu.price,
      optionGroupName: menu.optionGroupName,
      options: fixture.variants.flatMap((variant) => (
        variant.menuItemId === menu.id && variant.id !== null
          ? [{ id: variant.id, label: variant.label, price: variant.price, displayOrder: variant.displayOrder }]
          : []
      )),
      isActive: true,
      displayOrder: menu.displayOrder,
    };
  });
}

function orderItem(overrides: Partial<ParticipantFoodOrderItemData> = {}): ParticipantFoodOrderItemData {
  return {
    id: 1,
    menuItemId: 8413,
    menuOptionChoiceId: null,
    menuNameSnapshot: "합성 메뉴 13",
    optionGroupNameSnapshot: null,
    optionChoiceLabelSnapshot: null,
    unitPriceSnapshot: 7_000,
    quantity: 2,
    preparingQuantity: 0,
    servedQuantity: 0,
    cancelledAt: null,
    cancelledReasonCode: null,
    cancelledReasonText: null,
    cancelledByKakaoId: null,
    createdAt: "2026-07-15T01:00:00.000Z",
    updatedAt: "2026-07-15T01:00:00.000Z",
    ...overrides,
  };
}

function order(items: ParticipantFoodOrderItemData[]): ParticipantFoodOrderData {
  return { orderId: 91, createdAt: "2026-07-15T01:00:00.000Z", items };
}

test("dense participant menu discovery expands to 60 stable variants", () => {
  const variants = buildOrderMenuVariants(denseMenus());
  assert.equal(variants.length, 60);
  assert.equal(variants[0]?.label, "합성 메뉴 01 · 작게");
  assert.equal(variants.some((variant) => variant.label === "합성 메뉴 13"), true);
  assert.equal(new Set(variants.map((variant) => variant.key)).size, 60);
});

test("menu discovery searches Korean category, menu, and option text", () => {
  const variants = buildOrderMenuVariants(denseMenus());
  assert.equal(filterOrderMenuVariants(variants, "푸짐하게", false, {}).length, 12);
  assert.equal(filterOrderMenuVariants(variants, "합성 메뉴 13", false, {}).length, 1);
  assert.equal(
    filterOrderMenuVariants(variants, "아주 긴 한글 카테고리", false, {}).every(
      (variant) => variant.categoryName.includes("아주 긴 한글 카테고리"),
    ),
    true,
  );
});

test("selected-only discovery contains exactly nonzero draft variants", () => {
  const variants = buildOrderMenuVariants(denseMenus());
  const draft = { [variants[0]?.key ?? "missing"]: 2, [variants[15]?.key ?? "missing"]: 1 };
  assert.deepEqual(
    filterOrderMenuVariants(variants, "", true, draft).map((variant) => variant.key),
    [variants[0]?.key, variants[15]?.key],
  );
});

test("order draft prefills variants and cart summary applies remaining support", () => {
  const variants = buildOrderMenuVariants(denseMenus());
  const source = order([
    orderItem({ menuItemId: 8413, quantity: 2, unitPriceSnapshot: 7_000 }),
    orderItem({ id: 2, menuItemId: 8402, menuOptionChoiceId: 8504, quantity: 1, unitPriceSnapshot: 4_750 }),
  ]);
  const draft = prefillOrderDraft(variants, source);
  const lines = selectedOrderLines(variants, draft);
  assert.deepEqual(lines.map((line) => [line.key, line.quantity]), [["8402:8504", 1], ["8413:none", 2]]);
  assert.deepEqual(getOrderCartSummary(lines, 10_000, 4_000), {
    totalQuantity: 3,
    subtotal: 18_250,
    supportRemaining: 6_000,
    supportApplied: 6_000,
    billableAmount: 12_250,
  });
});

test("participant active subtotal can exclude the submission being replaced", () => {
  const participant = {
    orders: [
      order([orderItem({ unitPriceSnapshot: 5_000, quantity: 2 })]),
      { ...order([orderItem({ id: 2, unitPriceSnapshot: 3_000, quantity: 1 })]), orderId: 92 },
      { ...order([orderItem({ id: 3, unitPriceSnapshot: 9_000, cancelledAt: "2026-07-15T02:00:00.000Z" })]), orderId: 93 },
    ],
  };
  assert.equal(getParticipantOrderSubtotal(participant.orders), 13_000);
  assert.equal(getParticipantOrderSubtotal(participant.orders, 91), 3_000);
});

test("submission presentation exposes actions only for untouched siblings", () => {
  assert.deepEqual(getOrderPresentation(order([orderItem()])), {
    tone: "received",
    label: "접수됨",
    editable: true,
    lockedReason: null,
  });
  assert.equal(getOrderPresentation(order([orderItem({ preparingQuantity: 1 })])).label, "준비 중");
  assert.equal(getOrderPresentation(order([orderItem({ servedQuantity: 1 })])).label, "제공 중");
  assert.equal(getOrderPresentation(order([orderItem({ servedQuantity: 2 })])).label, "제공 완료");
  assert.equal(getOrderPresentation(order([orderItem({ cancelledAt: "2026-07-15T02:00:00.000Z" })])).label, "취소됨");
  const mixed = getOrderPresentation(order([
    orderItem(),
    orderItem({ id: 2, cancelledAt: "2026-07-15T02:00:00.000Z" }),
  ]));
  assert.equal(mixed.label, "일부 취소");
  assert.equal(mixed.editable, false);
});
