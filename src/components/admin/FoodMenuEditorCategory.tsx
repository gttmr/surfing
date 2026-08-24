import { FoodMenuEditorMenu, type MenuEditorActions } from "@/components/admin/FoodMenuEditorMenu";
import { Icon } from "@/components/ui/Icon";
import type { CategorySearchResult, SearchFocus } from "@/lib/food-menu-editor";
import { categoryNameFieldId, categoryToggleId } from "@/lib/food-menu-editor-validation";

type FoodMenuEditorCategoryProps = {
  readonly result: CategorySearchResult;
  readonly open: boolean;
  readonly searchActive: boolean;
  readonly invalidFieldId: string | null;
  readonly menuActions: MenuEditorActions;
  readonly onToggle: () => void;
  readonly onChangeName: (name: string) => void;
  readonly onAddMenu: () => void;
  readonly onRequestDelete: () => void;
  readonly onSearchFocus: (focus: SearchFocus) => void;
  readonly onSearchBlur: () => void;
};

export function FoodMenuEditorCategory({
  result,
  open,
  searchActive,
  invalidFieldId,
  menuActions,
  onToggle,
  onChangeName,
  onAddMenu,
  onRequestDelete,
  onSearchFocus,
  onSearchBlur,
}: FoodMenuEditorCategoryProps) {
  const { category, menus, variantCount } = result;
  const contentId = `category-content-${category.key}`;
  const nameId = categoryNameFieldId(category);
  const displayName = category.name.trim() || "이름 없는 카테고리";

  return (
    <section className="brand-admin-section overflow-hidden">
      <div className="brand-admin-section-header flex items-center gap-2 px-3 py-3">
        <button
          aria-controls={contentId}
          aria-expanded={open}
          className="brand-list-item brand-list-item-hover flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-2 py-2 text-left"
          id={categoryToggleId(category.key)}
          onClick={onToggle}
          type="button"
        >
          <Icon className={`shrink-0 text-[22px] transition-transform ${open ? "rotate-180" : ""}`} name="expand_more" />
          <span className="min-w-0 flex-1">
            <span className="block text-pretty text-sm font-extrabold text-brand-text">{displayName}</span>
            <span className="brand-text-subtle mt-1 block text-xs">메뉴 {menus.length}개 · 판매 조합 {variantCount}개</span>
          </span>
        </button>
        <button
          aria-label={`${displayName} 카테고리 삭제`}
          className="brand-button-danger flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          onClick={onRequestDelete}
          type="button"
        >
          <Icon className="text-[20px]" name="delete" />
        </button>
      </div>

      {open ? (
        <div className="space-y-4 px-4 py-4" id={contentId}>
          <div>
            <label className="brand-text-subtle text-xs font-semibold" htmlFor={nameId}>카테고리 이름</label>
            <input
              aria-invalid={invalidFieldId === nameId}
              className={`brand-input ${invalidFieldId === nameId ? "brand-input-error" : ""} h-11 w-full rounded-2xl px-4 py-2 text-sm font-bold outline-none`}
              id={nameId}
              onBlur={onSearchBlur}
              onChange={(event) => onChangeName(event.target.value)}
              onFocus={() => onSearchFocus({ kind: "category", key: category.key })}
              placeholder="카테고리 이름"
              value={category.name}
            />
          </div>

          {menus.length === 0 ? (
            <div className="brand-inset-panel rounded-2xl px-4 py-5 text-center">
              <p className="text-sm font-bold text-brand-text">표시할 메뉴가 없습니다.</p>
              <p className="brand-text-subtle mt-1 text-xs">검색을 지우거나 새 메뉴를 추가해 주세요.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {menus.map(({ menu, options }) => (
                <FoodMenuEditorMenu
                  actions={menuActions}
                  categoryKey={category.key}
                  invalidFieldId={invalidFieldId}
                  key={menu.key}
                  menu={menu}
                  onSearchBlur={onSearchBlur}
                  onSearchFocus={onSearchFocus}
                  searchActive={searchActive}
                  visibleOptions={options}
                />
              ))}
            </div>
          )}

          {searchActive ? null : (
            <button className="brand-button-secondary flex w-full items-center justify-center gap-1 rounded-2xl px-4 py-3 text-sm font-bold" onClick={onAddMenu} type="button">
              <Icon className="text-[20px]" name="add" /> 메뉴 추가
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}
