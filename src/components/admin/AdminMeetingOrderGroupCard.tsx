import { Icon } from "@/components/ui/Icon";
import type { FulfillmentOrderStatus, FulfillmentOrderRow } from "@/lib/fulfillment-order-types";
import { formatRelativeTimeKo, formatWon } from "@/lib/format";
import type { AdminOrderGroup } from "@/lib/admin-fulfillment-presentation";
import type { ActionHandler, CancelRequestHandler } from "./meeting-orders-workspace-types";

const STATUS_LABELS: Record<FulfillmentOrderStatus, string> = {
  received: "접수",
  preparing: "준비 중",
  served: "완료",
  cancelled: "취소",
  mixed: "부분 처리",
};

function statusClass(status: FulfillmentOrderStatus): string {
  if (status === "served") return "brand-chip-success";
  if (status === "cancelled") return "brand-chip-dimmed";
  if (status === "preparing") return "brand-chip-preparing";
  return "brand-chip-soft";
}

function groupStatusClass(status: AdminOrderGroup["status"]): string {
  if (status === "completed") return "brand-chip-success";
  if (status === "cancelled") return "brand-chip-dimmed";
  return "brand-chip-soft";
}

function OrderRowActions({
  group,
  row,
  submittingRows,
  onAction,
  onRequestCancel,
  onRequestCompletionReversal,
}: {
  readonly group: AdminOrderGroup;
  readonly row: FulfillmentOrderRow;
  readonly submittingRows: ReadonlySet<string>;
  readonly onAction: ActionHandler;
  readonly onRequestCancel: CancelRequestHandler;
  readonly onRequestCompletionReversal: (target: { readonly row: FulfillmentOrderRow; readonly label: string }) => void;
}) {
  const submitting = submittingRows.has(row.rowId);
  const label = `${group.participantName} · ${row.menuName}`;

  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={() => void onAction(row, "prepare")}
        disabled={submitting || row.remainingQuantity <= row.preparingQuantity}
        className="brand-button-secondary min-h-11 rounded-xl px-3 py-2.5 text-xs font-bold"
      >
        준비
      </button>
      <button
        type="button"
        onClick={() => void onAction(row, "serve")}
        disabled={submitting || row.preparingQuantity <= 0}
        className="brand-button-primary min-h-11 rounded-xl px-3 py-2.5 text-xs font-bold"
      >
        완료
      </button>
      <button
        type="button"
        onClick={() => void onAction(row, "undo_prepare")}
        disabled={submitting || row.preparingQuantity <= 0}
        className="brand-button-secondary min-h-11 rounded-xl px-3 py-2.5 text-xs font-bold"
      >
        준비 취소
      </button>
      <button
        type="button"
        onClick={() => onRequestCompletionReversal({ row, label })}
        disabled={submitting || row.servedQuantity <= 0}
        className="brand-button-secondary min-h-11 rounded-xl px-3 py-2.5 text-xs font-bold"
      >
        완료 취소
      </button>
      <button
        type="button"
        onClick={() => onRequestCancel({ row, label })}
        disabled={submitting || !row.canCancel}
        className="brand-button-danger col-span-2 min-h-11 rounded-xl px-3 py-2.5 text-xs font-bold"
      >
        주문 취소
      </button>
    </div>
  );
}

export function AdminMeetingOrderGroupCard({
  group,
  expanded,
  submittingRows,
  onToggle,
  onAction,
  onRequestCancel,
  onRequestCompletionReversal,
}: {
  readonly group: AdminOrderGroup;
  readonly expanded: boolean;
  readonly submittingRows: ReadonlySet<string>;
  readonly onToggle: () => void;
  readonly onAction: ActionHandler;
  readonly onRequestCancel: CancelRequestHandler;
  readonly onRequestCompletionReversal: (target: { readonly row: FulfillmentOrderRow; readonly label: string }) => void;
}) {
  const detailsId = `admin-order-${group.orderId}-details`;
  const relativeTime = formatRelativeTimeKo(group.orderCreatedAt);

  return (
    <article className="brand-panel-white overflow-hidden rounded-3xl">
      <button
        type="button"
        aria-controls={detailsId}
        aria-expanded={expanded}
        className="w-full p-4 text-left transition-colors hover:bg-[var(--brand-primary-soft)]"
        onClick={onToggle}
      >
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p className="truncate text-base font-extrabold text-[var(--brand-text)]">{group.participantName}</p>
              {group.companionId ? <span className="brand-chip-companion rounded-full px-2 py-0.5 text-[10px] font-bold">동반</span> : null}
            </div>
            <p className="brand-text-subtle mt-1 text-xs">
              주문 #{group.orderId}{relativeTime ? ` · ${relativeTime}` : ""} · 메뉴 {group.rows.length}종
            </p>
          </div>
          <div className="flex shrink-0 items-start gap-2">
            <div className="text-right">
              <p className="text-sm font-extrabold text-[var(--brand-text)]">{formatWon(group.totalAmount)}</p>
              <span className={`${groupStatusClass(group.status)} mt-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold`}>
                {group.status === "actionable" ? "처리할 일" : group.status === "cancelled" ? "취소" : "완료"}
              </span>
            </div>
            <Icon className="mt-1 text-[20px] text-[var(--brand-text-subtle)]" name={expanded ? "expand_less" : "expand_more"} />
          </div>
        </div>
      </button>

      {expanded ? (
        <div className="border-t border-[var(--brand-divider)] px-4 pb-4 pt-4" id={detailsId}>
          <div className="space-y-3">
            {group.rows.map((row) => (
              <div key={row.rowId} className="brand-list-item rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[var(--brand-text)]">{row.menuName}</p>
                    <p className="brand-text-subtle mt-1 text-xs">
                      주문 {row.originalQuantity} · 남음 {row.remainingQuantity} · 취소 {row.cancelledQuantity}
                    </p>
                  </div>
                  <span className={`${statusClass(row.status)} shrink-0 rounded-full px-2 py-1 text-[10px] font-bold`}>
                    {STATUS_LABELS[row.status]}
                  </span>
                </div>
                <div className="mt-3">
                  <OrderRowActions
                    group={group}
                    row={row}
                    submittingRows={submittingRows}
                    onAction={onAction}
                    onRequestCancel={onRequestCancel}
                    onRequestCompletionReversal={onRequestCompletionReversal}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </article>
  );
}
