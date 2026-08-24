import type { AdminMeetingFoodOrdersData } from "@/lib/food-ordering-data";
import { formatRelativeTimeKo } from "@/lib/format";
import type { ActionHandler, CancelRequestHandler } from "./meeting-orders-workspace-types";

export function MeetingOrdersShopMenuBoard({
  data,
  submittingRows,
  onAction,
  onRequestCancel,
}: {
  readonly data: AdminMeetingFoodOrdersData;
  readonly submittingRows: ReadonlySet<string>;
  readonly onAction: ActionHandler;
  readonly onRequestCancel: CancelRequestHandler;
}) {
  const activeMenuRows = data.menuRows
    .map((menu) => ({
      ...menu,
      participantOrders: menu.participantOrders.filter((order) => order.remainingQuantity > 0),
    }))
    .filter((menu) => menu.participantOrders.length > 0);

  const completedOrders = data.menuRows.flatMap((menu) =>
    menu.participantOrders
      .filter((order) => order.remainingQuantity === 0)
      .map((order) => ({ ...order, menuName: menu.menuName, unitPrice: menu.unitPrice }))
  );

  if (activeMenuRows.length === 0 && completedOrders.length === 0) {
    return (
      <section className="brand-panel-white rounded-3xl px-5 py-10 text-center">
        <p className="text-sm font-semibold text-brand-text">들어온 주문이 없습니다.</p>
        <p className="brand-text-subtle mt-1 text-xs">참가자가 주문하면 여기서 바로 처리할 수 있습니다.</p>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      {activeMenuRows.map((menu) => (
        <section key={menu.rowId} className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <span className="h-4 w-1 rounded-full bg-brand-primary" />
            <p className="truncate text-[15px] font-extrabold tracking-[-0.02em] text-brand-text">
              {menu.menuName}
            </p>
          </div>

          <div className="brand-panel-white overflow-hidden rounded-[1.7rem]">
            {menu.participantOrders.map((order, index) => {
              const relativeTime = formatRelativeTimeKo(order.orderCreatedAt);
              const isPreparing = order.preparingQuantity > 0;
              const prepareAction: "prepare" | "undo_prepare" = isPreparing ? "undo_prepare" : "prepare";

              return (
                <div
                  key={order.rowId}
                  className={index > 0 ? "border-t border-brand-divider" : ""}
                >
                  <div className="flex items-center gap-3 px-4 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[15px] font-bold text-brand-text">
                          {order.participantName}
                        </p>
                        {order.quantity > 1 ? (
                          <span className="brand-chip-soft rounded-full px-2 py-0.5 text-[10px] font-bold">
                            {order.quantity}개
                          </span>
                        ) : null}
                      </div>
                      {relativeTime ? (
                        <p className="brand-text-subtle mt-1 text-[11px]">{relativeTime}</p>
                      ) : null}
                    </div>

                    <div className="grid shrink-0 grid-cols-3 gap-2">
                      {/* 준비 시작 ↔ 준비 중 토글 */}
                      <button
                        type="button"
                        onClick={() => void onAction(order, prepareAction)}
                        disabled={submittingRows.has(order.rowId)}
                        className={`min-w-[76px] rounded-2xl px-3 py-3.5 text-[13px] font-bold transition-colors ${
                          isPreparing ? "brand-chip-preparing" : "brand-button-secondary"
                        }`}
                      >
                        {isPreparing ? "준비 중" : "준비 시작"}
                      </button>
                      {/* 완료 */}
                      <button
                        type="button"
                        onClick={() => void onAction(order, "serve")}
                        disabled={
                          submittingRows.has(order.rowId) ||
                          order.remainingQuantity <= 0
                        }
                        className="brand-button-primary min-w-[76px] rounded-2xl px-3 py-3.5 text-[13px] font-bold"
                      >
                        완료
                      </button>
                      <button
                        type="button"
                        onClick={() => onRequestCancel({
                          row: order,
                          label: `${order.participantName} · ${menu.menuName}`,
                        })}
                        disabled={
                          submittingRows.has(order.rowId) ||
                          !order.canCancel
                        }
                        className="brand-button-danger min-w-[76px] rounded-2xl px-3 py-3.5 text-[13px] font-bold"
                      >
                        취소
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ))}

      {completedOrders.length > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <span className="h-4 w-1 rounded-full bg-brand-primary-soft-strong" />
            <p className="truncate text-[15px] font-extrabold tracking-[-0.02em] text-brand-text">완료</p>
          </div>

          <div className="brand-panel-white overflow-hidden rounded-[1.7rem]">
            {completedOrders.map((order, index) => {
              const meta = [order.menuName, order.quantity > 1 ? `${order.quantity}개` : null, formatRelativeTimeKo(order.orderCreatedAt)]
                .filter(Boolean)
                .join(" · ");

              return (
                <div
                  key={`completed-${order.rowId}`}
                  className={index > 0 ? "border-t border-brand-divider" : ""}
                >
                  <div className="flex items-center gap-3 px-4 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-bold text-brand-text">
                        {order.participantName}
                      </p>
                      <p className="brand-text-subtle mt-1 text-[11px]">{meta}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void onAction(order, "undo_serve")}
                      disabled={submittingRows.has(order.rowId)}
                      className="brand-button-secondary min-w-[100px] rounded-2xl px-4 py-3.5 text-[13px] font-bold"
                    >
                      완료 취소
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}
    </div>
  );
}
