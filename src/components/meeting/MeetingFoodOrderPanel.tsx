"use client";

import { useEffect, useMemo, useState } from "react";
import { Sheet } from "@/components/ui/Dialog";
import { formatWon } from "@/lib/format";
import type { ParticipantMeetingFoodOrdersData } from "@/lib/food-ordering-data";

type DraftMap = Record<number, Record<string, number>>;

type MenuGroup = {
  categoryName: string;
  menus: ParticipantMeetingFoodOrdersData["menus"];
};

type MenuDraftRow = {
  key: string;
  menuId: number;
  optionChoiceId: number | null;
  label: string;
  price: number;
};

function buildMenuDraftRows(menu: ParticipantMeetingFoodOrdersData["menus"][number]): MenuDraftRow[] {
  if (menu.options.length === 0) {
    return [{ key: `${menu.id}:none`, menuId: menu.id, optionChoiceId: null, label: menu.name, price: menu.price }];
  }

  return menu.options.map((option) => ({
    key: `${menu.id}:${option.id}`,
    menuId: menu.id,
    optionChoiceId: option.id,
    label: option.label,
    price: option.price,
  }));
}

function buildFreshDraftMap(data: ParticipantMeetingFoodOrdersData): DraftMap {
  return Object.fromEntries(
    data.participants.map((participant) => [
      participant.participantId,
      Object.fromEntries(data.menus.flatMap((menu) => buildMenuDraftRows(menu).map((row) => [row.key, 0]))),
    ])
  );
}

function groupMenusByCategory(menus: ParticipantMeetingFoodOrdersData["menus"]): MenuGroup[] {
  const groups = new Map<string, MenuGroup>();

  for (const menu of menus) {
    const existing = groups.get(menu.categoryName);
    if (existing) {
      existing.menus.push(menu);
      continue;
    }

    groups.set(menu.categoryName, {
      categoryName: menu.categoryName,
      menus: [menu],
    });
  }

  return Array.from(groups.values());
}

type ParticipantOrderItem =
  ParticipantMeetingFoodOrdersData["participants"][number]["orders"][number]["items"][number];
type ParticipantOrderPerson = ParticipantMeetingFoodOrdersData["participants"][number];

function getOrderItemName(item: ParticipantOrderItem) {
  return item.optionChoiceLabel ? `${item.menuName} · ${item.optionChoiceLabel}` : item.menuName;
}

function getParticipantOrderRows(participant: ParticipantOrderPerson) {
  const totals = new Map<
    string,
    { name: string; quantity: number; total: number; cancelled: boolean; reason: string | null }
  >();

  for (const order of participant.orders ?? []) {
    for (const item of order.items) {
      const key = `${item.cancelledAt ? "cancelled" : "active"}:${item.menuItemId ?? item.menuName}:${item.menuOptionChoiceId ?? item.optionChoiceLabel ?? "none"}`;
      const existing = totals.get(key);
      const itemTotal = item.unitPrice * item.quantity;
      if (existing) {
        existing.quantity += item.quantity;
        existing.total += itemTotal;
      } else {
        totals.set(key, {
          name: getOrderItemName(item),
          quantity: item.quantity,
          total: itemTotal,
          cancelled: Boolean(item.cancelledAt),
          reason: item.cancelledReasonText,
        });
      }
    }
  }

  return Array.from(totals.values());
}

function getParticipantActiveTotal(participant: ParticipantOrderPerson) {
  return getParticipantOrderRows(participant)
    .filter((row) => !row.cancelled)
    .reduce((sum, row) => sum + row.total, 0);
}

