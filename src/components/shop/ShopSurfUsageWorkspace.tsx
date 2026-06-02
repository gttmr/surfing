"use client";

import { useEffect, useMemo, useState } from "react";
import { Toast, useToast } from "@/components/ui/Toast";
import { formatRelativeTimeKo, formatWon } from "@/lib/format";
import type { ShopMeetingSurfUsageData } from "@/lib/surf-usage-data";

type DraftMap = Record<number, Record<number, number>>;
type CatalogDraft = {
  id: number;
  name: string;
  description: string;
  shopPrice: string;
  isActive: boolean;
};

function buildUsageDrafts(data: ShopMeetingSurfUsageData): DraftMap {
  return Object.fromEntries(
    data.participantRows.map((participant) => [
      participant.participantId,
      Object.fromEntries(
        data.usageItems.map((item) => [
          item.id,
          participant.entries
            .filter((entry) => entry.usageItemId === item.id)
            .reduce((sum, entry) => sum + entry.quantity, 0),
        ])
      ),
    ])
  );
}

function buildCatalogDrafts(data: ShopMeetingSurfUsageData): CatalogDraft[] {
  return data.usageItems.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description ?? "",
    shopPrice: String(item.shopPrice),
    isActive: item.isActive,
  }));
}

function parseAmount(value: string) {
  const normalized = value.replace(/[^\d]/g, "");
  return normalized ? Number(normalized) : 0;
}

function getStatusClass(status: ShopMeetingSurfUsageData["participantRows"][number]["submissionStatus"]) {
  if (status === "confirmed") return "brand-chip-success";
  if (status === "submitted") return "brand-chip-soft";
  return "brand-chip-danger";
}

function getStatusLabel(status: ShopMeetingSurfUsageData["participantRows"][number]["submissionStatus"]) {
  if (status === "confirmed") return "확정";
  if (status === "submitted") return "검수";
  return "미제출";
}

