import assert from "node:assert/strict";
import test from "node:test";
import type { FulfillmentOrderRow } from "./fulfillment-order-types";
import {
  groupAdminOrderRows,
  selectAdminOrderGroups,
} from "./admin-fulfillment-presentation";

function orderRow(overrides: Partial<FulfillmentOrderRow> = {}): FulfillmentOrderRow {
  return {
    rowId: "101:coffee",
    menuRowId: "coffee:price:4000",
    orderId: 101,
    orderCreatedAt: "2026-07-15T01:00:00.000Z",
    itemCreatedAt: "2026-07-15T01:00:00.000Z",
    participantId: 1,
    participantName: "김하나",
    companionId: null,
    menuItemId: 1,
    menuOptionChoiceId: null,
    menuName: "파도 라떼",
    unitPrice: 4_000,
    orderItemIds: [1],
    expectedItems: [{ id: 1, updatedAt: "2026-07-15T01:00:00.000Z" }],
    originalQuantity: 1,
    quantity: 1,
    preparingQuantity: 0,
    servedQuantity: 0,
    remainingQuantity: 1,
    cancelledQuantity: 0,
    cancelledAmount: 0,
    cancelledReasonCode: null,
    cancelledReasonText: null,
    status: "received",
    canCancel: true,
    ...overrides,
  };
}

test("admin order projection keeps repeated submissions separate and searches participant/menu text", () => {
  const groups = groupAdminOrderRows([
    orderRow(),
    orderRow({ rowId: "101:sandwich", menuRowId: "sandwich:price:7000", menuName: "해변 샌드", unitPrice: 7_000, orderItemIds: [2], expectedItems: [{ id: 2, updatedAt: "2026-07-15T01:00:00.000Z" }] }),
    orderRow({ rowId: "102:coffee", orderId: 102, orderCreatedAt: "2026-07-15T02:00:00.000Z", itemCreatedAt: "2026-07-15T02:00:00.000Z", orderItemIds: [3], expectedItems: [{ id: 3, updatedAt: "2026-07-15T02:00:00.000Z" }], status: "served", quantity: 1, servedQuantity: 1, remainingQuantity: 0, canCancel: false }),
    orderRow({ rowId: "103:sandwich", orderId: 103, orderCreatedAt: "2026-07-15T03:00:00.000Z", itemCreatedAt: "2026-07-15T03:00:00.000Z", participantId: 2, participantName: "이둘", menuName: "해변 샌드", orderItemIds: [4], expectedItems: [{ id: 4, updatedAt: "2026-07-15T03:00:00.000Z" }], status: "cancelled", quantity: 0, remainingQuantity: 0, cancelledQuantity: 1, cancelledAmount: 4_000, canCancel: false }),
  ]);

  assert.equal(groups.length, 3);
  assert.deepEqual(groups.map((group) => group.orderId), [101, 102, 103]);
  assert.equal(groups[0]?.rows.length, 2);
  assert.deepEqual(selectAdminOrderGroups(groups, { filter: "actionable", query: "샌드" }).map((group) => group.orderId), [101]);
  assert.deepEqual(selectAdminOrderGroups(groups, { filter: "all", query: "이둘" }).map((group) => group.orderId), [103]);
  assert.deepEqual(selectAdminOrderGroups(groups, { filter: "history", query: "" }).map((group) => group.orderId), [102, 103]);
});
