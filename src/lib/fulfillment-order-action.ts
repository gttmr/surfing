export const FULFILLMENT_ACTIONS = [
  "prepare",
  "serve",
  "undo_prepare",
  "undo_serve",
  "cancel",
] as const;

export type FulfillmentOrderAction = (typeof FULFILLMENT_ACTIONS)[number];

export const ORDER_CANCEL_REASON_LABELS = {
  sold_out: "품절",
  duplicate: "중복 주문",
  customer_request: "고객 요청",
  other: "기타",
} as const;

export type OrderCancelReasonCode = keyof typeof ORDER_CANCEL_REASON_LABELS;

export type FulfillmentExpectedItem = {
  readonly id: number;
  readonly updatedAt: string;
};

export type FulfillmentOrderMutation = {
  readonly action: FulfillmentOrderAction;
  readonly orderItemIds: readonly number[];
  readonly expectedItems: readonly FulfillmentExpectedItem[];
  readonly reasonCode: OrderCancelReasonCode | null;
  readonly reasonText: string | null;
};

export type FulfillmentItemState = {
  readonly id: number;
  readonly quantity: number;
  readonly preparingQuantity: number;
  readonly servedQuantity: number;
  readonly cancelledAt: Date | string | null;
};

export type FulfillmentItemUpdate = {
  readonly id: number;
  readonly preparingQuantity: number;
  readonly servedQuantity: number;
  readonly cancel: boolean;
};

type ParseResult =
  | { readonly ok: true; readonly value: FulfillmentOrderMutation }
  | { readonly ok: false };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && expected.every((key) => Object.hasOwn(value, key));
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0;
}

function isCanonicalIsoDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.valueOf()) && parsed.toISOString() === value;
}

function parseIds(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const ids = new Set<number>();
  for (const id of value) {
    if (!isPositiveInteger(id) || ids.has(id)) return null;
    ids.add(id);
  }
  return [...ids];
}

function parseExpectedItems(value: unknown): Map<number, FulfillmentExpectedItem> | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const expected = new Map<number, FulfillmentExpectedItem>();
  for (const item of value) {
    if (!isRecord(item) || !hasExactKeys(item, ["id", "updatedAt"])) return null;
    if (!isPositiveInteger(item.id) || !isCanonicalIsoDate(item.updatedAt) || expected.has(item.id)) return null;
    expected.set(item.id, { id: item.id, updatedAt: item.updatedAt });
  }
  return expected;
}

function isAction(value: unknown): value is FulfillmentOrderAction {
  return typeof value === "string" && FULFILLMENT_ACTIONS.some((action) => action === value);
}

function isReasonCode(value: unknown): value is OrderCancelReasonCode {
  return typeof value === "string" && Object.hasOwn(ORDER_CANCEL_REASON_LABELS, value);
}

export function parseFulfillmentOrderAction(value: unknown): ParseResult {
  if (!isRecord(value) || !isAction(value.action)) return { ok: false };
  const cancel = value.action === "cancel";
  const keys = cancel && Object.hasOwn(value, "reasonText")
    ? ["action", "orderItemIds", "expectedItems", "reasonCode", "reasonText"]
    : cancel
      ? ["action", "orderItemIds", "expectedItems", "reasonCode"]
      : ["action", "orderItemIds", "expectedItems"];
  if (!hasExactKeys(value, keys)) return { ok: false };

  const orderItemIds = parseIds(value.orderItemIds);
  const expectedById = parseExpectedItems(value.expectedItems);
  if (!orderItemIds || !expectedById || orderItemIds.length !== expectedById.size) return { ok: false };
  const expectedItems: FulfillmentExpectedItem[] = [];
  for (const id of orderItemIds) {
    const expected = expectedById.get(id);
    if (!expected) return { ok: false };
    expectedItems.push(expected);
  }

  if (!cancel) {
    return { ok: true, value: { action: value.action, orderItemIds, expectedItems, reasonCode: null, reasonText: null } };
  }
  if (!isReasonCode(value.reasonCode)) return { ok: false };
  if (value.reasonText !== undefined && typeof value.reasonText !== "string") return { ok: false };
  const reasonText = typeof value.reasonText === "string" ? value.reasonText.trim() : "";
  if (reasonText.length > 100 || (value.reasonCode === "other" && reasonText.length === 0)) return { ok: false };
  return {
    ok: true,
    value: {
      action: value.action,
      orderItemIds,
      expectedItems,
      reasonCode: value.reasonCode,
      reasonText: reasonText || null,
    },
  };
}

function hasValidCounters(item: FulfillmentItemState): boolean {
  return Number.isInteger(item.quantity)
    && item.quantity > 0
    && Number.isInteger(item.preparingQuantity)
    && Number.isInteger(item.servedQuantity)
    && item.preparingQuantity >= 0
    && item.servedQuantity >= 0
    && item.servedQuantity <= item.quantity
    && item.preparingQuantity <= item.quantity - item.servedQuantity;
}

export function getFulfillmentItemUpdates(
  action: FulfillmentOrderAction,
  items: readonly FulfillmentItemState[],
): FulfillmentItemUpdate[] | null {
  if (items.length === 0 || items.some((item) => item.cancelledAt !== null || !hasValidCounters(item))) return null;

  if (action === "prepare") {
    if (items.some((item) => item.servedQuantity >= item.quantity)) return null;
    if (items.every((item) => item.preparingQuantity === item.quantity - item.servedQuantity)) return null;
    return items.map((item) => ({
      id: item.id,
      preparingQuantity: item.quantity - item.servedQuantity,
      servedQuantity: item.servedQuantity,
      cancel: false,
    }));
  }
  if (action === "serve") {
    if (items.some((item) => item.servedQuantity >= item.quantity)) return null;
    return items.map((item) => ({ id: item.id, preparingQuantity: 0, servedQuantity: item.quantity, cancel: false }));
  }
  if (action === "undo_prepare") {
    if (items.every((item) => item.preparingQuantity === 0)) return null;
    return items.map((item) => ({ id: item.id, preparingQuantity: 0, servedQuantity: item.servedQuantity, cancel: false }));
  }
  if (action === "undo_serve") {
    if (items.every((item) => item.servedQuantity === 0)) return null;
    return items.map((item) => ({ id: item.id, preparingQuantity: 0, servedQuantity: 0, cancel: false }));
  }
  if (items.some((item) => item.servedQuantity !== 0)) return null;
  return items.map((item) => ({ id: item.id, preparingQuantity: 0, servedQuantity: 0, cancel: true }));
}