export function MeetingFoodOrderPanel({ meetingId }: { meetingId: number }) {
  const [data, setData] = useState<ParticipantMeetingFoodOrdersData | null>(null);
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [loading, setLoading] = useState(true);
  const [savingParticipantId, setSavingParticipantId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [selectedParticipantId, setSelectedParticipantId] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadOrders() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/meetings/${meetingId}/orders`);
        const next = await res.json();
        if (!res.ok) throw new Error(next.error || "주문 정보를 불러오지 못했습니다.");
        if (!cancelled) {
          setData(next as ParticipantMeetingFoodOrdersData);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : "주문 정보를 불러오지 못했습니다.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadOrders();
    return () => { cancelled = true; };
  }, [meetingId]);

  const visibleParticipants = useMemo(() => data?.participants ?? [], [data]);
  const orderableParticipants = useMemo(
    () => visibleParticipants.filter((participant) => participant.canOrder),
    [visibleParticipants]
  );
  const menuGroups = useMemo(() => groupMenusByCategory(data?.menus ?? []), [data]);

  const savedTotalForOrderableParticipants = useMemo(() => {
    if (!data) return 0;
    return orderableParticipants.reduce((total, p) => {
      for (const order of (p.orders ?? [])) {
        for (const item of order.items) {
          if (!item.cancelledAt) total += item.unitPrice * item.quantity;
        }
      }
      return total;
    }, 0);
  }, [data, orderableParticipants]);

  const totalSupport = orderableParticipants.length * (data?.supportCap ?? 0);
  const selectedParticipant =
    visibleParticipants.find((participant) => participant.participantId === selectedParticipantId) ??
    orderableParticipants[0] ??
    visibleParticipants[0] ??
    null;

  // 현재 draft 금액 합계
  const selectedDraftTotal = useMemo(() => {
    if (!data || !selectedParticipant) return 0;
    return data.menus.reduce((pTotal, menu) => {
      return pTotal + buildMenuDraftRows(menu).reduce((menuTotal, row) => {
        return menuTotal + (drafts[selectedParticipant.participantId]?.[row.key] ?? 0) * row.price;
      }, 0);
    }, 0);
  }, [data, drafts, selectedParticipant]);

  function updateQuantity(participantId: number, rowKey: string, nextValue: number) {
    setDrafts((prev) => ({
      ...prev,
      [participantId]: {
        ...(prev[participantId] ?? {}),
        [rowKey]: Math.max(nextValue, 0),
      },
    }));
  }

  async function handleOrder(participantId: number) {
    if (!data) return;
    const participant = visibleParticipants.find((item) => item.participantId === participantId);
    if (!participant?.canOrder) {
      setError(participant?.lockedReason ?? "주문할 수 없는 대상입니다.");
      return;
    }

    setSavingParticipantId(participantId);
    setError("");

    try {
      const items = data.menus.flatMap((menu) =>
        buildMenuDraftRows(menu).map((row) => ({
          menuItemId: row.menuId,
          optionChoiceId: row.optionChoiceId,
          quantity: drafts[participantId]?.[row.key] ?? 0,
        }))
      );

      const res = await fetch(`/api/meetings/${meetingId}/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId, items }),
      });
      const next = await res.json();
      if (!res.ok) throw new Error(next.error || "주문하지 못했습니다.");
      setData(next as ParticipantMeetingFoodOrdersData);
      setIsOpen(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "주문하지 못했습니다.");
    } finally {
      setSavingParticipantId(null);
    }
  }

  function handleOpen() {
    if (!data?.meeting.orderOpen || orderableParticipants.length === 0) return;
    setDrafts(buildFreshDraftMap(data));
    setSelectedParticipantId(orderableParticipants[0]?.participantId ?? null);
    setError("");
    setIsOpen(true);
  }

  if (loading) {
    return <div className="brand-text-subtle py-4 text-center text-sm">주문 정보를 불러오는 중...</div>;
  }

  if (error && !data) {
    return <div className="brand-alert-error rounded-xl p-4 text-sm">{error}</div>;
  }

  if (!data || visibleParticipants.length === 0) {
    return null;
  }

  const orderStateLabel = data.meeting.orderOpen
    ? orderableParticipants.length > 0
      ? "주문 가능"
      : "직접 주문"
    : "당일 오픈";

  return (
    <>
      {/* 헤더 카드 — 항상 표시, orderOpen 일 때만 클릭 가능 */}
      <button
        className={`brand-card-soft w-full rounded-2xl p-4 text-left transition-opacity ${data.meeting.orderOpen ? "active:opacity-75" : ""}`}
        disabled={!data.meeting.orderOpen || orderableParticipants.length === 0}
        onClick={handleOpen}
        type="button"
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-base font-extrabold text-[var(--brand-text)]">점심 메뉴 주문</span>
          <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${data.meeting.orderOpen && orderableParticipants.length > 0 ? "brand-chip-dark" : "brand-button-secondary"}`}>
            {orderStateLabel}
          </span>
        </div>
        <div className="mt-3 space-y-2">
          {visibleParticipants.map((participant) => {
            const rows = getParticipantOrderRows(participant);
            const activeRows = rows.filter((row) => !row.cancelled);
            const cancelledRows = rows.filter((row) => row.cancelled);
            const activeSummary = activeRows.length > 0
              ? activeRows.map((row) => `${row.name} ${row.quantity}`).join(" · ")
              : "주문 없음";
            const roleClass = participant.orderRole === "owner_proxy"
              ? "brand-chip-companion"
              : participant.orderRole === "linked_companion_locked"
                ? "brand-button-secondary"
                : "brand-chip-soft";

            return (
              <div key={participant.participantId} className="brand-panel-white rounded-2xl px-3 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-[var(--brand-text)]">{participant.name}</p>
                    <p className="brand-text-subtle mt-1 truncate text-xs">{activeSummary}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2 py-1 text-[10px] font-bold ${roleClass}`}>
                    {participant.roleLabel}
                  </span>
                </div>
                {cancelledRows.length > 0 ? (
                  <div className="brand-alert-error mt-2 rounded-xl px-3 py-2 text-xs">
                    {cancelledRows.map((row) => `${row.name} 취소됨${row.reason ? ` · ${row.reason}` : ""}`).join(" / ")}
                  </div>
                ) : null}
              </div>
            );
          })}

          {orderableParticipants.length > 0 ? (
            <div className="flex items-center gap-2 px-0.5 text-xs">
              <span className="brand-text-muted">지원 {formatWon(totalSupport)}</span>
              <span className="brand-text-subtle">·</span>
              {savedTotalForOrderableParticipants > totalSupport ? (
                <span className="font-semibold text-[var(--brand-danger)]">청구 {formatWon(savedTotalForOrderableParticipants - totalSupport)}</span>
              ) : (
                <span className="font-semibold text-[var(--brand-success-text)]">청구 없음</span>
              )}
            </div>
          ) : null}
        </div>
      </button>

      <Sheet
        closeLabel="점심 메뉴 주문 닫기"
        description="주문할 회원과 메뉴 수량을 선택하세요."
        onClose={() => setIsOpen(false)}
        open={isOpen}
        title="점심 메뉴 주문"
      >
              {error ? (
                <div className="brand-alert-error mb-4 rounded-xl p-3 text-sm">{error}</div>
              ) : null}

              {visibleParticipants.length > 1 ? (
                <div className="mb-4 grid grid-cols-2 gap-2">
                  {visibleParticipants.map((participant) => {
                    const selected = selectedParticipant?.participantId === participant.participantId;
                    return (
                      <button
                        key={participant.participantId}
                        type="button"
                        onClick={() => {
                          setSelectedParticipantId(participant.participantId);
                          setError("");
                        }}
                        className={`rounded-2xl px-3 py-2.5 text-left text-xs font-bold transition-colors ${
                          selected ? "brand-toggle-active" : "brand-panel-white"
                        } ${participant.canOrder ? "" : "opacity-80"}`}
                      >
                        <span className="block truncate text-sm font-extrabold">{participant.name}</span>
                        <span className="brand-text-subtle mt-0.5 block truncate text-[10px]">{participant.roleLabel}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {selectedParticipant ? (
                selectedParticipant.canOrder ? (
                  <div>
                    <div className="brand-chip-soft mb-3 inline-flex rounded-xl px-3 py-2 text-xs font-bold">
                      지금은 {selectedParticipant.name} 이름으로 주문합니다.
                    </div>

                    <div className="space-y-3">
                      {menuGroups.map((group) => (
                        <section key={`${selectedParticipant.participantId}-${group.categoryName}`} className="brand-panel-white rounded-2xl p-3">
                          <div className="mb-2 flex items-center gap-2 px-1">
                            <span className="h-4 w-1 rounded-full bg-[var(--brand-primary)]" />
                            <p className="text-xs font-extrabold tracking-[0.08em] text-[var(--brand-text)]">
                              {group.categoryName}
                            </p>
                          </div>

                          <div className="space-y-2">
                            {group.menus.map((menu) => {
                              const rows = buildMenuDraftRows(menu);
                              if (menu.options.length === 0) {
                                const row = rows[0];
                                const value = drafts[selectedParticipant.participantId]?.[row.key] ?? 0;
                                return (
                                  <div
                                    key={menu.id}
                                    className="brand-list-item flex items-center justify-between rounded-2xl px-4 py-3"
                                  >
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-semibold text-[var(--brand-text)]">{menu.name}</p>
                                      <p className="brand-text-subtle mt-0.5 text-xs">{formatWon(menu.price)}</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <button
                                        type="button"
                                        onClick={() => updateQuantity(selectedParticipant.participantId, row.key, value - 1)}
                                        className="brand-button-secondary h-9 w-9 rounded-full text-base font-bold"
                                      >
                                        -
                                      </button>
                                      <span className="w-8 text-center text-sm font-bold text-[var(--brand-text)]">{value}</span>
                                      <button
                                        type="button"
                                        onClick={() => updateQuantity(selectedParticipant.participantId, row.key, value + 1)}
                                        className="brand-button-primary h-9 w-9 rounded-full text-base font-bold"
                                      >
                                        +
                                      </button>
                                    </div>
                                  </div>
                                );
                              }

                              return (
                                <div
                                  key={menu.id}
                                  className="brand-list-item rounded-2xl px-4 py-3"
                                >
                                  <div className="mb-2 min-w-0">
                                    <p className="truncate text-sm font-semibold text-[var(--brand-text)]">{menu.name}</p>
                                    <p className="brand-text-subtle mt-0.5 text-xs">
                                      {menu.optionGroupName ?? formatWon(menu.price)}
                                    </p>
                                  </div>
                                  <div className="space-y-2">
                                    {rows.map((row) => {
                                      const value = drafts[selectedParticipant.participantId]?.[row.key] ?? 0;
                                      return (
                                        <div key={row.key} className="flex items-center justify-between gap-3">
                                          <div className="min-w-0">
                                            <p className="truncate text-sm font-semibold text-[var(--brand-text)]">{row.label}</p>
                                            <p className="brand-text-subtle mt-0.5 text-xs">{formatWon(row.price)}</p>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <button
                                              type="button"
                                              onClick={() => updateQuantity(selectedParticipant.participantId, row.key, value - 1)}
                                              className="brand-button-secondary h-9 w-9 rounded-full text-base font-bold"
                                            >
                                              -
                                            </button>
                                            <span className="w-8 text-center text-sm font-bold text-[var(--brand-text)]">{value}</span>
                                            <button
                                              type="button"
                                              onClick={() => updateQuantity(selectedParticipant.participantId, row.key, value + 1)}
                                              className="brand-button-primary h-9 w-9 rounded-full text-base font-bold"
                                            >
                                              +
                                            </button>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </section>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleOrder(selectedParticipant.participantId)}
                      disabled={savingParticipantId === selectedParticipant.participantId}
                      className="brand-button-primary mt-3 w-full rounded-2xl py-3 text-sm font-bold disabled:cursor-not-allowed"
                    >
                      {savingParticipantId === selectedParticipant.participantId ? "주문 중..." : `${selectedParticipant.name} 이름으로 주문`}
                    </button>
                  </div>
                ) : (
                  <div className="brand-panel-white rounded-2xl px-4 py-8 text-center">
                    <p className="text-sm font-extrabold text-[var(--brand-text)]">{selectedParticipant.name}가 직접 주문해야 합니다.</p>
                    <p className="brand-text-subtle mt-1 text-xs">{selectedParticipant.lockedReason}</p>
                  </div>
                )
              ) : null}

              {/* 지원금 요약 */}
              {selectedDraftTotal > 0 && selectedParticipant?.canOrder ? (() => {
                const selectedSavedTotal = getParticipantActiveTotal(selectedParticipant);
                const remainingSupport = Math.max(0, data.supportCap - selectedSavedTotal);
                const due = Math.max(0, selectedDraftTotal - remainingSupport);
                return (
                  <div className="brand-inset-panel mt-2 rounded-xl p-3">
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="brand-text-subtle">이번 주문</span>
                        <span className="font-semibold text-[var(--brand-text)]">{formatWon(selectedDraftTotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="brand-text-subtle">
                          지원 잔액 ({formatWon(data.supportCap)}{selectedSavedTotal > 0 ? `, 이전 ${formatWon(selectedSavedTotal)} 사용` : ""})
                        </span>
                        <span className="font-semibold text-[var(--brand-success-text)]">
                          -{formatWon(Math.min(selectedDraftTotal, remainingSupport))}
                        </span>
                      </div>
                      <div className="flex justify-between border-t border-[var(--brand-divider)] pt-1.5">
                        <span className="font-bold text-[var(--brand-text)]">청구금액</span>
                        <span className={`font-extrabold ${due > 0 ? "text-[var(--brand-danger)]" : "text-[var(--brand-success-text)]"}`}>
                          {due > 0 ? formatWon(due) : "없음"}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })() : null}
      </Sheet>
    </>
  );
}
