"use client";

import { useState } from "react";
import { Toast, useToast } from "@/components/ui/Toast";
import type { AdminFoodMenuSettingsData } from "@/lib/food-ordering-data";

type MenuDraft = {
  id: number | null;
  key: string;
  name: string;
  price: string;
  isActive: boolean;
};

function toDraft(menu: AdminFoodMenuSettingsData["menus"][number]): MenuDraft {
  return {
    id: menu.id,
    key: `menu-${menu.id}`,
    name: menu.name,
    price: String(menu.price),
    isActive: menu.isActive ?? true,
  };
}

function createTempMenu(index: number): MenuDraft {
  return {
    id: null,
    key: `new-${Date.now()}-${index}`,
    name: "",
    price: "",
    isActive: true,
  };
}

export function FoodMenuEditorPanel({
  initialData,
  saveEndpoint,
}: {
  initialData: AdminFoodMenuSettingsData;
  saveEndpoint: string;
}) {
  const [menus, setMenus] = useState(initialData.menus.map(toDraft));
  const [saving, setSaving] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  function updateMenu(key: string, patch: Partial<MenuDraft>) {
    setMenus((prev) => prev.map((menu) => (menu.key === key ? { ...menu, ...patch } : menu)));
  }

  function handleAddMenu() {
    setMenus((prev) => [...prev, createTempMenu(prev.length)]);
  }

  function handleRemoveMenu(key: string) {
    setMenus((prev) => prev.filter((menu) => menu.key !== key));
  }

  async function handleSaveAll() {
    if (menus.length === 0) {
      addToast("최소 한 개 이상의 메뉴를 남겨 주세요.", "error");
      return;
    }

    for (const menu of menus) {
      if (!menu.name.trim()) {
        addToast("메뉴 이름이 비어 있는 항목이 있습니다.", "error");
        return;
      }

      const price = Number(menu.price.replace(/[^\d]/g, "") || "0");
      if (!Number.isInteger(price) || price < 0) {
        addToast("가격은 0 이상의 정수여야 합니다.", "error");
        return;
      }
    }

    setSaving(true);
    try {
      const res = await fetch(saveEndpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          menus: menus.map((menu) => ({
            id: menu.id,
            name: menu.name.trim(),
            price: Number(menu.price.replace(/[^\d]/g, "") || "0"),
            isActive: menu.isActive,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "메뉴를 저장하지 못했습니다.");
      }

      setMenus((data.menus as AdminFoodMenuSettingsData["menus"]).map(toDraft));
      addToast("메뉴판을 저장했습니다.", "success");
    } catch (error) {
      addToast(error instanceof Error ? error.message : "메뉴를 저장하지 못했습니다.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="brand-card-soft rounded-3xl p-5">
        <div className="brand-panel-white overflow-hidden rounded-3xl">
          <div className="grid grid-cols-[24px_minmax(0,2fr)_88px_20px] items-center gap-2 border-b border-[var(--brand-divider)] px-3 py-3 text-[11px] font-bold text-[var(--brand-text-subtle)]">
            <span className="text-center">판매중</span>
            <span>이름</span>
            <span>가격</span>
            <span className="text-center">삭제</span>
          </div>

          {menus.length === 0 ? (
            <div className="px-4 py-5">
              <p className="text-sm font-semibold text-[var(--brand-text)]">등록된 메뉴가 없습니다.</p>
              <p className="brand-text-subtle mt-1 text-xs">아래 + 버튼으로 첫 메뉴를 추가해 주세요.</p>
            </div>
          ) : null}

          {menus.map((menu) => (
            <div
              key={menu.key}
              className="grid grid-cols-[24px_minmax(0,2fr)_88px_20px] items-center gap-2 border-b border-[var(--brand-divider)] px-3 py-3 last:border-b-0"
            >
              <label className="flex items-center justify-center">
                <input
                  type="checkbox"
                  checked={Boolean(menu.isActive)}
                  onChange={(event) => updateMenu(menu.key, { isActive: event.target.checked })}
                  aria-label="판매중"
                  className="h-4 w-4 accent-[var(--brand-primary)]"
                />
              </label>

              <div className="min-w-0">
                <input
                  value={menu.name}
                  onChange={(event) => updateMenu(menu.key, { name: event.target.value })}
                  placeholder="메뉴명"
                  className="brand-input h-10 w-full rounded-2xl px-3 py-2 text-sm outline-none"
                />
              </div>

              <div className="min-w-0">
                <input
                  value={menu.price}
                  onChange={(event) =>
                    updateMenu(menu.key, { price: event.target.value.replace(/[^\d]/g, "") })
                  }
                  inputMode="numeric"
                  placeholder="가격"
                  className="brand-input h-10 w-full rounded-2xl px-3 py-2 text-sm outline-none"
                />
              </div>

              <button
                type="button"
                onClick={() => handleRemoveMenu(menu.key)}
                aria-label="메뉴 삭제"
                className="flex h-7 w-7 items-center justify-center rounded-full text-base font-bold text-[var(--brand-danger)] transition-opacity hover:opacity-70"
              >
                x
              </button>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={handleAddMenu}
          className="brand-button-secondary mt-4 flex w-full items-center justify-center rounded-2xl py-3 text-2xl font-bold leading-none"
          aria-label="메뉴 추가"
        >
          +
        </button>

        <button
          type="button"
          onClick={handleSaveAll}
          disabled={saving}
          className="brand-button-primary mt-5 w-full rounded-2xl py-3 text-sm font-bold"
        >
          {saving ? "저장 중..." : "메뉴판 저장"}
        </button>
      </section>

      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => removeToast(toast.id)} />
      ))}
    </>
  );
}
