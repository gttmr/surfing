import assert from "node:assert/strict";
import test from "node:test";
import type { FulfillmentOrderRow } from "./fulfillment-order-types";
import {
  getShopOrderRowActions,
  selectShopOrderRows,
  summarizeShopOrderRows,
} from "./shop-order-queue";

function orderRow(overrides: Partial<FulfillmentOrderRow> & Pick<FulfillmentOrderRow, "orderId" | "rowId">): FulfillmentOrderRow {
  return {
    menuRowId: "8401:none:price:4000",
    orderCreatedAt: "2026-07-15T01:00:00.000Z",
    itemCreatedAt: "2026-07-15T01:00:00.000Z",
    participantId: 8801,
    participantName: "합성 회원 01",
    companionId: null,
    menuItemId: 8401,
    menuOptionChoiceId: null,
    menuName: "합성 국수",
    unitPrice: 4_000,
    orderItemIds: [9_001],
    expectedItems: [{ id: 9_001, updatedAt: "2026-07-15T01:00:00.000Z" }],
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

const rows = [
  orderRow({ orderId: 3, rowId: "3:8401", orderCreatedAt: "2026-07-15T03:00:00.000Z" }),
  orderRow({ orderId: 1, rowId: "1:8401", orderCreatedAt: "2026-07-15T01:00:00.000Z" }),
  orderRow({
    orderId: 2,
    rowId: "2:8402",
    orderCreatedAt: "2026-07-15T02:00:00.000Z",
    participantName: "합성 회원 02",
    menuName: "따뜻한 차",
    preparingQuantity: 1,
    status: "preparing",
  }),
  orderRow({
    orderId: 4,
    rowId: "4:8403",
    orderCreatedAt: "2026-07-15T04:00:00.000Z",
    menuName: "완료된 샌드위치",
    servedQuantity: 1,
    remainingQuantity: 0,
    status: "served",
    canCancel: false,
  }),
  orderRow({
    orderId: 5,
    rowId: "5:8404",
    orderCreatedAt: "2026-07-15T05:00:00.000Z",
    menuName: "취소된 주스",
    quantity: 0,
    cancelledQuantity: 1,
    remainingQuantity: 0,
    status: "cancelled",
    canCancel: false,
  }),
];

test("shop queue keeps repeated submissions distinct and sorts active work oldest first", () => {
  const selected = selectShopOrderRows(rows, { filter: "active", query: "" });
  assert.deepEqual(selected.map((row) => row.orderId), [1, 2, 3]);
  assert.deepEqual(selected.filter((row) => row.menuName === "합성 국수").map((row) => row.rowId), ["1:8401", "3:8401"]);
});

test("shop queue searches participant, menu, and Korean status text before applying status filters", () => {
  assert.deepEqual(selectShopOrderRows(rows, { filter: "all", query: "회원 02" }).map((row) => row.orderId), [2]);
  assert.deepEqual(selectShopOrderRows(rows, { filter: "all", query: "국수" }).map((row) => row.orderId), [1, 3]);
  assert.deepEqual(selectShopOrderRows(rows, { filter: "all", query: "준비 중" }).map((row) => row.orderId), [2]);
  assert.deepEqual(selectShopOrderRows(rows, { filter: "served", query: "" }).map((row) => row.orderId), [4]);
  assert.deepEqual(selectShopOrderRows(rows, { filter: "cancelled", query: "" }).map((row) => row.orderId), [5]);
});

test("shop queue summary and actions reflect whole-row fulfillment state", () => {
  assert.deepEqual(summarizeShopOrderRows(rows), {
    active: 3,
    received: 2,
    preparing: 1,
    served: 1,
    cancelled: 1,
  });
  assert.deepEqual(getShopOrderRowActions(rows[1]), { primary: "prepare", confirmations: ["cancel"] });
  assert.deepEqual(getShopOrderRowActions(rows[2]), { primary: "serve", confirmations: ["undo_prepare", "cancel"] });
  assert.deepEqual(getShopOrderRowActions(rows[3]), { primary: null, confirmations: ["undo_serve"] });
  assert.deepEqual(getShopOrderRowActions(rows[4]), { primary: null, confirmations: [] });
});
