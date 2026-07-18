import type { FulfillmentOrderAction } from "@/lib/fulfillment-order-action";
import type { FulfillmentOrderRow } from "@/lib/fulfillment-order-types";
import type { ShopOrderConfirmationAction } from "@/lib/shop-order-queue";

export type ShopOrderActionOptions = {
  readonly reasonCode?: string;
  readonly reasonText?: string;
};

export type ShopOrderActionTarget = {
  readonly row: FulfillmentOrderRow;
  readonly action: ShopOrderConfirmationAction;
} | null;

export type ShopOrderActionHandler = (
  row: FulfillmentOrderRow,
  action: FulfillmentOrderAction,
  options?: ShopOrderActionOptions,
) => Promise<"success" | "conflict" | "error">;
