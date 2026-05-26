"use client";

import { useState } from "react";
import { Toast, useToast } from "@/components/ui/Toast";
import type { AdminFoodMenuSettingsData } from "@/lib/food-ordering-data";

type MenuDraft = {
  id: number | null;
  key: string;
  name: string;
  price: string;
  optionGroupName: string;
  options: MenuOptionDraft[];
  isActive: boolean;
};

type MenuOptionDraft = {
  id: number | null;
  key: string;
  label: string;
  price: string;
};

type CategoryDraft = {
  id: number | null;
  key: string;
  name: string;
  menus: MenuDraft[];
};

const DEFAULT_OPTION_GROUP_NAME = "옵션";
const HOT_ICE_OPTION_LABELS = ["ICE", "HOT"];

function toMenuDraft(menu: AdminFoodMenuSettingsData["categories"][number]["menus"][number]): MenuDraft {
  return {
    id: menu.id,
    key: `menu-${menu.id}`,
    name: menu.name,
    price: String(menu.price),
    optionGroupName: menu.optionGroupName ?? (menu.options.length > 0 ? DEFAULT_OPTION_GROUP_NAME : ""),
    options: menu.options.map((option) => ({
      id: option.id,
      key: `option-${option.id}`,
      label: option.label,
      price: String(option.price),
    })),
    isActive: menu.isActive ?? true,
  };
}

function toCategoryDraft(category: AdminFoodMenuSettingsData["categories"][number]): CategoryDraft {
  return {
    id: category.id,
    key: `category-${category.id}`,
    name: category.name,
    menus: category.menus.map(toMenuDraft),
  };
}

function createTempMenu(categoryIndex: number, menuIndex: number): MenuDraft {
  return {
    id: null,
    key: `new-menu-${Date.now()}-${categoryIndex}-${menuIndex}`,
    name: "",
    price: "",
    optionGroupName: "",
    options: [],
    isActive: true,
  };
}

function createTempCategory(index: number): CategoryDraft {
  return {
    id: null,
    key: `new-category-${Date.now()}-${index}`,
    name: "",
    menus: [],
  };
}

