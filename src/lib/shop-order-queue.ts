import type { FulfillmentOrderAction } from "./fulfillment-order-action";
import type { FulfillmentOrderRow, FulfillmentOrderStatus } from "./fulfillment-order-types";

export type ShopOrderFilter = "active" | "received" | "preparing" | "served" | "cancelled" | "all";
export type ShopOrderConfirmationAction = Extract<FulfillmentOrderAction, "undo_prepare" | "undo_serve" | "cancel">;

export const SHOP_ORDER_FILTERS: ReadonlyArray<{ readonly value: ShopOrderFilter; readonly label: string }> = [
  { value: "active", label: "처리할 주문" },
  { value: "received", label: "접수" },
  { value: "preparing", label: "준비 중" },
  { value: "served", label: "완료" },
  { value: "cancelled", label: "취소" },
];

export const SHOP_ORDER_STATUS_LABELS = {
  received: "접수",
  preparing: "준비 중",
  served: "완료",
  cancelled: "취소",
  mixed: "일부 처리",
} as const satisfies Record<FulfillmentOrderStatus, string>;

function compareArrival(left: FulfillmentOrderRow, right: FulfillmentOrderRow): number {
  const parentTime = left.orderCreatedAt.localeCompare(right.orderCreatedAt);
  if (parentTime !== 0) return parentTime;
  const itemTime = left.itemCreatedAt.localeCompare(right.itemCreatedAt);
  if (itemTime !== 0) return itemTime;
  if (left.orderId !== right.orderId) return left.orderId - right.orderId;
  return left.rowId.localeCompare(right.rowId);
}

function isActive(row: FulfillmentOrderRow): boolean {
  return row.quantity > 0 && row.remainingQuantity > 0 && row.status !== "cancelled";
}

function matchesFilter(row: FulfillmentOrderRow, filter: ShopOrderFilter): boolean {
  if (filter === "all") return true;
  if (filter === "active") return isActive(row);
  return row.status === filter;
}

function matchesQuery(row: FulfillmentOrderRow, rawQuery: string): boolean {
  const query = rawQuery.trim().toLocaleLowerCase("ko-KR");
  if (!query) return true;
  return [
    row.participantName,
    row.menuName,
    SHOP_ORDER_STATUS_LABELS[row.status],
  ].some((value) => value.toLocaleLowerCase("ko-KR").includes(query));
}

export function selectShopOrderRows(
  rows: readonly FulfillmentOrderRow[],
  input: { readonly filter: ShopOrderFilter; readonly query: string },
): FulfillmentOrderRow[] {
  return rows
    .filter((row) => matchesQuery(row, input.query) && matchesFilter(row, input.filter))
    .toSorted(compareArrival);
}

export function summarizeShopOrderRows(rows: readonly FulfillmentOrderRow[]) {
  return {
    active: rows.filter(isActive).length,
    received: rows.filter((row) => row.status === "received").length,
    preparing: rows.filter((row) => row.status === "preparing").length,
    served: rows.filter((row) => row.status === "served").length,
    cancelled: rows.filter((row) => row.status === "cancelled").length,
  };
}

export function getShopOrderRowActions(row: FulfillmentOrderRow): {
  readonly primary: Extract<FulfillmentOrderAction, "prepare" | "serve"> | null;
  readonly confirmations: readonly ShopOrderConfirmationAction[];
} {
  if (row.status === "cancelled" || row.quantity === 0) return { primary: null, confirmations: [] };

  const confirmations: ShopOrderConfirmationAction[] = [];
  if (row.preparingQuantity > 0) confirmations.push("undo_prepare");
  if (row.servedQuantity > 0) confirmations.push("undo_serve");
  if (row.canCancel) confirmations.push("cancel");

  const primary = row.remainingQuantity > 0
    ? row.preparingQuantity > 0
      ? "serve"
      : "prepare"
    : null;
  return { primary, confirmations };
}