export function ShopSurfUsageWorkspace({
  initialData,
  usageEndpoint,
  catalogEndpoint,
  onDataChange,
}: {
  initialData: ShopMeetingSurfUsageData;
  usageEndpoint: string;
  catalogEndpoint: string;
  onDataChange?: (nextData: ShopMeetingSurfUsageData) => void;
}) {
  const [data, setData] = useState(initialData);
  const [drafts, setDrafts] = useState<DraftMap>(() => buildUsageDrafts(initialData));
  const [catalogDrafts, setCatalogDrafts] = useState<CatalogDraft[]>(() => buildCatalogDrafts(initialData));
  const [newItem, setNewItem] = useState({ name: "", description: "", shopPrice: "" });
  const [submittingKey, setSubmittingKey] = useState<string | null>(null);
  const { toasts, addToast, removeToast } = useToast();

  useEffect(() => {
    setData(initialData);
    setDrafts(buildUsageDrafts(initialData));
    setCatalogDrafts(buildCatalogDrafts(initialData));
    setNewItem({ name: "", description: "", shopPrice: "" });
    setSubmittingKey(null);
  }, [initialData]);

  const activeItems = useMemo(
    () => data.usageItems.filter((item) => item.isActive),
    [data.usageItems]
  );

  function replaceData(next: ShopMeetingSurfUsageData) {
    setData(next);
    setDrafts(buildUsageDrafts(next));
    setCatalogDrafts(buildCatalogDrafts(next));
    onDataChange?.(next);
  }

  function updateQuantity(participantId: number, usageItemId: number, nextValue: number) {
    setDrafts((prev) => ({
      ...prev,
      [participantId]: {
        ...(prev[participantId] ?? {}),
        [usageItemId]: Math.max(0, Math.min(20, nextValue)),
      },
    }));
  }

  async function saveParticipant(participantId: number) {
    const key = `${participantId}:save`;
    setSubmittingKey(key);
    try {
      const res = await fetch(usageEndpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId,
          action: "save",
          items: activeItems.map((item) => ({
            usageItemId: item.id,
            quantity: drafts[participantId]?.[item.id] ?? 0,
          })),
        }),
      });
      const next = await res.json();
      if (!res.ok) throw new Error(next.error || "이용 내역을 저장하지 못했습니다.");
      replaceData(next as ShopMeetingSurfUsageData);
      addToast("이용 내역을 저장했습니다.", "success");
    } catch (error) {
      addToast(error instanceof Error ? error.message : "이용 내역을 저장하지 못했습니다.", "error");
    } finally {
      setSubmittingKey(null);
    }
  }

  async function confirmParticipant(participantId: number) {
    const key = `${participantId}:confirm`;
    setSubmittingKey(key);
    try {
      const res = await fetch(usageEndpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId, action: "confirm" }),
      });
      const next = await res.json();
      if (!res.ok) throw new Error(next.error || "이용 내역을 확정하지 못했습니다.");
      replaceData(next as ShopMeetingSurfUsageData);
      addToast("이용 내역을 확정했습니다.", "success");
    } catch (error) {
      addToast(error instanceof Error ? error.message : "이용 내역을 확정하지 못했습니다.", "error");
    } finally {
      setSubmittingKey(null);
    }
  }

  async function saveCatalog() {
    setSubmittingKey("catalog");
    try {
      const items: Array<{
        id?: number;
        name: string;
        description: string;
        shopPrice: number;
        isActive: boolean;
      }> = catalogDrafts.map((item) => ({
        id: item.id,
        name: item.name,
        description: item.description,
        shopPrice: parseAmount(item.shopPrice),
        isActive: item.isActive,
      }));
      if (newItem.name.trim()) {
        items.push({
          name: newItem.name,
          description: newItem.description,
          shopPrice: parseAmount(newItem.shopPrice),
          isActive: true,
        });
      }

      const res = await fetch(catalogEndpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const next = await res.json();
      if (!res.ok) throw new Error(next.error || "이용 항목을 저장하지 못했습니다.");
      replaceData(next as ShopMeetingSurfUsageData);
      setNewItem({ name: "", description: "", shopPrice: "" });
      addToast("이용 항목을 저장했습니다.", "success");
    } catch (error) {
      addToast(error instanceof Error ? error.message : "이용 항목을 저장하지 못했습니다.", "error");
    } finally {
      setSubmittingKey(null);
    }
  }

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <div className="brand-chip-soft rounded-2xl px-4 py-3">
          <p className="text-[11px] font-bold opacity-70">샵 청구 총액</p>
          <p className="mt-0.5 text-[1.25rem] font-extrabold tracking-[-0.03em]">{formatWon(data.summary.confirmedShopAmount)}</p>
        </div>
        <div className="brand-chip-soft rounded-2xl px-4 py-3">
          <p className="text-[11px] font-bold opacity-70">검수 필요</p>
          <p className="mt-0.5 text-[1.25rem] font-extrabold tracking-[-0.03em]">{data.summary.reviewCount}</p>
        </div>
        <div className="brand-chip-danger rounded-2xl px-4 py-3">
          <p className="text-[11px] font-bold opacity-70">미제출</p>
          <p className="mt-0.5 text-[1.25rem] font-extrabold tracking-[-0.03em]">{data.summary.missingCount}</p>
        </div>
        <div className="brand-chip-success rounded-2xl px-4 py-3">
          <p className="text-[11px] font-bold opacity-70">확정</p>
          <p className="mt-0.5 text-[1.25rem] font-extrabold tracking-[-0.03em]">{data.summary.confirmedCount}</p>
        </div>
      </div>

      <section className="brand-panel-white rounded-[1.7rem] p-4">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-[var(--brand-text)]">이용 항목 가격</h2>
            <p className="brand-text-subtle mt-1 text-xs">샵 청구 기준입니다. 회원 할인 정보는 표시하지 않습니다.</p>
          </div>
          <button
            type="button"
            onClick={() => void saveCatalog()}
            disabled={submittingKey === "catalog"}
            className="brand-button-primary shrink-0 rounded-2xl px-4 py-2.5 text-xs font-bold"
          >
            {submittingKey === "catalog" ? "저장 중" : "가격 저장"}
          </button>
        </div>

        <div className="space-y-2">
          {catalogDrafts.map((item, index) => (
            <div key={item.id} className="grid gap-2 rounded-2xl border border-[var(--brand-divider)] p-3 md:grid-cols-[1fr,1fr,120px,72px] md:items-center">
              <input
                value={item.name}
                onChange={(event) =>
                  setCatalogDrafts((prev) => prev.map((draft, draftIndex) => draftIndex === index ? { ...draft, name: event.target.value } : draft))
                }
                className="brand-input rounded-xl px-3 py-2 text-sm outline-none"
              />
              <input
                value={item.description}
                onChange={(event) =>
                  setCatalogDrafts((prev) => prev.map((draft, draftIndex) => draftIndex === index ? { ...draft, description: event.target.value } : draft))
                }
                className="brand-input rounded-xl px-3 py-2 text-sm outline-none"
                placeholder="설명"
              />
              <input
                value={item.shopPrice}
                onChange={(event) =>
                  setCatalogDrafts((prev) => prev.map((draft, draftIndex) => draftIndex === index ? { ...draft, shopPrice: event.target.value.replace(/[^\d]/g, "") } : draft))
                }
                className="brand-input rounded-xl px-3 py-2 text-sm outline-none"
                inputMode="numeric"
                placeholder="가격"
              />
              <label className="flex items-center gap-2 text-xs font-bold text-[var(--brand-text)]">
                <input
                  type="checkbox"
                  checked={item.isActive}
                  onChange={(event) =>
                    setCatalogDrafts((prev) => prev.map((draft, draftIndex) => draftIndex === index ? { ...draft, isActive: event.target.checked } : draft))
                  }
                  className="h-4 w-4 accent-[var(--brand-primary)]"
                />
                사용
              </label>
            </div>
          ))}

          <div className="grid gap-2 rounded-2xl border border-[var(--brand-primary-border)] p-3 md:grid-cols-[1fr,1fr,120px]">
            <input
              value={newItem.name}
              onChange={(event) => setNewItem((prev) => ({ ...prev, name: event.target.value }))}
              className="brand-input rounded-xl px-3 py-2 text-sm outline-none"
              placeholder="기타 항목"
            />
            <input
              value={newItem.description}
              onChange={(event) => setNewItem((prev) => ({ ...prev, description: event.target.value }))}
              className="brand-input rounded-xl px-3 py-2 text-sm outline-none"
              placeholder="설명"
            />
            <input
              value={newItem.shopPrice}
              onChange={(event) => setNewItem((prev) => ({ ...prev, shopPrice: event.target.value.replace(/[^\d]/g, "") }))}
              className="brand-input rounded-xl px-3 py-2 text-sm outline-none"
              inputMode="numeric"
              placeholder="가격"
            />
          </div>
        </div>
      </section>

      <section className="brand-panel-white overflow-hidden rounded-[1.7rem]">
        <div className="grid grid-cols-[minmax(0,1fr)_4rem_6rem] gap-2 px-4 py-3 text-[11px] font-extrabold text-[var(--brand-text-subtle)]">
          <span>항목</span>
          <span className="text-right">수량</span>
          <span className="text-right">확정금액</span>
        </div>
        {data.itemRows.filter((row) => row.quantity > 0 || row.confirmedQuantity > 0).map((row) => (
          <div key={row.usageItemId} className="grid grid-cols-[minmax(0,1fr)_4rem_6rem] gap-2 border-t border-[var(--brand-divider)] px-4 py-3 text-sm">
            <span className="truncate font-bold text-[var(--brand-text)]">{row.name}</span>
            <span className="text-right font-bold text-[var(--brand-text)]">{row.confirmedQuantity}/{row.quantity}</span>
            <span className="text-right font-bold text-[var(--brand-text)]">{formatWon(row.confirmedAmount)}</span>
          </div>
        ))}
      </section>

      <section className="space-y-3">
        {data.participantRows.map((participant) => {
          const submittedAt = participant.submittedAt ? formatRelativeTimeKo(participant.submittedAt) : null;
          return (
            <div key={participant.participantId} className="brand-panel-white rounded-[1.7rem] p-4">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-extrabold text-[var(--brand-text)]">{participant.participantName}</p>
                    <span className={`${getStatusClass(participant.submissionStatus)} rounded-full px-2 py-1 text-[10px] font-bold`}>
                      {getStatusLabel(participant.submissionStatus)}
                    </span>
                  </div>
                  <p className="brand-text-subtle mt-1 text-xs">
                    {participant.requestedOptionLabel}{submittedAt ? ` · ${submittedAt}` : ""}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-extrabold text-[var(--brand-text)]">{formatWon(participant.shopAmount)}</span>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                {activeItems.map((item) => {
                  const value = drafts[participant.participantId]?.[item.id] ?? 0;
                  return (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--brand-divider)] px-3 py-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-[var(--brand-text)]">{item.name}</p>
                        <p className="brand-text-subtle mt-0.5 text-[11px]">{formatWon(item.shopPrice)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => updateQuantity(participant.participantId, item.id, value - 1)}
                          className="brand-button-secondary flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
                        >
                          -
                        </button>
                        <span className="w-5 text-center text-sm font-extrabold text-[var(--brand-text)]">{value}</span>
                        <button
                          type="button"
                          onClick={() => updateQuantity(participant.participantId, item.id, value + 1)}
                          className="brand-button-secondary flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => void saveParticipant(participant.participantId)}
                  disabled={submittingKey === `${participant.participantId}:save`}
                  className="brand-button-secondary rounded-2xl px-4 py-3 text-sm font-bold"
                >
                  {submittingKey === `${participant.participantId}:save` ? "저장 중..." : "저장"}
                </button>
                <button
                  type="button"
                  onClick={() => void confirmParticipant(participant.participantId)}
                  disabled={submittingKey === `${participant.participantId}:confirm`}
                  className="brand-button-primary rounded-2xl px-4 py-3 text-sm font-bold"
                >
                  {submittingKey === `${participant.participantId}:confirm` ? "확정 중..." : "확정"}
                </button>
              </div>
            </div>
          );
        })}
      </section>

      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} onClose={() => removeToast(toast.id)} type={toast.type} />
      ))}
    </section>
  );
}
