"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { OrderVariantRow } from "@/components/meeting/food-order/OrderVariantRow";
import {
  filterOrderMenuVariants,
  type OrderDraft,
  type OrderMenuVariant,
} from "@/lib/participant-order-ui";

type VariantGroup = {
  readonly categoryName: string;
  readonly sectionId: string;
  readonly variants: readonly OrderMenuVariant[];
};

function groupVariants(variants: readonly OrderMenuVariant[]): VariantGroup[] {
  const grouped = new Map<string, OrderMenuVariant[]>();
  for (const variant of variants) {
    const current = grouped.get(variant.categoryName) ?? [];
    current.push(variant);
    grouped.set(variant.categoryName, current);
  }
  return Array.from(grouped, ([categoryName, rows], index) => ({
    categoryName,
    sectionId: `order-category-${index}`,
    variants: rows,
  }));
}

export function OrderMenuDiscovery({
  variants,
  draft,
  query,
  selectedOnly,
  disabled,
  onQueryChange,
  onSelectedOnlyChange,
  onQuantityChange,
}: {
  readonly variants: readonly OrderMenuVariant[];
  readonly draft: OrderDraft;
  readonly query: string;
  readonly selectedOnly: boolean;
  readonly disabled: boolean;
  readonly onQueryChange: (query: string) => void;
  readonly onSelectedOnlyChange: (selectedOnly: boolean) => void;
  readonly onQuantityChange: (key: string, quantity: number) => void;
}) {
  const categories = groupVariants(variants);
  const [selectedCategoryName, setSelectedCategoryName] = useState(
    () => categories[0]?.categoryName ?? "",
  );
  const selectedCategory = categories.find(
    (group) => group.categoryName === selectedCategoryName,
  ) ?? categories[0];
  const visible = filterOrderMenuVariants(
    selectedCategory?.variants ?? [],
    query,
    selectedOnly,
    draft,
  );
  const groups = selectedCategory && visible.length > 0
    ? [{ ...selectedCategory, variants: visible }]
    : [];
  const selectedCount = variants.filter((variant) => (draft[variant.key] ?? 0) > 0).length;

  function chooseCategory(group: VariantGroup) {
    setSelectedCategoryName(group.categoryName);
    requestAnimationFrame(() => {
      document.getElementById(group.sectionId)?.scrollIntoView({ block: "start" });
    });
  }

  return (
    <div className="space-y-4 pb-5">
      <section aria-labelledby="order-discovery-title">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-[var(--brand-text)]" id="order-discovery-title">메뉴 찾기</h3>
            <p className="brand-text-subtle mt-1 text-xs">이름이나 옵션을 찾고 필요한 수량만 담아 주세요.</p>
          </div>
          <span className="brand-chip-strong shrink-0 rounded-full px-2.5 py-1 text-xs font-bold">선택 {selectedCount}</span>
        </div>
        <div className="relative mt-3">
          <Icon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-[var(--brand-text-subtle)]" name="search" />
          <input
            aria-label="메뉴 검색"
            className="brand-input h-11 w-full rounded-2xl py-2 pl-10 pr-12 text-sm outline-none [&::-webkit-search-cancel-button]:hidden"
            disabled={disabled}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="메뉴, 카테고리, 옵션 검색"
            type="search"
            value={query}
          />
          {query ? (
            <button
              aria-label="메뉴 검색 지우기"
              className="brand-button-secondary absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full"
              onClick={() => onQueryChange("")}
              type="button"
            >
              <Icon className="text-[18px]" name="close" />
            </button>
          ) : null}
        </div>
        <button
          aria-pressed={selectedOnly}
          className={`mt-2 flex min-h-11 w-full items-center justify-between rounded-2xl px-3 text-sm font-bold ${selectedOnly ? "brand-toggle-active" : "brand-button-secondary"}`}
          disabled={disabled}
          onClick={() => onSelectedOnlyChange(!selectedOnly)}
          type="button"
        >
          <span className="flex items-center gap-2"><Icon className="text-[19px]" name="shopping_basket" /> 선택한 메뉴만 보기</span>
          <span>{selectedCount}개</span>
        </button>
      </section>

      {categories.length > 1 ? (
        <nav aria-label="메뉴 카테고리" className="brand-mobile-scrollbar-hidden sticky top-0 z-[5] -mx-4 overflow-x-auto border-y border-[var(--brand-divider)] bg-[var(--brand-surface-glass)] px-4 py-2">
          <div className="flex w-max gap-2">
            {categories.map((group) => {
              const selected = group.categoryName === selectedCategory?.categoryName;
              return (
                <button
                  aria-controls={group.sectionId}
                  aria-pressed={selected}
                  className={`min-h-11 rounded-full px-3 text-xs font-bold ${selected ? "brand-toggle-active" : "brand-button-secondary"}`}
                  key={group.sectionId}
                  onClick={() => chooseCategory(group)}
                  type="button"
                >
                  {group.categoryName} {group.variants.length}
                </button>
              );
            })}
          </div>
        </nav>
      ) : null}

      {groups.length === 0 ? (
        <section className="brand-panel-white rounded-3xl px-5 py-8 text-center" role="status">
          <Icon className="text-[32px] text-[var(--brand-primary-text)]" name={selectedOnly ? "remove_shopping_cart" : "search_off"} />
          <p className="mt-2 text-sm font-extrabold text-[var(--brand-text)]">
            {selectedOnly ? "아직 담은 메뉴가 없습니다" : "검색 결과가 없습니다"}
          </p>
          <p className="brand-text-subtle mt-1 text-xs">{selectedOnly ? "전체 메뉴에서 수량을 추가해 주세요." : "다른 이름이나 옵션으로 찾아보세요."}</p>
          <button
            className="brand-button-secondary mt-4 min-h-11 rounded-2xl px-4 text-sm font-bold"
            onClick={() => selectedOnly ? onSelectedOnlyChange(false) : onQueryChange("")}
            type="button"
          >
            {selectedOnly ? "전체 메뉴 보기" : "검색 지우기"}
          </button>
        </section>
      ) : groups.map((group) => (
        <section className="scroll-mt-2 space-y-2" id={group.sectionId} key={group.sectionId}>
          <div className="flex items-center justify-between gap-3 px-1">
            <h3
              className="rounded-lg text-xs font-extrabold tracking-[0.06em] text-[var(--brand-text)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-primary)]"
              id={`${group.sectionId}-heading`}
              tabIndex={-1}
            >
              {group.categoryName}
            </h3>
            <span className="brand-text-subtle text-xs">{group.variants.length}개</span>
          </div>
          {group.variants.map((variant) => (
            <OrderVariantRow
              disabled={disabled}
              key={variant.key}
              onChange={(quantity) => onQuantityChange(variant.key, quantity)}
              quantity={draft[variant.key] ?? 0}
              variant={variant}
            />
          ))}
        </section>
      ))}
    </div>
  );
}
