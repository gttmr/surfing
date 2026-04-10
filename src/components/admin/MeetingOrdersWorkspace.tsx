"use client";

import { useMemo, useState } from "react";
import { Toast, useToast } from "@/components/ui/Toast";
import type { AdminMeetingFoodOrdersData } from "@/lib/food-ordering-data";
import { formatRelativeTimeKo, formatWon } from "@/lib/format";

type OrderAction = "prepare" | "serve" | "undo_prepare" | "undo_serve";
type ActionHandler = (participantId: number, menuItemId: number, action: OrderAction) => Promise<void>;

function ShopSummaryBar({ data }: { data: AdminMeetingFoodOrdersData }) {
  const preparingQuantity = data.menuRows.reduce((sum, menu) => sum + menu.preparingQuantity, 0);
  const completedQuantity = data.menuRows.reduce((sum, menu) => sum + menu.servedQuantity, 0);

  const chips = [
    { label: "전체주문", value: data.summary.totalOrderedQuantity, className: "brand-chip-soft" },
    { label: "준비 중", value: preparingQuantity, className: "brand-chip-preparing" },
    { label: "완료", value: completedQuantity, className: "brand-chip-dark" },
  ];

  return (
    <section className="flex gap-2">
      {chips.map(({ label, value, className }) => (
        <div
          key={label}
          className={`flex flex-1 flex-col items-center rounded-2xl px-3 py-3 ${className}`}
        >
          <p className="text-[11px] font-bold opacity-70">{label}</p>
          <p className="mt-0.5 text-[1.4rem] font-extrabold tracking-[-0.03em]">{value}</p>
        </div>
      ))}
    </section>
  );
}

