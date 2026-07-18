import { Icon } from "@/components/ui/Icon";
import {
  variantLabel,
  type MenuDraft,
  type MenuOptionDraft,
  type SearchFocus,
} from "@/lib/food-menu-editor";
import type { MenuLocation, OptionLocation } from "@/lib/food-menu-editor-updates";
import {
  menuNameFieldId,
  menuPriceFieldId,
  optionGroupFieldId,
  optionLabelFieldId,
  optionPriceFieldId,
} from "@/lib/food-menu-editor-validation";

export type MenuEditorActions = {
  readonly changeMenu: (location: MenuLocation, patch: Partial<MenuDraft>) => void;
  readonly changeOption: (location: OptionLocation, patch: Partial<MenuOptionDraft>) => void;
  readonly addOption: (location: MenuLocation) => void;
  readonly addHotIce: (location: MenuLocation) => void;
  readonly requestMenuDelete: (location: MenuLocation) => void;
  readonly requestOptionDelete: (location: OptionLocation) => void;
};

type FoodMenuEditorMenuProps = {
  readonly categoryKey: string;
  readonly menu: MenuDraft;
  readonly visibleOptions: readonly MenuOptionDraft[];
  readonly searchActive: boolean;
  readonly invalidFieldId: string | null;
  readonly actions: MenuEditorActions;
  readonly onSearchFocus: (focus: SearchFocus) => void;
  readonly onSearchBlur: () => void;
};

function inputClassName(invalid: boolean, width = "w-full"): string {
  return `brand-input ${invalid ? "brand-input-error" : ""} h-11 ${width} rounded-2xl px-3 py-2 text-sm outline-none`;
}

