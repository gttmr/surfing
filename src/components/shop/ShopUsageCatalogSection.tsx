"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { Toast, useToast } from "@/components/ui/Toast";
import type { ShopMeetingSurfUsageData } from "@/lib/surf-usage-data";
import { isShopMeetingSurfUsageData, shopUsageErrorMessage } from "./shop-usage-response";

type CatalogDraft = {
  readonly id: number;
  readonly name: string;
  readonly description: string;
  readonly shopPrice: string;
  readonly isActive: boolean;
};

type NewCatalogItem = {
  readonly name: string;
  readonly description: string;
  readonly shopPrice: string;
};

const EMPTY_NEW_ITEM: NewCatalogItem = { name: "", description: "", shopPrice: "" };

function buildCatalogDrafts(data: ShopMeetingSurfUsageData): CatalogDraft[] {
  return data.usageItems.map((item) => ({
    id: item.id,
    name: item.name,
    description: item.description ?? "",
    shopPrice: String(item.shopPrice),
    isActive: item.isActive,
  }));
}

function digits(value: string): string {
  return value.replace(/[^\d]/g, "");
}

function amount(value: string): number {
  const normalized = digits(value);
  return normalized ? Number(normalized) : 0;
}

export function ShopUsageCatalogSection({
  catalogEndpoint,
  data,
  onDataChange,
}: {
  readonly catalogEndpoint: string;
  readonly data: ShopMeetingSurfUsageData;
  readonly onDataChange: (data: ShopMeetingSurfUsageData) => void;
}) {
  const [drafts, setDrafts] = useState<readonly CatalogDraft[]>(() => buildCatalogDrafts(data));
  const [newItem, setNewItem] = useState<NewCatalogItem>(EMPTY_NEW_ITEM);
  const [saving, setSaving] = useState(false);
  const { addToast, removeToast, toasts } = useToast();

  useEffect(() => {
    setDrafts(buildCatalogDrafts(data));
    setNewItem(EMPTY_NEW_ITEM);
  }, [data]);

  function updateDraft(id: number, patch: Partial<CatalogDraft>) {
    setDrafts((current) => current.map((draft) => draft.id === id ? { ...draft, ...patch } : draft));
  }

  async function saveCatalog() {
    setSaving(true);
    try {
      const items: Array<{
        id?: number;
        name: string;
        description: string;
        shopPrice: number;
        isActive: boolean;
      }> = drafts.map((draft) => ({
        id: draft.id,
        name: draft.name,
        description: draft.description,
        shopPrice: amount(draft.shopPrice),
        isActive: draft.isActive,
      }));
      if (newItem.name.trim()) {
        items.push({
          name: newItem.name,
          description: newItem.description,
          shopPrice: amount(newItem.shopPrice),
          isActive: true,
        });
      }
      const response = await fetch(catalogEndpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items }),
      });
      const payload: unknown = await response.json();
      if (!response.ok || !isShopMeetingSurfUsageData(payload)) {
        addToast(shopUsageErrorMessage(payload, "이용 항목을 저장하지 못했습니다."), "error");
        return;
      }
      onDataChange(payload);
      addToast("이용 항목을 저장했습니다.", "success");
    } catch (error) {
      addToast(error instanceof Error ? error.message : "이용 항목을 저장하지 못했습니다.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <details className="brand-panel-white overflow-hidden rounded-[1.6rem]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5">
        <span className="min-w-0">
          <span className="block text-sm font-extrabold text-brand-text">이용 항목 설정</span>
          <span className="brand-text-subtle mt-0.5 block text-xs">가격, 항목 추가, 사용 여부 관리</span>
        </span>
        <span className="flex shrink-0 items-center gap-1 text-xs font-bold text-brand-primary-text">
          {drafts.length}개
          <Icon className="text-[20px]" name="settings" />
        </span>
      </summary>

      <div className="space-y-3 border-t border-brand-divider p-4">
        {drafts.map((draft) => (
          <fieldset className="space-y-2 rounded-2xl border border-brand-divider p-3" key={draft.id}>
            <legend className="px-1 text-xs font-bold text-brand-text">{draft.name || "이름 없는 항목"}</legend>
            <label className="block">
              <span className="brand-text-subtle mb-1 block text-[11px] font-semibold">항목 이름</span>
              <input className="brand-input w-full rounded-xl px-3 py-2 text-sm outline-none" onChange={(event) => updateDraft(draft.id, { name: event.target.value })} value={draft.name} />
            </label>
            <label className="block">
              <span className="brand-text-subtle mb-1 block text-[11px] font-semibold">설명</span>
              <input className="brand-input w-full rounded-xl px-3 py-2 text-sm outline-none" onChange={(event) => updateDraft(draft.id, { description: event.target.value })} value={draft.description} />
            </label>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
              <label className="block">
                <span className="brand-text-subtle mb-1 block text-[11px] font-semibold">샵 가격</span>
                <input className="brand-input w-full rounded-xl px-3 py-2 text-sm outline-none" inputMode="numeric" onChange={(event) => updateDraft(draft.id, { shopPrice: digits(event.target.value) })} value={draft.shopPrice} />
              </label>
              <label className="brand-touch-target flex cursor-pointer items-center gap-2 rounded-xl px-2 text-xs font-bold text-brand-text">
                <input checked={draft.isActive} className="h-4 w-4 accent-brand-primary" onChange={(event) => updateDraft(draft.id, { isActive: event.target.checked })} type="checkbox" />
                사용
              </label>
            </div>
          </fieldset>
        ))}

        <fieldset className="space-y-2 rounded-2xl border border-brand-primary-border p-3">
          <legend className="px-1 text-xs font-bold text-brand-primary-text">새 항목 추가</legend>
          <label className="block">
            <span className="brand-text-subtle mb-1 block text-[11px] font-semibold">항목 이름</span>
            <input className="brand-input w-full rounded-xl px-3 py-2 text-sm outline-none" onChange={(event) => setNewItem((current) => ({ ...current, name: event.target.value }))} placeholder="기타 항목" value={newItem.name} />
          </label>
          <label className="block">
            <span className="brand-text-subtle mb-1 block text-[11px] font-semibold">설명</span>
            <input className="brand-input w-full rounded-xl px-3 py-2 text-sm outline-none" onChange={(event) => setNewItem((current) => ({ ...current, description: event.target.value }))} value={newItem.description} />
          </label>
          <label className="block">
            <span className="brand-text-subtle mb-1 block text-[11px] font-semibold">샵 가격</span>
            <input className="brand-input w-full rounded-xl px-3 py-2 text-sm outline-none" inputMode="numeric" onChange={(event) => setNewItem((current) => ({ ...current, shopPrice: digits(event.target.value) }))} value={newItem.shopPrice} />
          </label>
        </fieldset>

        <button className="brand-button-primary w-full rounded-2xl px-4 py-3 text-sm font-bold" disabled={saving} onClick={() => void saveCatalog()} type="button">
          {saving ? "설정 저장 중…" : "이용 항목 설정 저장"}
        </button>
      </div>

      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} onClose={() => removeToast(toast.id)} type={toast.type} />
      ))}
    </details>
  );
}
