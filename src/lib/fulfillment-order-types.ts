import type { FulfillmentExpectedItem } from "@/lib/fulfillment-order-action";

export function fulfillmentVariantKey(item: {
  readonly menuItemId: number | null;
  readonly menuOptionChoiceId: number | null;
  readonly menuNameSnapshot: string;
  readonly optionChoiceLabelSnapshot: string | null;
}): string {
  const menu = item.menuItemId ?? `deleted:${item.menuNameSnapshot}`;
  if (item.menuOptionChoiceId !== null) return `${menu}:${item.menuOptionChoiceId}`;
  return item.optionChoiceLabelSnapshot
    ? `${menu}:label:${item.optionChoiceLabelSnapshot}`
    : `${menu}:none`;
}

export type FulfillmentOrderStatus = "received" | "preparing" | "served" | "cancelled" | "mixed";

export type FulfillmentOrderRow = {
  readonly rowId: string;
  readonly menuRowId: string;
  readonly orderId: number;
  readonly orderCreatedAt: string;
  readonly itemCreatedAt: string;
  readonly participantId: number;
  readonly participantName: string;
  readonly companionId: number | null;
  readonly menuItemId: number | null;
  readonly menuOptionChoiceId: number | null;
  readonly menuName: string;
  readonly unitPrice: number;
  readonly orderItemIds: readonly number[];
  readonly expectedItems: readonly FulfillmentExpectedItem[];
  readonly originalQuantity: number;
  readonly quantity: number;
  readonly preparingQuantity: number;
  readonly servedQuantity: number;
  readonly remainingQuantity: number;
  readonly cancelledQuantity: number;
  readonly cancelledAmount: number;
  readonly cancelledReasonCode: string | null;
  readonly cancelledReasonText: string | null;
  readonly status: FulfillmentOrderStatus;
  readonly canCancel: boolean;
};

export type AdminMeetingFoodOrdersData = {
  readonly meeting: {
    readonly id: number;
    readonly date: string;
    readonly startTime: string;
    readonly endTime: string;
    readonly location: string;
  };
  readonly summary: {
    readonly approvedCount: number;
    readonly lessonCount: number;
    readonly rentalCount: number;
    readonly orderAmount: number;
    readonly totalOrderedQuantity: number;
    readonly remainingQuantity: number;
    readonly cancelledAmount: number;
    readonly cancelledQuantity: number;
  };
  readonly orderRows: readonly FulfillmentOrderRow[];
  readonly menuRows: ReadonlyArray<{
    readonly rowId: string;
    readonly menuItemId: number | null;
    readonly orderItemIds: readonly number[];
    readonly menuName: string;
    readonly unitPrice: number;
    readonly orderedQuantity: number;
    readonly preparingQuantity: number;
    readonly servedQuantity: number;
    readonly remainingQuantity: number;
    readonly cancelledQuantity: number;
    readonly cancelledAmount: number;
    readonly participantOrders: readonly FulfillmentOrderRow[];
  }>;
  readonly participantRows: ReadonlyArray<{
    readonly participantId: number;
    readonly participantName: string;
    readonly companionId: number | null;
    readonly subtotal: number;
    readonly items: readonly FulfillmentOrderRow[];
  }>;
};
