"use client";

import { useEffect, useMemo, useState } from "react";
import { formatWon } from "@/lib/format";
import type { ParticipantMeetingFoodOrdersData } from "@/lib/food-ordering-data";

type DraftMap = Record<number, Record<number, number>>;

function buildFreshDraftMap(data: ParticipantMeetingFoodOrdersData): DraftMap {
  return Object.fromEntries(
    data.participants.map((participant) => [
      participant.participantId,
      Object.fromEntries(data.menus.map((menu) => [menu.id, 0])),
    ])
  );
}

export function MeetingFoodOrderPanel({ meetingId }: { meetingId: number }) {
  const [data, setData] = useState<ParticipantMeetingFoodOrdersData | null>(null);
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [loading, setLoading] = useState(true);
  const [savingParticipantId, setSavingParticipantId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [isOpen, setIsOpen] = useState(false);

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

  // 모든 주문 이력을 메뉴별로 합산해서 요약 문자열 생성
  const savedSummary = useMemo(() => {
    if (!data || visibleParticipants.length === 0) return "";
    return visibleParticipants
      .map((p) => {
        const totals = new Map<number, number>();
        for (const order of (p.orders ?? [])) {
          for (const item of order.items) {
            totals.set(item.menuItemId, (totals.get(item.menuItemId) ?? 0) + item.quantity);
          }
        }
        return Array.from(totals.entries())
          .filter(([, qty]) => qty > 0)
          .map(([menuItemId, qty]) => {
            const menu = data.menus.find((m) => m.id === menuItemId);
            return menu ? `${menu.name} ${qty}` : null;
          })
          .filter(Boolean)
          .join(" · ");
      })
      .filter(Boolean)
      .join(" | ");
  }, [data, visibleParticipants]);

  // 누적 주문 금액 합계
  const savedTotal = useMemo(() => {
    if (!data) return 0;
    return visibleParticipants.reduce((total, p) => {
      for (const order of (p.orders ?? [])) {
        for (const item of order.items) {
          const menu = data.menus.find((m) => m.id === item.menuItemId);
          total += (menu?.price ?? 0) * item.quantity;
        }
      }
      return total;
    }, 0);
  }, [data, visibleParticipants]);

  // 현재 draft 금액 합계
  const allDraftTotal = useMemo(() => {
    if (!data) return 0;
    return visibleParticipants.reduce((total, p) => {
      return total + data.menus.reduce((pTotal, menu) => {
        return pTotal + (drafts[p.participantId]?.[menu.id] ?? 0) * menu.price;
      }, 0);
    }, 0);
  }, [data, drafts, visibleParticipants]);

  const totalSupport = visibleParticipants.length * (data?.supportCap ?? 0);

  function updateQuantity(participantId: number, menuItemId: number, nextValue: number) {
    setDrafts((prev) => ({
      ...prev,
      [participantId]: {
        ...(prev[participantId] ?? {}),
        [menuItemId]: Math.max(nextValue, 0),
      },
    }));
  }

  async function handleOrder(participantId: number) {
    if (!data) return;

    setSavingParticipantId(participantId);
    setError("");

    try {
      const items = data.menus.map((menu) => ({
        menuItemId: menu.id,
        quantity: drafts[participantId]?.[menu.id] ?? 0,
      }));

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
    if (!data?.meeting.orderOpen) return;
    setDrafts(buildFreshDraftMap(data));
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

  return (
    <>
      {/* 헤더 카드 — 항상 표시, orderOpen 일 때만 클릭 가능 */}
      <div
        className={`brand-card-soft rounded-2xl p-4 transition-opacity ${data.meeting.orderOpen ? "cursor-pointer active:opacity-75" : ""}`}
        onClick={handleOpen}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-base font-extrabold text-[var(--brand-text)]">점심 메뉴 주문</span>
          <span className={`whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold ${data.meeting.orderOpen ? "brand-chip-dark" : "brand-button-secondary"}`}>
            {data.meeting.orderOpen ? "주문 가능" : "당일 오픈"}
          </span>
        </div>
        {savedSummary ? (
          <div className="mt-2.5 space-y-1.5">
            <div className="brand-chip-soft inline-flex items-center rounded-lg px-2.5 py-1.5">
              <span className="text-xs font-semibold text-[var(--brand-primary-text)]">{savedSummary}</span>
            </div>
            <div className="flex items-center gap-2 px-0.5 text-xs">
              <span className="brand-text-muted">지원 {formatWon(totalSupport)}</span>
              <span className="brand-text-subtle">·</span>
              {savedTotal > totalSupport ? (
                <span className="font-semibold text-[var(--brand-danger)]">청구 {formatWon(savedTotal - totalSupport)}</span>
              ) : (
                <span className="font-semibold text-[var(--brand-success-text)]">청구 없음</span>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* Bottom sheet */}
      {isOpen ? (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setIsOpen(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-[var(--brand-surface-elevated)] pb-[calc(env(safe-area-inset-bottom)+1rem)]">
            <div className="p-4">
              <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--brand-divider)]" />
              <h3 className="mb-4 text-base font-extrabold text-[var(--brand-text)]">점심 메뉴 주문</h3>

              {error ? (
                <div className="brand-alert-error mb-4 rounded-xl p-3 text-sm">{error}</div>
              ) : null}

              {visibleParticipants.map((participant) => (
                <div key={participant.participantId} className="mb-6 last:mb-0">
                  {visibleParticipants.length > 1 ? (
                    <p className="mb-2 text-sm font-bold text-[var(--brand-text)]">
                      {participant.name}{participant.companionId ? " (동반)" : ""}
                    </p>
                  ) : null}

                  <div className="space-y-2">
                    {data.menus.map((menu) => {
                      const value = drafts[participant.participantId]?.[menu.id] ?? 0;
                      return (
                        <div key={menu.id} className="brand-list-item flex items-center justify-between rounded-2xl px-4 py-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-[var(--brand-text)]">{menu.name}</p>
                            <p className="brand-text-subtle mt-0.5 text-xs">{formatWon(menu.price)}</p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => updateQuantity(participant.participantId, menu.id, value - 1)}
                              className="brand-button-secondary h-9 w-9 rounded-full text-base font-bold"
                            >
                              -
                            </button>
                            <span className="w-8 text-center text-sm font-bold text-[var(--brand-text)]">{value}</span>
                            <button
                              type="button"
                              onClick={() => updateQuantity(participant.participantId, menu.id, value + 1)}
                              className="brand-button-primary h-9 w-9 rounded-full text-base font-bold"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleOrder(participant.participantId)}
                    disabled={savingParticipantId === participant.participantId}
                    className="brand-button-primary mt-3 w-full rounded-2xl py-3 text-sm font-bold disabled:cursor-not-allowed"
                  >
                    {savingParticipantId === participant.participantId ? "주문 중..." : "주문"}
                  </button>
                </div>
              ))}

              {/* 지원금 요약 */}
              {allDraftTotal > 0 ? (() => {
                const remainingSupport = Math.max(0, totalSupport - savedTotal);
                const due = Math.max(0, allDraftTotal - remainingSupport);
                return (
                  <div className="brand-inset-panel mt-2 rounded-xl p-3">
                    <div className="space-y-1.5 text-xs">
                      <div className="flex justify-between">
                        <span className="brand-text-subtle">이번 주문</span>
                        <span className="font-semibold text-[var(--brand-text)]">{formatWon(allDraftTotal)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="brand-text-subtle">
                          지원 잔액 ({visibleParticipants.length}명 × {formatWon(data.supportCap)}{savedTotal > 0 ? `, 이전 ${formatWon(savedTotal)} 사용` : ""})
                        </span>
                        <span className="font-semibold text-[var(--brand-success-text)]">
                          -{formatWon(Math.min(allDraftTotal, remainingSupport))}
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
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
