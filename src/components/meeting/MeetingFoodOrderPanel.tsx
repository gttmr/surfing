"use client";

import { FoodOrderTriggerCard } from "@/components/meeting/food-order/FoodOrderTriggerCard";
import { OrderCartFooter } from "@/components/meeting/food-order/OrderCartFooter";
import { OrderMenuDiscovery } from "@/components/meeting/food-order/OrderMenuDiscovery";
import { OrderReview, OrderReviewFooter } from "@/components/meeting/food-order/OrderReview";
import { SubmissionHistory } from "@/components/meeting/food-order/SubmissionHistory";
import { useMeetingFoodOrder } from "@/components/meeting/food-order/useMeetingFoodOrder";
import { Dialog, Sheet } from "@/components/ui/Dialog";

function participantRoleClass(role: "self" | "owner_proxy" | "linked_companion_locked") {
  if (role === "owner_proxy") return "brand-chip-companion";
  if (role === "linked_companion_locked") return "brand-chip-dimmed";
  return "brand-chip-soft";
}

export function MeetingFoodOrderPanel({ meetingId }: { readonly meetingId: number }) {
  const order = useMeetingFoodOrder(meetingId);

  if (order.loading && !order.data) {
    return (
      <div aria-live="polite" className="brand-card-soft rounded-3xl px-4 py-6 text-center text-sm brand-text-subtle">
        주문 정보를 불러오는 중...
      </div>
    );
  }

  if (order.loadError && !order.data) {
    return (
      <div className="brand-alert-error rounded-3xl px-4 py-4 text-sm" role="alert">
        <p className="font-bold">주문 정보를 불러오지 못했습니다.</p>
        <p className="mt-1 text-xs">{order.loadError}</p>
        <button className="brand-button-secondary mt-3 min-h-11 rounded-2xl px-4 text-sm font-bold" onClick={() => void order.load()} type="button">다시 불러오기</button>
      </div>
    );
  }

  if (!order.data || order.data.participants.length === 0) return null;

  const editing = order.editor.kind === "edit";
  const editedOrderId = order.editor.kind === "edit" ? order.editor.orderId : null;
  const editedIndex = editedOrderId !== null
    ? order.selectedOrders.findIndex((item) => item.orderId === editedOrderId) + 1
    : 0;
  const cancelIndex = order.cancelTarget
    ? order.selectedOrders.findIndex((item) => item.orderId === order.cancelTarget?.orderId) + 1
    : 0;
  const footer = order.view === "discover" && order.selectedParticipant?.canOrder ? (
    <OrderCartFooter
      disabled={order.saving}
      editing={editing}
      onReview={() => order.setView("review")}
      summary={order.summary}
    />
  ) : order.view === "review" ? (
    <OrderReviewFooter
      editing={editing}
      onBack={() => order.setView("discover")}
      onSubmit={() => void order.submit()}
      saving={order.saving}
    />
  ) : undefined;

  return (
    <>
      <FoodOrderTriggerCard data={order.data} onOpen={order.showPanel} />

      <Sheet
        closeLabel="점심 메뉴 주문 닫기"
        description="메뉴를 검색하고 제출별 주문 상태를 확인하세요."
        footer={footer}
        onClose={() => order.setOpen(false)}
        open={order.open}
        title="점심 메뉴 주문"
      >
        {order.data.participants.length > 1 ? (
          <div aria-label="주문 대상" className="mb-4 grid grid-cols-2 gap-2" role="group">
            {order.data.participants.map((participant) => {
              const selected = participant.participantId === order.selectedParticipantId;
              return (
                <button
                  aria-pressed={selected}
                  className={`min-h-11 rounded-2xl px-3 py-2 text-left ${selected ? "brand-toggle-active" : "brand-button-secondary"}`}
                  key={participant.participantId}
                  onClick={() => order.chooseParticipant(participant.participantId)}
                  type="button"
                >
                  <span className="block break-words text-sm font-extrabold leading-5">{participant.name}</span>
                  <span className="brand-text-subtle mt-0.5 block text-[10px]">{participant.roleLabel}</span>
                </button>
              );
            })}
          </div>
        ) : null}

        {order.selectedParticipant ? (
          <>
            <div className="mb-4 flex items-start justify-between gap-3 rounded-2xl bg-[var(--brand-primary-soft)] px-3 py-3">
              <div className="min-w-0">
                <p className="break-words text-sm font-extrabold leading-5 text-[var(--brand-text)]">{order.selectedParticipant.name}</p>
                <p className="brand-text-subtle mt-0.5 text-xs">
                  {!order.selectedParticipant.canOrder
                    ? "읽기 전용 주문 내역"
                    : order.view === "history"
                      ? "제출별 주문 내역"
                      : editing
                        ? `${editedIndex}번째 주문 전체 수정`
                        : "새 주문 추가"}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className={`${participantRoleClass(order.selectedParticipant.orderRole)} rounded-full px-2 py-1 text-[10px] font-bold`}>{order.selectedParticipant.roleLabel}</span>
                {order.view !== "history" && order.selectedOrders.length > 0 ? (
                  <button className="brand-button-secondary min-h-9 rounded-full px-3 text-xs font-bold" disabled={order.saving} onClick={() => order.setView("history")} type="button">주문 내역</button>
                ) : null}
              </div>
            </div>

            {order.view === "history" ? (
              <SubmissionHistory
                canOrder={order.selectedParticipant.canOrder}
                disabled={order.saving}
                hasConflictDraft={order.conflictDraft?.participantId === order.selectedParticipant.participantId}
                message={order.message}
                notice={order.notice}
                onAdd={() => order.startAdd()}
                onCancel={order.setCancelTarget}
                onEdit={order.startEdit}
                onReapply={order.reapplyConflict}
                orderOpen={order.data.meeting.orderOpen}
                orders={order.selectedOrders}
                participantName={order.selectedParticipant.name}
              />
            ) : order.selectedParticipant.canOrder && order.view === "discover" ? (
              <>
                {order.notice ? <div className="brand-alert-success mb-4 rounded-2xl px-4 py-3 text-sm" role="status">{order.notice}</div> : null}
                <OrderMenuDiscovery
                  disabled={order.saving}
                  draft={order.draft}
                  onQuantityChange={order.updateQuantity}
                  onQueryChange={order.setQuery}
                  onSelectedOnlyChange={order.setSelectedOnly}
                  query={order.query}
                  selectedOnly={order.selectedOnly}
                  variants={order.variants}
                />
              </>
            ) : order.selectedParticipant.canOrder && order.view === "review" ? (
              <OrderReview
                editing={editing}
                lines={order.lines}
                message={order.message}
                participantName={order.selectedParticipant.name}
                summary={order.summary}
              />
            ) : (
              <div className="brand-panel-white rounded-3xl px-5 py-8 text-center">
                <p className="text-sm font-extrabold text-[var(--brand-text)]">
                  {order.selectedParticipant.orderRole === "linked_companion_locked" ? "연동된 동반인이 직접 주문합니다." : "주문 내역만 확인할 수 있습니다."}
                </p>
                <p className="brand-text-subtle mt-1 text-xs leading-5">{order.selectedParticipant.lockedReason}</p>
                <button className="brand-button-secondary mt-4 min-h-11 rounded-2xl px-4 text-sm font-bold" onClick={() => order.setView("history")} type="button">주문 내역 보기</button>
              </div>
            )}
          </>
        ) : null}
      </Sheet>

      <Dialog
        description={`${cancelIndex > 0 ? `${cancelIndex}번째 주문` : "이 주문"}의 원본 항목과 금액은 취소 이력으로 계속 보관됩니다.`}
        onClose={() => order.setCancelTarget(null)}
        open={order.cancelTarget !== null}
        title={`${cancelIndex > 0 ? `${cancelIndex}번째 주문을` : "주문을"} 취소할까요?`}
      >
        <div className="grid grid-cols-2 gap-2">
          <button className="brand-button-secondary min-h-11 rounded-2xl px-3 text-sm font-bold" disabled={order.saving} onClick={() => order.setCancelTarget(null)} type="button">유지하기</button>
          <button className="brand-button-danger-solid min-h-11 rounded-2xl px-3 text-sm font-bold" disabled={order.saving} onClick={() => void order.confirmCancel()} type="button">{order.saving ? "취소 중..." : "주문 취소"}</button>
        </div>
      </Dialog>
    </>
  );
}