export function FoodMenuEditorPanel({
  initialData,
  saveEndpoint,
}: {
  initialData: AdminFoodMenuSettingsData;
  saveEndpoint: string;
}) {
  const [categories, setCategories] = useState(initialData.categories.map(toCategoryDraft));
  const [saving, setSaving] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  function updateCategory(categoryKey: string, patch: Partial<CategoryDraft>) {
    setCategories((prev) =>
      prev.map((category) => (category.key === categoryKey ? { ...category, ...patch } : category))
    );
  }

  function updateMenu(categoryKey: string, menuKey: string, patch: Partial<MenuDraft>) {
    setCategories((prev) =>
      prev.map((category) =>
        category.key === categoryKey
          ? {
              ...category,
              menus: category.menus.map((menu) =>
                menu.key === menuKey ? { ...menu, ...patch } : menu
              ),
            }
          : category
      )
    );
  }

  function updateMenuOption(
    categoryKey: string,
    menuKey: string,
    optionKey: string,
    patch: Partial<MenuOptionDraft>
  ) {
    setCategories((prev) =>
      prev.map((category) =>
        category.key === categoryKey
          ? {
              ...category,
              menus: category.menus.map((menu) =>
                menu.key === menuKey
                  ? {
                      ...menu,
                      options: menu.options.map((option) =>
                        option.key === optionKey ? { ...option, ...patch } : option
                      ),
                    }
                  : menu
              ),
            }
          : category
      )
    );
  }

  function handleAddCategory() {
    setCategories((prev) => [...prev, createTempCategory(prev.length)]);
  }

  function handleRemoveCategory(categoryKey: string) {
    setCategories((prev) => prev.filter((category) => category.key !== categoryKey));
  }

  function handleAddMenu(categoryKey: string) {
    setCategories((prev) =>
      prev.map((category, categoryIndex) =>
        category.key === categoryKey
          ? {
              ...category,
              menus: [...category.menus, createTempMenu(categoryIndex, category.menus.length)],
            }
          : category
      )
    );
  }

  function handleRemoveMenu(categoryKey: string, menuKey: string) {
    setCategories((prev) =>
      prev.map((category) =>
        category.key === categoryKey
          ? {
              ...category,
              menus: category.menus.filter((menu) => menu.key !== menuKey),
            }
          : category
      )
    );
  }

  function handleAddOption(categoryKey: string, menuKey: string) {
    setCategories((prev) =>
      prev.map((category) =>
        category.key === categoryKey
          ? {
              ...category,
              menus: category.menus.map((menu) =>
                menu.key === menuKey
                  ? {
                      ...menu,
                      optionGroupName: menu.optionGroupName || DEFAULT_OPTION_GROUP_NAME,
                      options: [
                        ...menu.options,
                        {
                          id: null,
                          key: `new-option-${Date.now()}-${menu.options.length}`,
                          label: "",
                          price: menu.price,
                        },
                      ],
                    }
                  : menu
              ),
            }
          : category
      )
    );
  }

  function handleAddHotIceOptions(categoryKey: string, menuKey: string) {
    setCategories((prev) =>
      prev.map((category) =>
        category.key === categoryKey
          ? {
              ...category,
              menus: category.menus.map((menu) => {
                if (menu.key !== menuKey) {
                  return menu;
                }

                const existingLabels = new Set(menu.options.map((option) => option.label.trim().toUpperCase()));
                const optionsToAdd = HOT_ICE_OPTION_LABELS.filter((label) => !existingLabels.has(label));

                return {
                  ...menu,
                  optionGroupName: menu.optionGroupName || DEFAULT_OPTION_GROUP_NAME,
                  options: [
                    ...menu.options,
                    ...optionsToAdd.map((label, index) => ({
                      id: null,
                      key: `new-option-${Date.now()}-${menu.options.length + index}`,
                      label,
                      price: menu.price,
                    })),
                  ],
                };
              }),
            }
          : category
      )
    );
  }

  function handleRemoveOption(categoryKey: string, menuKey: string, optionKey: string) {
    setCategories((prev) =>
      prev.map((category) =>
        category.key === categoryKey
          ? {
              ...category,
              menus: category.menus.map((menu) =>
                menu.key === menuKey
                  ? {
                      ...menu,
                      optionGroupName: menu.options.length <= 1 ? "" : menu.optionGroupName,
                      options: menu.options.filter((option) => option.key !== optionKey),
                    }
                  : menu
              ),
            }
          : category
      )
    );
  }

  async function handleSaveAll() {
    if (categories.length === 0) {
      addToast("최소 한 개 이상의 카테고리를 남겨 주세요.", "error");
      return;
    }

    for (const category of categories) {
      if (!category.name.trim()) {
        addToast("카테고리 이름이 비어 있는 항목이 있습니다.", "error");
        return;
      }

      for (const menu of category.menus) {
        if (!menu.name.trim()) {
          addToast("메뉴 이름이 비어 있는 항목이 있습니다.", "error");
          return;
        }

        const price = Number(menu.price.replace(/[^\d]/g, "") || "0");
        if (!Number.isInteger(price) || price < 0) {
          addToast("가격은 0 이상의 정수여야 합니다.", "error");
          return;
        }

        if (menu.optionGroupName.trim() && menu.options.length === 0) {
          addToast("옵션명이 있는 메뉴는 선택지를 한 개 이상 입력해 주세요.", "error");
          return;
        }

        if (menu.options.some((option) => !option.label.trim())) {
          addToast("비어 있는 옵션 선택지가 있습니다.", "error");
          return;
        }

        for (const option of menu.options) {
          const optionPrice = Number(option.price.replace(/[^\d]/g, "") || "0");
          if (!Number.isInteger(optionPrice) || optionPrice < 0) {
            addToast("옵션 가격은 0 이상의 정수여야 합니다.", "error");
            return;
          }
        }
      }
    }

    setSaving(true);
    try {
      const res = await fetch(saveEndpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categories: categories.map((category) => ({
            id: category.id,
            name: category.name.trim(),
            menus: category.menus.map((menu) => ({
              id: menu.id,
              name: menu.name.trim(),
              price: Number(menu.price.replace(/[^\d]/g, "") || "0"),
              optionGroupName:
                menu.options.length > 0
                  ? menu.optionGroupName.trim() || DEFAULT_OPTION_GROUP_NAME
                  : null,
              options: menu.options.map((option) => ({
                id: option.id,
                label: option.label.trim(),
                price: Number(option.price.replace(/[^\d]/g, "") || "0"),
              })),
              isActive: menu.isActive,
            })),
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "메뉴를 저장하지 못했습니다.");
      }

      setCategories((data.categories as AdminFoodMenuSettingsData["categories"]).map(toCategoryDraft));
      addToast("카테고리와 메뉴판을 저장했습니다.", "success");
    } catch (error) {
      addToast(error instanceof Error ? error.message : "메뉴를 저장하지 못했습니다.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="space-y-4">
        {categories.length === 0 ? (
          <section className="brand-admin-section px-5 py-5">
            <p className="text-sm font-semibold text-[var(--brand-text)]">등록된 카테고리가 없습니다.</p>
            <p className="brand-text-subtle mt-1 text-xs">아래 버튼으로 첫 카테고리를 추가해 주세요.</p>
          </section>
        ) : null}

        {categories.map((category) => (
          <section key={category.key} className="brand-admin-section overflow-hidden">
            <div className="brand-admin-section-header flex items-center gap-3 px-5 py-4">
              <input
                value={category.name}
                onChange={(event) => updateCategory(category.key, { name: event.target.value })}
                placeholder="카테고리명"
                className="brand-input h-11 flex-1 rounded-2xl px-4 py-2 text-sm font-bold outline-none"
              />
              <button
                type="button"
                onClick={() => handleRemoveCategory(category.key)}
                aria-label="카테고리 삭제"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-lg font-bold leading-none text-[var(--brand-danger)] transition-opacity hover:opacity-70"
              >
                ×
              </button>
            </div>

            <div className="overflow-hidden px-5 py-5">
              <div className="brand-panel-white overflow-hidden rounded-3xl">
                <div className="grid grid-cols-[32px_minmax(0,2fr)_92px_28px] items-center gap-2 border-b border-[var(--brand-divider)] px-3 py-3 text-[11px] font-bold text-[var(--brand-text-subtle)]">
                  <span className="text-center">판매</span>
                  <span>이름</span>
                  <span>가격</span>
                  <span className="text-center">삭제</span>
                </div>

                {category.menus.length === 0 ? (
                  <div className="px-4 py-5">
                    <p className="text-sm font-semibold text-[var(--brand-text)]">이 카테고리에 등록된 메뉴가 없습니다.</p>
                    <p className="brand-text-subtle mt-1 text-xs">아래 + 메뉴 버튼으로 항목을 추가해 주세요.</p>
                  </div>
                ) : null}

                {category.menus.map((menu) => (
                  <div key={menu.key} className="border-b border-[var(--brand-divider)] px-3 py-3 last:border-b-0">
                    <div className="grid grid-cols-[32px_minmax(0,2fr)_92px_28px] items-center gap-2">
                      <label className="flex items-center justify-center">
                        <input
                          type="checkbox"
                          checked={Boolean(menu.isActive)}
                          onChange={(event) =>
                            updateMenu(category.key, menu.key, { isActive: event.target.checked })
                          }
                          aria-label="판매중"
                          className="h-4 w-4 accent-[var(--brand-primary)]"
                        />
                      </label>

                      <div className="min-w-0">
                        <input
                          value={menu.name}
                          onChange={(event) =>
                            updateMenu(category.key, menu.key, { name: event.target.value })
                          }
                          placeholder="메뉴명"
                          className="brand-input h-10 w-full rounded-2xl px-3 py-2 text-sm outline-none"
                        />
                      </div>

                      <div className="min-w-0">
                        <input
                          value={menu.price}
                          onChange={(event) =>
                            updateMenu(category.key, menu.key, {
                              price: event.target.value.replace(/[^\d]/g, ""),
                            })
                          }
                          inputMode="numeric"
                          placeholder="가격"
                          className="brand-input h-10 w-full rounded-2xl px-3 py-2 text-sm outline-none"
                        />
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveMenu(category.key, menu.key)}
                        aria-label="메뉴 삭제"
                        className="flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold leading-none text-[var(--brand-danger)] transition-opacity hover:opacity-70"
                      >
                        ×
                      </button>
                    </div>

                    <div className="ml-10 mt-3 space-y-2">
                      {menu.options.map((option) => (
                        <div key={option.key} className="flex items-center gap-2">
                          <input
                            value={option.label}
                            onChange={(event) =>
                              updateMenuOption(category.key, menu.key, option.key, { label: event.target.value })
                            }
                            placeholder="선택지 예: 아이스"
                            className="brand-input h-10 min-w-0 flex-1 rounded-2xl px-3 py-2 text-sm outline-none"
                          />
                          <input
                            value={option.price}
                            onChange={(event) =>
                              updateMenuOption(category.key, menu.key, option.key, {
                                price: event.target.value.replace(/[^\d]/g, ""),
                              })
                            }
                            inputMode="numeric"
                            placeholder="가격"
                            className="brand-input h-10 w-24 rounded-2xl px-3 py-2 text-sm outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveOption(category.key, menu.key, option.key)}
                            aria-label="옵션 삭제"
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-lg font-bold leading-none text-[var(--brand-danger)] transition-opacity hover:opacity-70"
                          >
                            ×
                          </button>
                        </div>
                      ))}

                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleAddOption(category.key, menu.key)}
                          className="brand-button-secondary rounded-2xl px-3 py-2 text-xs font-bold"
                        >
                          + 옵션 추가
                        </button>
                        <button
                          type="button"
                          onClick={() => handleAddHotIceOptions(category.key, menu.key)}
                          className="brand-button-secondary rounded-2xl px-3 py-2 text-xs font-bold"
                        >
                          Hot,Ice
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => handleAddMenu(category.key)}
                className="brand-button-secondary mt-4 flex w-full items-center justify-center rounded-2xl py-3 text-sm font-bold"
              >
                + 메뉴 추가
              </button>
            </div>
          </section>
        ))}

        <button
          type="button"
          onClick={handleAddCategory}
          className="brand-button-secondary flex w-full items-center justify-center rounded-2xl py-3 text-sm font-bold"
        >
          + 카테고리 추가
        </button>

        <button
          type="button"
          onClick={handleSaveAll}
          disabled={saving}
          className="brand-button-primary w-full rounded-2xl py-3 text-sm font-bold"
        >
          {saving ? "저장 중..." : "카테고리와 메뉴 저장"}
        </button>
      </div>

      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => removeToast(toast.id)} />
      ))}
    </>
  );
}
