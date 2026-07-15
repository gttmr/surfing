import type { FulfillmentOrderRow } from "./fulfillment-order-types";

export const ADMIN_ORDER_FILTERS = ["actionable", "all", "history"] as const;
export type AdminOrderFilter = (typeof ADMIN_ORDER_FILTERS)[number];

export type AdminOrderGroup = {
  readonly orderId: number;
  readonly orderCreatedAt: string;
  readonly participantId: number;
  readonly participantName: string;
  readonly companionId: number | null;
  readonly rows: readonly FulfillmentOrderRow[];
  readonly status: "actionable" | "completed" | "cancelled";
  readonly activeQuantity: number;
  readonly cancelledQuantity: number;
  readonly totalAmount: number;
};

export type AdminOrderSelection = {
  readonly filter: AdminOrderFilter;
  readonly query: string;
};

function isActionableRow(row: FulfillmentOrderRow): boolean {
  return row.remainingQuantity > 0 || row.preparingQuantity > 0 || row.canCancel;
}

function groupStatus(rows: readonly FulfillmentOrderRow[]): AdminOrderGroup["status"] {
  if (rows.some(isActionableRow)) return "actionable";
  if (rows.every((row) => row.status === "cancelled" || row.quantity === 0)) return "cancelled";
  return "completed";
}

export function groupAdminOrderRows(rows: readonly FulfillmentOrderRow[]): readonly AdminOrderGroup[] {
  const grouped = new Map<number, FulfillmentOrderRow[]>();
  for (const row of rows) {
    const current = grouped.get(row.orderId) ?? [];
    current.push(row);
    grouped.set(row.orderId, current);
  }

  return Array.from(grouped.values(), (groupRows) => {
    const first = groupRows[0];
    if (!first) throw new Error("admin order group is empty");
    return {
      orderId: first.orderId,
      orderCreatedAt: first.orderCreatedAt,
      participantId: first.participantId,
      participantName: first.participantName,
      companionId: first.companionId,
      rows: groupRows,
      status: groupStatus(groupRows),
      activeQuantity: groupRows.reduce((total, row) => total + row.quantity, 0),
      cancelledQuantity: groupRows.reduce((total, row) => total + row.cancelledQuantity, 0),
      totalAmount: groupRows.reduce(
        (total, row) => total + row.unitPrice * (row.quantity + row.cancelledQuantity),
        0
      ),
    };
  });
}

function matchesQuery(group: AdminOrderGroup, query: string): boolean {
  if (!query) return true;
  const participantMatches = group.participantName.toLocaleLowerCase("ko-KR").includes(query);
  return participantMatches || group.rows.some((row) => row.menuName.toLocaleLowerCase("ko-KR").includes(query));
}

function matchesFilter(group: AdminOrderGroup, filter: AdminOrderFilter): boolean {
  if (filter === "actionable") return group.status === "actionable";
  if (filter === "history") return group.status !== "actionable";
  return true;
}

function sortGroups(left: AdminOrderGroup, right: AdminOrderGroup): number {
  const leftPriority = left.status === "actionable" ? 0 : 1;
  const rightPriority = right.status === "actionable" ? 0 : 1;
  return leftPriority - rightPriority || left.orderCreatedAt.localeCompare(right.orderCreatedAt);
}

export function selectAdminOrderGroups(
  groups: readonly AdminOrderGroup[],
  selection: AdminOrderSelection
): readonly AdminOrderGroup[] {
  const query = selection.query.trim().toLocaleLowerCase("ko-KR");
  return groups.filter((group) => matchesFilter(group, selection.filter) && matchesQuery(group, query)).sort(sortGroups);
}
