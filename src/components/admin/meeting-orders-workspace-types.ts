import type { AdminMeetingFoodOrdersData } from "@/lib/food-ordering-data";
import type { FulfillmentOrderRow } from "@/lib/fulfillment-order-types";

export type OrderAction = "prepare" | "serve" | "undo_prepare" | "undo_serve" | "cancel";

export type OrderActionOptions = {
  readonly reasonCode?: string;
  readonly reasonText?: string;
};

export type ActionHandler = (
  row: FulfillmentOrderRow,
  action: OrderAction,
  options?: OrderActionOptions
) => Promise<void>;

export type CancelTarget = {
  readonly row: FulfillmentOrderRow;
  readonly label: string;
} | null;

export type CancelRequestHandler = (target: NonNullable<CancelTarget>) => void;

export type MeetingOrdersViewProps = {
  readonly data: AdminMeetingFoodOrdersData;
  readonly submittingRows: ReadonlySet<string>;
  readonly onAction: ActionHandler;
  readonly onRequestCancel: CancelRequestHandler;
};
