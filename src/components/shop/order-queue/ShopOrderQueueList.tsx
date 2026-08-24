import { Icon } from "@/components/ui/Icon";
import type { FulfillmentOrderAction } from "@/lib/fulfillment-order-action";
import type { FulfillmentOrderRow } from "@/lib/fulfillment-order-types";
import { formatRelativeTimeKo, formatWon } from "@/lib/format";
import {
  getShopOrderRowActions,
  SHOP_ORDER_STATUS_LABELS,
  type ShopOrderFilter,
} from "@/lib/shop-order-queue";
import type { ShopOrderActionTarget } from "./types";

const STATUS_CLASS = {
  received: "brand-chip-soft",
  preparing: "brand-chip-preparing",
  served: "brand-chip-success",
  cancelled: "brand-chip-danger",
  mixed: "brand-chip-dark",
} as const;

const CONFIRMATION_LABEL = {
  undo_prepare: "준비 취소",
  undo_serve: "완료 취소",
  cancel: "주문 취소",
} as const;

function cancelledReason(row: FulfillmentOrderRow): string | null {
  if (row.cancelledReasonText) return row.cancelledReasonText;
  if (row.cancelledReasonCode === "sold_out") return "품절";
  if (row.cancelledReasonCode === "duplicate") return "중복 주문";
  if (row.cancelledReasonCode === "customer_request") return "고객 요청";
  if (row.cancelledReasonCode === "other") return "기타";
  return row.cancelledReasonCode;
}

