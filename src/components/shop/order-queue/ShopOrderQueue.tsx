"use client";

import { useMemo, useState } from "react";
import { Toast } from "@/components/ui/Toast";
import type { FulfillmentOrderAction } from "@/lib/fulfillment-order-action";
import type { AdminMeetingFoodOrdersData, FulfillmentOrderRow } from "@/lib/fulfillment-order-types";
import { selectShopOrderRows, summarizeShopOrderRows } from "@/lib/shop-order-queue";
import { ShopOrderActionDialog } from "./ShopOrderActionDialog";
import { ShopOrderQueueControls } from "./ShopOrderQueueControls";
import { ShopOrderQueueList } from "./ShopOrderQueueList";
import { ShopOrderSoundAlert } from "./ShopOrderSoundAlert";
import type { ShopOrderActionOptions, ShopOrderActionTarget } from "./types";
import { useShopOrderQueue } from "./useShopOrderQueue";

export function ShopOrderQueue({
  initialData,
  ordersEndpoint,
}: {
  readonly initialData: AdminMeetingFoodOrdersData;
  readonly ordersEndpoint: string;
}) {
  const queue = useShopOrderQueue({ initialData, ordersEndpoint });
  const [actionTarget, setActionTarget] = useState<ShopOrderActionTarget>(null);
  const summary = useMemo(() => summarizeShopOrderRows(queue.data.orderRows), [queue.data.orderRows]);
  const rows = useMemo(() => selectShopOrderRows(queue.data.orderRows, {
    filter: queue.filter,
    query: queue.query,
  }), [queue.data.orderRows, queue.filter, queue.query]);
  const completedRows = useMemo(() => selectShopOrderRows(queue.data.orderRows, {
    filter: "served",
    query: queue.query,
  }), [queue.data.orderRows, queue.query]);

  function runAction(row: FulfillmentOrderRow, action: FulfillmentOrderAction) {
    void queue.mutate(row, action);
  }

  async function confirmAction(options?: ShopOrderActionOptions) {
    if (!actionTarget) return;
    const result = await queue.mutate(actionTarget.row, actionTarget.action, options);
    if (result !== "error") setActionTarget(null);
  }

  return (
    <div className="space-y-5">
      <ShopOrderQueueControls
        filter={queue.filter}
        lastUpdatedAt={queue.lastUpdatedAt}
        notice={queue.notice}
        onDismissNotice={() => queue.setNotice(null)}
        onFilterChange={queue.setFilter}
        onQueryChange={queue.setQuery}
        onRefresh={() => { void queue.refresh("manual"); }}
        query={queue.query}
        refreshError={queue.refreshError}
        refreshing={queue.refreshing}
        summary={summary}
        total={queue.data.orderRows.length}
      />

      <ShopOrderSoundAlert signal={queue.newOrderSignal} />

      <ShopOrderQueueList
        completedRows={completedRows}
        filter={queue.filter}
        hasOrders={queue.data.orderRows.length > 0}
        lockedRows={queue.lockedRows}
        onAction={runAction}
        onConfirm={setActionTarget}
        onReset={() => {
          queue.setQuery("");
          queue.setFilter("active");
        }}
        query={queue.query}
        rows={rows}
      />

      <ShopOrderActionDialog
        key={actionTarget ? `${actionTarget.row.rowId}:${actionTarget.action}` : "closed"}
        onClose={() => setActionTarget(null)}
        onConfirm={(options) => { void confirmAction(options); }}
        submitting={actionTarget ? queue.lockedRows.has(actionTarget.row.rowId) : false}
        target={actionTarget}
      />
      {queue.toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} onClose={() => queue.removeToast(toast.id)} type={toast.type} />
      ))}
    </div>
  );
}