function ShopMenuBoard({
  data,
  submittingKey,
  onAction,
}: {
  data: AdminMeetingFoodOrdersData;
  submittingKey: string | null;
  onAction: ActionHandler;
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
        <p className="text-sm font-semibold text-[var(--brand-text)]">들어온 주문이 없습니다.</p>
        <p className="brand-text-subtle mt-1 text-xs">참가자가 주문하면 여기서 바로 처리할 수 있습니다.</p>
      </section>
    );
  }

  return (
    <div className="space-y-8">
      {activeMenuRows.map((menu) => (
        <section key={menu.menuItemId} className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <span className="h-4 w-1 rounded-full bg-[var(--brand-primary)]" />
            <p className="truncate text-[15px] font-extrabold tracking-[-0.02em] text-[var(--brand-text)]">
              {menu.menuName}
            </p>
          </div>

          <div className="brand-panel-white overflow-hidden rounded-[1.7rem]">
            {menu.participantOrders.map((order, index) => {
              const key = `${order.participantId}:${menu.menuItemId}`;
              const relativeTime = order.orderedAt ? formatRelativeTimeKo(order.orderedAt) : "";
              const isPreparing = order.preparingQuantity > 0;
              const prepareAction: OrderAction = isPreparing ? "undo_prepare" : "prepare";

              return (
                <div
                  key={key}
                  className={index > 0 ? "border-t border-[var(--brand-divider)]" : ""}
                >
                  <div className="flex items-center gap-3 px-4 py-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-[15px] font-bold text-[var(--brand-text)]">
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

                    <div className="grid shrink-0 grid-cols-2 gap-2">
                      {/* 준비 시작 ↔ 준비 중 토글 */}
                      <button
                        type="button"
                        onClick={() => void onAction(order.participantId, menu.menuItemId, prepareAction)}
                        disabled={
                          submittingKey === `${key}:prepare` ||
                          submittingKey === `${key}:undo_prepare`
                        }
                        className={`min-w-[100px] rounded-2xl px-4 py-3.5 text-[13px] font-bold transition-colors ${
                          isPreparing ? "brand-chip-preparing" : "brand-button-secondary"
                        }`}
                      >
                        {isPreparing ? "준비 중" : "준비 시작"}
                      </button>
                      {/* 완료 */}
                      <button
                        type="button"
                        onClick={() => void onAction(order.participantId, menu.menuItemId, "serve")}
                        disabled={
                          submittingKey === `${key}:serve` ||
                          order.remainingQuantity <= 0
                        }
                        className="brand-button-primary min-w-[100px] rounded-2xl px-4 py-3.5 text-[13px] font-bold"
                      >
                        완료
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
            <span className="h-4 w-1 rounded-full bg-[var(--brand-primary-soft-strong)]" />
            <p className="truncate text-[15px] font-extrabold tracking-[-0.02em] text-[var(--brand-text)]">완료</p>
          </div>

          <div className="brand-panel-white overflow-hidden rounded-[1.7rem]">
            {completedOrders.map((order, index) => {
              const key = `${order.participantId}:${order.menuItemId}`;
              const meta = [order.menuName, order.quantity > 1 ? `${order.quantity}개` : null, order.orderedAt ? formatRelativeTimeKo(order.orderedAt) : null]
                .filter(Boolean)
                .join(" · ");

              return (
                <div
                  key={`completed-${key}`}
                  className={index > 0 ? "border-t border-[var(--brand-divider)]" : ""}
                >
                  <div className="flex items-center gap-3 px-4 py-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-bold text-[var(--brand-text)]">
                        {order.participantName}
                      </p>
                      <p className="brand-text-subtle mt-1 text-[11px]">{meta}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => void onAction(order.participantId, order.menuItemId, "undo_serve")}
                      disabled={submittingKey === `${key}:undo_serve`}
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

function AdminOrdersWorkspace({
  data,
  expandedMenuIds,
  participantQuery,
  submittingKey,
  onParticipantQueryChange,
  onToggleMenu,
  onAction,
}: {
  data: AdminMeetingFoodOrdersData;
  expandedMenuIds: Set<number>;
  participantQuery: string;
  submittingKey: string | null;
  onParticipantQueryChange: (value: string) => void;
  onToggleMenu: (menuItemId: number) => void;
  onAction: ActionHandler;
}) {
  const filteredParticipantRows = useMemo(() => {
    const query = participantQuery.trim().toLowerCase();
    if (!query) return data.participantRows;
    return data.participantRows.filter((p) =>
      p.participantName.toLowerCase().includes(query)
    );
  }, [data.participantRows, participantQuery]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3">
        <div className="brand-card-soft rounded-3xl p-4">
          <p className="brand-text-subtle text-[11px] font-bold uppercase tracking-[0.24em]">참가</p>
          <p className="mt-2 text-2xl font-extrabold text-[var(--brand-text)]">{data.summary.approvedCount}명</p>
          <p className="brand-text-muted mt-1 text-xs">강습 {data.summary.lessonCount} · 대여 {data.summary.rentalCount}</p>
        </div>
        <div className="brand-card-soft rounded-3xl p-4">
          <p className="brand-text-subtle text-[11px] font-bold uppercase tracking-[0.24em]">판매 합계</p>
          <p className="mt-2 text-2xl font-extrabold text-[var(--brand-text)]">{formatWon(data.summary.orderAmount)}</p>
          <p className="brand-text-muted mt-1 text-xs">총 {data.summary.totalOrderedQuantity}개 주문</p>
        </div>
        <div className="brand-card-soft rounded-3xl p-4">
          <p className="brand-text-subtle text-[11px] font-bold uppercase tracking-[0.24em]">미제공</p>
          <p className="mt-2 text-2xl font-extrabold text-[var(--brand-text)]">{data.summary.remainingQuantity}개</p>
          <p className="brand-text-muted mt-1 text-xs">아직 전달되지 않은 메뉴</p>
        </div>
        <div className="brand-card-soft rounded-3xl p-4">
          <p className="brand-text-subtle text-[11px] font-bold uppercase tracking-[0.24em]">주문자</p>
          <p className="mt-2 text-2xl font-extrabold text-[var(--brand-text)]">{data.participantRows.length}명</p>
          <p className="brand-text-muted mt-1 text-xs">상세 목록에서 검색 가능</p>
        </div>
      </div>

      <section className="brand-card-soft rounded-3xl p-5">
        <div className="mb-4">
          <h2 className="text-base font-extrabold text-[var(--brand-text)]">메뉴별 처리 보드</h2>
        </div>
        <div className="space-y-3">
          {data.menuRows.map((menu) => {
            const expanded = expandedMenuIds.has(menu.menuItemId);
            return (
              <div key={menu.menuItemId} className="brand-panel-white rounded-3xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => onToggleMenu(menu.menuItemId)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-bold text-[var(--brand-text)]">{menu.menuName}</p>
                      <span className="brand-chip-soft rounded-full px-2 py-0.5 text-[10px] font-bold">
                        {formatWon(menu.unitPrice)}
                      </span>
                    </div>
                    <div className="brand-text-muted mt-2 flex flex-wrap gap-2 text-xs">
                      <span>주문 {menu.orderedQuantity}</span>
                      <span>준비중 {menu.preparingQuantity}</span>
                      <span>제공완료 {menu.servedQuantity}</span>
                      <span>남음 {menu.remainingQuantity}</span>
                    </div>
                  </button>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${menu.remainingQuantity > 0 ? "brand-chip-dark" : "brand-chip-success"}`}>
                    {menu.remainingQuantity > 0 ? "진행중" : "완료"}
                  </span>
                </div>

                {expanded ? (
                  <div className="mt-4 space-y-3 border-t border-[var(--brand-divider)] pt-4">
                    {menu.participantOrders.length === 0 ? (
                      <div className="brand-text-subtle rounded-2xl py-4 text-center text-sm">
                        아직 주문이 없습니다.
                      </div>
                    ) : (
                      menu.participantOrders.map((order) => {
                        const key = `${order.participantId}:${menu.menuItemId}`;
                        const companionLabel = order.companionId ? "동반" : "정회원";
                        return (
                          <div key={key} className="brand-list-item rounded-2xl p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-bold text-[var(--brand-text)]">{order.participantName}</p>
                                <p className="brand-text-subtle mt-1 text-xs">
                                  {companionLabel} · 주문 {order.quantity} · 남음 {order.remainingQuantity}
                                </p>
                              </div>
                              <div className="grid grid-cols-2 gap-2">
                                <button
                                  type="button"
                                  onClick={() => void onAction(order.participantId, menu.menuItemId, "prepare")}
                                  disabled={
                                    submittingKey === `${key}:prepare` ||
                                    order.remainingQuantity <= order.preparingQuantity
                                  }
                                  className="brand-button-secondary rounded-xl px-3 py-2 text-xs font-bold"
                                >
                                  준비
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void onAction(order.participantId, menu.menuItemId, "serve")}
                                  disabled={
                                    submittingKey === `${key}:serve` ||
                                    order.preparingQuantity <= 0
                                  }
                                  className="brand-button-primary rounded-xl px-3 py-2 text-xs font-bold"
                                >
                                  완료
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void onAction(order.participantId, menu.menuItemId, "undo_prepare")}
                                  disabled={
                                    submittingKey === `${key}:undo_prepare` ||
                                    order.preparingQuantity <= 0
                                  }
                                  className="brand-button-secondary rounded-xl px-3 py-2 text-xs font-bold"
                                >
                                  준비 취소
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void onAction(order.participantId, menu.menuItemId, "undo_serve")}
                                  disabled={
                                    submittingKey === `${key}:undo_serve` ||
                                    order.servedQuantity <= 0
                                  }
                                  className="brand-button-secondary rounded-xl px-3 py-2 text-xs font-bold"
                                >
                                  완료 취소
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <section className="brand-card-soft rounded-3xl p-5">
        <div className="mb-4">
          <h2 className="text-base font-extrabold text-[var(--brand-text)]">주문자 상세</h2>
        </div>
        <input
          value={participantQuery}
          onChange={(e) => onParticipantQueryChange(e.target.value)}
          placeholder="이름 검색"
          className="brand-input mb-4 w-full rounded-2xl px-4 py-3 text-sm outline-none"
        />
        <div className="space-y-3">
          {filteredParticipantRows.map((participant) => (
            <div key={participant.participantId} className="brand-list-item rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-[var(--brand-text)]">
                    {participant.participantName}{participant.companionId ? " (동반)" : ""}
                  </p>
                  <p className="brand-text-subtle mt-1 text-xs">{formatWon(participant.subtotal)}</p>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {participant.items.map((item) => (
                  <div key={item.menuItemId} className="brand-panel-white rounded-2xl px-3 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-[var(--brand-text)]">{item.menuName}</p>
                      <span className="brand-text-subtle text-xs">
                        주문 {item.quantity} · 준비 {item.preparingQuantity} · 완료 {item.servedQuantity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {filteredParticipantRows.length === 0 ? (
            <p className="brand-text-subtle py-6 text-center text-sm">조건에 맞는 주문자가 없습니다.</p>
          ) : null}
        </div>
      </section>
    </div>
  );
}

export function MeetingOrdersWorkspace({
  initialData,
  ordersEndpoint,
  variant = "admin",
}: {
  initialData: AdminMeetingFoodOrdersData;
  ordersEndpoint: string;
  variant?: "admin" | "shop";
}) {
  const [data, setData] = useState(initialData);
  const [expandedMenuIds, setExpandedMenuIds] = useState<Set<number>>(new Set());
  const [participantQuery, setParticipantQuery] = useState("");
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);
  const { toasts, addToast, removeToast } = useToast();

  async function handleAction(participantId: number, menuItemId: number, action: OrderAction) {
    const key = `${participantId}:${menuItemId}:${action}`;
    setSubmittingKey(key);
    try {
      const res = await fetch(ordersEndpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId, menuItemId, action }),
      });
      const next = await res.json();
      if (!res.ok) throw new Error(next.error || "주문 상태를 바꾸지 못했습니다.");
      setData(next as AdminMeetingFoodOrdersData);
    } catch (error) {
      addToast(error instanceof Error ? error.message : "주문 상태를 바꾸지 못했습니다.", "error");
    } finally {
      setSubmittingKey(null);
    }
  }

  return (
    <>
      {variant === "shop" ? (
        <div className="space-y-6">
          <ShopSummaryBar data={data} />
          <ShopMenuBoard data={data} submittingKey={submittingKey} onAction={handleAction} />
        </div>
      ) : (
        <AdminOrdersWorkspace
          data={data}
          expandedMenuIds={expandedMenuIds}
          participantQuery={participantQuery}
          submittingKey={submittingKey}
          onParticipantQueryChange={setParticipantQuery}
          onToggleMenu={(menuItemId) =>
            setExpandedMenuIds((prev) => {
              const next = new Set(prev);
              if (next.has(menuItemId)) next.delete(menuItemId);
              else next.add(menuItemId);
              return next;
            })
          }
          onAction={handleAction}
        />
      )}
      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => removeToast(toast.id)} />
      ))}
    </>
  );
}