export function FoodMenuEditorMenu({
  categoryKey,
  menu,
  visibleOptions,
  searchActive,
  invalidFieldId,
  actions,
  onSearchFocus,
  onSearchBlur,
}: FoodMenuEditorMenuProps) {
  const location = { categoryKey, menuKey: menu.key };
  const nameId = menuNameFieldId(menu);
  const priceId = menuPriceFieldId(menu);
  const groupId = optionGroupFieldId(menu);
  const displayName = menu.name.trim() || "이름 없는 메뉴";

  return (
    <article aria-label={`${displayName} 메뉴 편집`} className="brand-panel-white overflow-hidden rounded-3xl">
      <div className="border-b border-[var(--brand-divider)] px-4 py-4">
        <div className="flex items-start gap-3">
          <label className="flex min-h-11 shrink-0 items-center gap-2 text-xs font-bold text-[var(--brand-text)]">
            <input
              aria-label={`${displayName} 판매 중`}
              checked={menu.isActive}
              className="h-5 w-5 accent-[var(--brand-primary)]"
              onChange={(event) => actions.changeMenu(location, { isActive: event.target.checked })}
              type="checkbox"
            />
            판매
          </label>
          <div className="min-w-0 flex-1">
            <label className="brand-text-subtle text-xs font-semibold" htmlFor={nameId}>메뉴 이름</label>
            <input
              aria-invalid={invalidFieldId === nameId}
              className={inputClassName(invalidFieldId === nameId)}
              id={nameId}
              onBlur={onSearchBlur}
              onChange={(event) => actions.changeMenu(location, { name: event.target.value })}
              onFocus={() => onSearchFocus({ kind: "menu", key: menu.key })}
              placeholder="메뉴 이름"
              value={menu.name}
            />
          </div>
          <button
            aria-label={`${displayName} 메뉴 삭제`}
            className="brand-button-danger flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
            onClick={() => actions.requestMenuDelete(location)}
            type="button"
          >
            <Icon className="text-[20px]" name="delete" />
          </button>
        </div>

        {menu.options.length === 0 ? (
          <div className="mt-3">
            <label className="brand-text-subtle text-xs font-semibold" htmlFor={priceId}>기본 가격</label>
            <input
              aria-invalid={invalidFieldId === priceId}
              className={inputClassName(invalidFieldId === priceId)}
              id={priceId}
              inputMode="numeric"
              onChange={(event) => actions.changeMenu(location, { price: event.target.value })}
              placeholder="0"
              value={menu.price}
            />
          </div>
        ) : (
          <div className="mt-3">
            <label className="brand-text-subtle text-xs font-semibold" htmlFor={groupId}>옵션 이름</label>
            <input
              aria-invalid={invalidFieldId === groupId}
              className={inputClassName(invalidFieldId === groupId)}
              id={groupId}
              onChange={(event) => actions.changeMenu(location, { optionGroupName: event.target.value })}
              placeholder="예: 온도, 크기"
              value={menu.optionGroupName}
            />
          </div>
        )}
      </div>

      {menu.options.length > 0 ? (
        <div className="space-y-3 px-4 py-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-extrabold text-[var(--brand-text)]">옵션 조합 {menu.options.length}개</h3>
            {visibleOptions.length !== menu.options.length ? (
              <span className="brand-chip-strong rounded-full px-2 py-1 text-xs font-bold">검색 결과 {visibleOptions.length}</span>
            ) : null}
          </div>
          {visibleOptions.map((option) => {
            const optionIndex = menu.options.findIndex((candidate) => candidate.key === option.key);
            const labelId = optionLabelFieldId(option);
            const optionPriceId = optionPriceFieldId(option);
            const optionLocation = { ...location, optionKey: option.key };
            const displayLabel = variantLabel(menu, option, Math.max(0, optionIndex));
            return (
              <section className="brand-inset-panel rounded-2xl p-3" key={option.key}>
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 text-pretty text-xs font-extrabold text-[var(--brand-text)]">{displayLabel}</p>
                  <button
                    aria-label={`${displayLabel} 옵션 삭제`}
                    className="brand-button-danger flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                    onClick={() => actions.requestOptionDelete(optionLocation)}
                    type="button"
                  >
                    <Icon className="text-[19px]" name="delete" />
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-[minmax(0,1fr)_7.25rem] gap-2">
                  <div className="min-w-0">
                    <label className="brand-text-subtle text-xs font-semibold" htmlFor={labelId}>선택지</label>
                    <input
                      aria-invalid={invalidFieldId === labelId}
                      className={inputClassName(invalidFieldId === labelId)}
                      id={labelId}
                      onBlur={onSearchBlur}
                      onChange={(event) => actions.changeOption(optionLocation, { label: event.target.value })}
                      onFocus={() => onSearchFocus({ kind: "option", key: option.key })}
                      placeholder="예: ICE"
                      value={option.label}
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="brand-text-subtle text-xs font-semibold" htmlFor={optionPriceId}>가격</label>
                    <input
                      aria-invalid={invalidFieldId === optionPriceId}
                      className={inputClassName(invalidFieldId === optionPriceId)}
                      id={optionPriceId}
                      inputMode="numeric"
                      onChange={(event) => actions.changeOption(optionLocation, { price: event.target.value })}
                      placeholder="0"
                      value={option.price}
                    />
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      ) : null}

      <div className="border-t border-[var(--brand-divider)] px-4 py-3">
        {searchActive ? (
          <p className="brand-text-subtle text-xs">옵션 추가는 검색을 지운 뒤 사용할 수 있습니다.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            <button className="brand-button-secondary inline-flex items-center gap-1 rounded-2xl px-3 py-2 text-xs font-bold" onClick={() => actions.addOption(location)} type="button">
              <Icon className="text-[18px]" name="add" /> 옵션 추가
            </button>
            <button className="brand-button-secondary rounded-2xl px-3 py-2 text-xs font-bold" onClick={() => actions.addHotIce(location)} type="button">ICE · HOT 추가</button>
          </div>
        )}
      </div>
    </article>
  );
}
