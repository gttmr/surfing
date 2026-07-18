import assert from "node:assert/strict";
import test from "node:test";
import {
  getFulfillmentItemUpdates,
  parseFulfillmentOrderAction,
} from "./fulfillment-order-action";

const version = (id: number) => ({ id, updatedAt: `2026-01-01T00:00:0${id}.000Z` });
const payload = (action: string) => ({
  action,
  orderItemIds: [2, 1],
  expectedItems: [version(1), version(2)],
});

test("fulfillment payload parser accepts all exact actions and canonicalizes row versions", () => {
  for (const action of ["prepare", "serve", "undo_prepare", "undo_serve"] as const) {
    const parsed = parseFulfillmentOrderAction(payload(action));
    assert.equal(parsed.ok, true);
    if (!parsed.ok) continue;
    assert.equal(parsed.value.action, action);
    assert.deepEqual(parsed.value.expectedItems, [version(2), version(1)]);
  }

  const cancelled = parseFulfillmentOrderAction({
    ...payload("cancel"),
    reasonCode: "other",
    reasonText: "  현장 요청  ",
  });
  assert.equal(cancelled.ok, true);
  if (cancelled.ok) {
    assert.equal(cancelled.value.action, "cancel");
    assert.equal(cancelled.value.reasonCode, "other");
    assert.equal(cancelled.value.reasonText, "현장 요청");
  }
});

test("fulfillment payload parser rejects malformed, duplicate, mismatched, and extra values", () => {
  const invalid = [
    null,
    {},
    payload("unknown"),
    { ...payload("prepare"), extra: true },
    { ...payload("prepare"), orderItemIds: [] },
    { ...payload("prepare"), orderItemIds: [1, 1] },
    { ...payload("prepare"), expectedItems: [version(1)] },
    { ...payload("prepare"), expectedItems: [{ id: 1, updatedAt: "not-iso" }, version(2)] },
    { ...payload("prepare"), reasonCode: "sold_out" },
    { ...payload("cancel"), reasonCode: "unknown" },
    { ...payload("cancel"), reasonCode: "other", reasonText: "   " },
    { ...payload("cancel"), reasonCode: "sold_out", reasonText: "x".repeat(101) },
  ];
  for (const value of invalid) assert.equal(parseFulfillmentOrderAction(value).ok, false);
});

const item = (overrides: Partial<{
  id: number;
  quantity: number;
  preparingQuantity: number;
  servedQuantity: number;
  cancelledAt: string | null;
}> = {}) => ({
  id: 1,
  quantity: 3,
  preparingQuantity: 0,
  servedQuantity: 1,
  cancelledAt: null,
  ...overrides,
});

test("fulfillment transition table preserves whole-item quantity semantics", () => {
  assert.deepEqual(getFulfillmentItemUpdates("prepare", [item()]), [
    { id: 1, preparingQuantity: 2, servedQuantity: 1, cancel: false },
  ]);
  assert.deepEqual(getFulfillmentItemUpdates("serve", [item({ preparingQuantity: 2 })]), [
    { id: 1, preparingQuantity: 0, servedQuantity: 3, cancel: false },
  ]);
  assert.deepEqual(getFulfillmentItemUpdates("undo_prepare", [item({ preparingQuantity: 2 })]), [
    { id: 1, preparingQuantity: 0, servedQuantity: 1, cancel: false },
  ]);
  assert.deepEqual(getFulfillmentItemUpdates("undo_serve", [item({ servedQuantity: 3 })]), [
    { id: 1, preparingQuantity: 0, servedQuantity: 0, cancel: false },
  ]);
  assert.deepEqual(getFulfillmentItemUpdates("cancel", [item({ servedQuantity: 0, preparingQuantity: 3 })]), [
    { id: 1, preparingQuantity: 0, servedQuantity: 0, cancel: true },
  ]);
});

test("fulfillment transition table rejects cancelled, exhausted, and impossible row states", () => {
  assert.equal(getFulfillmentItemUpdates("prepare", [item({ preparingQuantity: 2 })]), null);
  assert.equal(getFulfillmentItemUpdates("serve", [item({ servedQuantity: 3 })]), null);
  assert.equal(getFulfillmentItemUpdates("undo_prepare", [item({ preparingQuantity: 0 })]), null);
  assert.equal(getFulfillmentItemUpdates("undo_serve", [item({ servedQuantity: 0 })]), null);
  assert.equal(getFulfillmentItemUpdates("cancel", [item({ servedQuantity: 1 })]), null);
  assert.equal(getFulfillmentItemUpdates("serve", [item({ cancelledAt: "2026-01-01T00:00:00.000Z" })]), null);
  assert.equal(getFulfillmentItemUpdates("prepare", [item({ preparingQuantity: 3, servedQuantity: 1 })]), null);
});