function ShopOrderCard({
  index,
  locked,
  onAction,
  onConfirm,
  row,
}: {
  readonly index: number;
  readonly locked: boolean;
  readonly onAction: (row: FulfillmentOrderRow, action: FulfillmentOrderAction) => void;
  readonly onConfirm: (target: NonNullable<ShopOrderActionTarget>) => void;
  readonly row: FulfillmentOrderRow;
}) {
  const actions = getShopOrderRowActions(row);
  const reason = cancelledReason(row);
  const quantity = row.originalQuantity;

  return (
    <article
      aria-busy={locked}
      aria-label={`${row.participantName} ${row.menuName} 주문`}
      className="brand-panel-white overflow-hidden rounded-[1.75rem]"
      data-order-id={row.orderId}
      data-row-id={row.rowId}
    >
      <div className="border-b border-brand-divider px-4 pb-3 pt-4">
        <div className="flex items-center justify-between gap-3">
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold ${STATUS_CLASS[row.status]}`}>
            {SHOP_ORDER_STATUS_LABELS[row.status]}
          </span>
          <span className="brand-text-subtle text-[11px] font-semibold">
            접수 순서 {index + 1} · {formatRelativeTimeKo(row.orderCreatedAt)}
          </span>
        </div>

        <div className="mt-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-extrabold tracking-[-0.025em] text-brand-text">{row.participantName}</h2>
              {row.companionId ? <span className="brand-chip-companion rounded-full px-2 py-0.5 text-[10px] font-bold">동반</span> : null}
            </div>
            <p className="mt-1 text-sm font-semibold text-brand-text">{row.menuName}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className="text-base font-extrabold text-brand-text">{quantity}개</p>
            <p className="brand-text-subtle mt-0.5 text-xs">{formatWon(row.unitPrice * quantity)}</p>
          </div>
        </div>

        <div className="brand-text-subtle mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11px] font-semibold">
          <span>준비 {row.preparingQuantity}</span>
          <span>완료 {row.servedQuantity}</span>
          <span>남음 {row.remainingQuantity}</span>
          <span>주문 #{row.orderId}</span>
        </div>
        {reason ? <p className="mt-2 text-xs font-semibold text-brand-danger-text">취소 사유 · {reason}</p> : null}
      </div>

      {actions.primary || actions.confirmations.length > 0 ? (
        <div className="space-y-2 px-4 py-3">
          {actions.primary ? (
            <button
              aria-label={`${row.participantName} ${row.menuName} ${actions.primary === "prepare" ? "준비 시작" : "전달 완료"}`}
              className="brand-button-primary flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-extrabold"
              disabled={locked}
              onClick={() => onAction(row, actions.primary ?? "prepare")}
              type="button"
            >
              <Icon className="text-[20px]" name={actions.primary === "prepare" ? "skillet" : "task_alt"} />
              {locked ? "처리 중…" : actions.primary === "prepare" ? "준비 시작" : "전달 완료"}
            </button>
          ) : null}

          {actions.confirmations.length > 0 ? (
            <div className={`grid gap-2 ${actions.confirmations.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
              {actions.confirmations.map((action) => (
                <button
                  aria-label={`${row.participantName} ${row.menuName} ${CONFIRMATION_LABEL[action]}`}
                  className={`${action === "cancel" ? "brand-button-danger" : "brand-button-secondary"} rounded-2xl px-3 py-2.5 text-xs font-bold`}
                  disabled={locked}
                  key={action}
                  onClick={() => onConfirm({ row, action })}
                  type="button"
                >
                  {CONFIRMATION_LABEL[action]}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function EmptyQueue({ filter, hasOrders, onReset, query }: {
  readonly filter: ShopOrderFilter;
  readonly hasOrders: boolean;
  readonly onReset: () => void;
  readonly query: string;
}) {
  const filtered = hasOrders && (query.trim().length > 0 || filter !== "active");
  return (
    <div className="brand-panel-white rounded-[1.75rem] px-5 py-10 text-center">
      <Icon className="text-[34px] text-brand-primary-soft-strong" name={filtered ? "search_off" : "room_service"} />
      <p className="mt-3 text-sm font-extrabold text-brand-text">
        {filtered ? "조건에 맞는 주문이 없습니다." : hasOrders ? "처리할 주문을 모두 마쳤습니다." : "아직 들어온 주문이 없습니다."}
      </p>
      <p className="brand-text-subtle mt-1 text-xs">
        {filtered ? "검색어나 상태 필터를 바꿔 보세요." : hasOrders ? "완료 목록에서 처리 내역을 확인할 수 있어요." : "새 주문은 이 화면에 자동으로 나타납니다."}
      </p>
      {filtered ? <button className="brand-button-secondary mt-4 rounded-xl px-4 py-2 text-xs font-bold" onClick={onReset} type="button">검색·필터 초기화</button> : null}
    </div>
  );
}

export function ShopOrderQueueList({
  completedRows,
  filter,
  hasOrders,
  lockedRows,
  onAction,
  onConfirm,
  onReset,
  query,
  rows,
}: {
  readonly completedRows: readonly FulfillmentOrderRow[];
  readonly filter: ShopOrderFilter;
  readonly hasOrders: boolean;
  readonly lockedRows: ReadonlySet<string>;
  readonly onAction: (row: FulfillmentOrderRow, action: FulfillmentOrderAction) => void;
  readonly onConfirm: (target: NonNullable<ShopOrderActionTarget>) => void;
  readonly onReset: () => void;
  readonly query: string;
  readonly rows: readonly FulfillmentOrderRow[];
}) {
  return (
    <section aria-label="주문 처리 목록" className="space-y-3">
      {rows.map((row, index) => (
        <ShopOrderCard index={index} key={row.rowId} locked={lockedRows.has(row.rowId)} onAction={onAction} onConfirm={onConfirm} row={row} />
      ))}
      {rows.length === 0 ? <EmptyQueue filter={filter} hasOrders={hasOrders} onReset={onReset} query={query} /> : null}

      {filter === "active" && completedRows.length > 0 ? (
        <details className="group brand-panel-white overflow-hidden rounded-[1.75rem]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-extrabold text-brand-text">
            <span>완료한 주문 {completedRows.length}건</span>
            <span className="brand-chip-success rounded-full px-2.5 py-1 text-[11px]">
              <span className="group-open:hidden">펼쳐보기</span>
              <span className="hidden group-open:inline">접기</span>
            </span>
          </summary>
          <div className="space-y-3 border-t border-brand-divider p-3">
            {completedRows.map((row, index) => (
              <ShopOrderCard index={index} key={row.rowId} locked={lockedRows.has(row.rowId)} onAction={onAction} onConfirm={onConfirm} row={row} />
            ))}
          </div>
        </details>
      ) : null}
    </section>
  );
}
