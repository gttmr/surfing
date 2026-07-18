import { Icon } from "@/components/ui/Icon";
import { formatWon } from "@/lib/format";
import type { ParticipantFoodOrderData } from "@/lib/food-ordering-data";
import {
  formatOrderTime,
  getOrderItemPresentation,
  getOrderPresentation,
} from "@/lib/participant-order-ui";

const ORDER_TONE = {
  received: "brand-chip-soft",
  preparing: "brand-chip-preparing",
  served: "brand-chip-success",
  cancelled: "brand-chip-dimmed",
  mixed: "brand-chip-danger",
} as const;

const ITEM_TONE = {
  received: "brand-text-subtle",
  preparing: "text-[var(--brand-preparing-text)]",
  served: "text-[var(--brand-success-text)]",
  cancelled: "text-[var(--brand-danger-text)]",
} as const;

function itemName(order: ParticipantFoodOrderData, itemIndex: number): string {
  const item = order.items[itemIndex];
  if (!item) return "주문 항목";
  return item.optionChoiceLabelSnapshot
    ? `${item.menuNameSnapshot} · ${item.optionChoiceLabelSnapshot}`
    : item.menuNameSnapshot;
}

export function SubmissionHistory({
  orders,
  participantName,
  canOrder,
  orderOpen,
  notice,
  message,
  hasConflictDraft,
  disabled,
  onAdd,
  onEdit,
  onCancel,
  onReapply,
}: {
  readonly orders: readonly ParticipantFoodOrderData[];
  readonly participantName: string;
  readonly canOrder: boolean;
  readonly orderOpen: boolean;
  readonly notice: string;
  readonly message: string;
  readonly hasConflictDraft: boolean;
  readonly disabled: boolean;
  readonly onAdd: () => void;
  readonly onEdit: (order: ParticipantFoodOrderData) => void;
  readonly onCancel: (order: ParticipantFoodOrderData) => void;
  readonly onReapply: () => void;
}) {
  return (
    <section aria-labelledby="submission-history-title" className="space-y-4 pb-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold text-[var(--brand-text)]" id="submission-history-title">주문 내역</h3>
          <p className="brand-text-subtle mt-1 text-xs">{participantName}의 제출을 시간순으로 보관합니다.</p>
        </div>
        <span className="brand-chip-strong shrink-0 rounded-full px-2.5 py-1 text-xs font-bold">{orders.length}건</span>
      </div>

      {notice ? <div className="brand-alert-success rounded-2xl px-4 py-3 text-sm" role="status">{notice}</div> : null}
      {message ? (
        <div className="brand-alert-error rounded-2xl px-4 py-3 text-sm" role="alert">
          <p className="font-bold">현재 주문 상태를 다시 확인해 주세요.</p>
          <p className="mt-1 text-xs leading-5">{message}</p>
          {hasConflictDraft ? (
            <button className="brand-button-secondary mt-3 min-h-11 rounded-2xl px-4 text-sm font-bold" onClick={onReapply} type="button">보관한 선택 다시 담기</button>
          ) : null}
        </div>
      ) : null}

      {orders.length === 0 ? (
        <div className="brand-panel-white rounded-3xl px-5 py-8 text-center">
          <Icon className="text-[32px] text-[var(--brand-primary-text)]" name="receipt_long" />
          <p className="mt-2 text-sm font-extrabold text-[var(--brand-text)]">
            {canOrder && orderOpen ? "아직 주문 내역이 없습니다" : "표시할 주문 내역이 없습니다"}
          </p>
          <p className="brand-text-subtle mt-1 text-xs">
            {canOrder && orderOpen ? "메뉴를 골라 첫 주문을 남겨 보세요." : "주문이 접수되면 이곳에 시간순으로 표시됩니다."}
          </p>
        </div>
      ) : orders.map((order, index) => {
        const presentation = getOrderPresentation(order);
        const editable = canOrder && orderOpen && presentation.editable;
        const lockedReason = !orderOpen && presentation.editable
          ? "오늘 모임의 주문만 변경할 수 있습니다."
          : presentation.lockedReason;
        const orderTotal = order.items.reduce((total, item) => total + item.unitPriceSnapshot * item.quantity, 0);
        return (
          <article className="brand-panel-white rounded-3xl p-4" key={order.orderId}>
            <header className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-extrabold text-[var(--brand-text)]">{index + 1}번째 주문</p>
                <p className="brand-text-subtle mt-1 text-xs">{formatOrderTime(order.createdAt)} · {formatWon(orderTotal)}</p>
              </div>
              <span className={`${ORDER_TONE[presentation.tone]} shrink-0 rounded-full px-2.5 py-1 text-xs font-bold`}>{presentation.label}</span>
            </header>
            <ul aria-label={`${index + 1}번째 주문 메뉴`} className="mt-3 divide-y divide-[var(--brand-divider)]">
              {order.items.map((item, itemIndex) => {
                const itemState = getOrderItemPresentation(item);
                return (
                  <li className="flex items-start justify-between gap-3 py-2.5" key={item.id}>
                    <div className="min-w-0">
                      <p className="break-words text-sm font-semibold leading-5 text-[var(--brand-text)]">{itemName(order, itemIndex)}</p>
                      <p className="brand-text-subtle mt-0.5 text-xs">{formatWon(item.unitPriceSnapshot)} × {item.quantity}</p>
                    </div>
                    <span className={`${ITEM_TONE[itemState.tone]} shrink-0 text-xs font-bold`}>{itemState.label}</span>
                  </li>
                );
              })}
            </ul>
            {editable ? (
              <div className="mt-3 grid grid-cols-2 gap-2">
                <button aria-label={`${index + 1}번째 주문 수정`} className="brand-button-secondary min-h-11 rounded-2xl px-3 text-sm font-bold" disabled={disabled} onClick={() => onEdit(order)} type="button">수정</button>
                <button aria-label={`${index + 1}번째 주문 취소`} className="brand-button-danger min-h-11 rounded-2xl px-3 text-sm font-bold" disabled={disabled} onClick={() => onCancel(order)} type="button">취소</button>
              </div>
            ) : lockedReason ? <p className="brand-text-subtle mt-3 text-xs leading-5">{lockedReason}</p> : null}
          </article>
        );
      })}

      {canOrder && orderOpen ? (
        <button className="brand-button-primary flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl px-4 text-sm font-bold" disabled={disabled} onClick={onAdd} type="button">
          <Icon className="text-[20px]" name="add_shopping_cart" /> {orders.length > 0 ? "새 주문 추가" : "메뉴 고르기"}
        </button>
      ) : null}
    </section>
  );
}
