"use client";

import { useState } from "react";
import { FoodMenuEditorCategory } from "@/components/admin/FoodMenuEditorCategory";
import { useFoodMenuEditor, type DeleteTarget } from "@/components/admin/useFoodMenuEditor";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { Toast, useToast } from "@/components/ui/Toast";
import { MENU_EDITOR_SEARCH_FIELD_ID } from "@/lib/food-menu-editor-validation";
import type { AdminFoodMenuSettingsData } from "@/lib/food-ordering-data";

type DeleteDialogCopy = {
  readonly title: string;
  readonly description: string;
  readonly action: string;
};

function deleteDialogCopy(target: DeleteTarget | null): DeleteDialogCopy {
  if (!target) return { title: "항목을 삭제할까요?", description: "저장하기 전까지 삭제는 확정되지 않습니다.", action: "삭제" };
  if (target.kind === "category") {
    return {
      title: "카테고리를 삭제할까요?",
      description: `“${target.name}”과 메뉴 ${target.menuCount}개, 판매 조합 ${target.variantCount}개가 저장할 때 삭제됩니다.`,
      action: "카테고리 삭제",
    };
  }
  if (target.kind === "menu") {
    return {
      title: "메뉴를 삭제할까요?",
      description: `“${target.name}” 메뉴와 옵션 ${target.optionCount}개가 저장할 때 삭제됩니다.`,
      action: "메뉴 삭제",
    };
  }
  return {
    title: "옵션을 삭제할까요?",
    description: `“${target.label}” 조합을 저장하면 더 이상 메뉴에서 선택할 수 없습니다.`,
    action: "옵션 삭제",
  };
}

export function FoodMenuEditorPanel({
  initialData,
  saveEndpoint,
}: {
  readonly initialData: AdminFoodMenuSettingsData;
  readonly saveEndpoint: string;
}) {
  const { toasts, addToast, removeToast } = useToast();
  const editor = useFoodMenuEditor(initialData, saveEndpoint, addToast);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [reloadOpen, setReloadOpen] = useState(false);
  const searchActive = editor.query.trim().length > 0;
  const working = editor.saving || editor.reloading;
  const deletion = deleteDialogCopy(editor.deleteTarget);

  function requestReload() {
    if (editor.dirtyCount > 0) setReloadOpen(true);
    else void editor.reload();
  }

  return (
    <>
      <fieldset aria-busy={editor.saving} className="min-w-0 border-0 p-0" disabled={editor.saving}>
      <div className="space-y-4 pb-4">
        <section className="brand-admin-section px-4 py-4" aria-labelledby="menu-search-title">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-[var(--brand-text)]" id="menu-search-title">카탈로그 찾기</h2>
              <p className="brand-text-subtle mt-1 text-xs">카테고리, 메뉴, 옵션 조합을 한 번에 검색합니다.</p>
            </div>
            <span className="brand-chip-strong shrink-0 rounded-full px-2 py-1 text-xs font-bold">카테고리 {editor.results.length}</span>
          </div>
          <div className="relative mt-3">
            <Icon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px] text-[var(--brand-text-subtle)]" name="search" />
            <input
              aria-label="메뉴, 카테고리, 옵션 검색"
              className="brand-input h-11 w-full rounded-2xl py-2 pl-10 pr-12 text-sm outline-none [&::-webkit-search-cancel-button]:hidden"
              id={MENU_EDITOR_SEARCH_FIELD_ID}
              onChange={(event) => editor.setQuery(event.target.value)}
              placeholder="이름으로 검색"
              type="search"
              value={editor.query}
            />
            {searchActive ? (
              <button aria-label="메뉴 검색 지우기" className="brand-button-secondary absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full" onClick={() => editor.setQuery("")} type="button">
                <Icon className="text-[18px]" name="close" />
              </button>
            ) : null}
          </div>
        </section>

        {editor.results.length === 0 && searchActive ? (
          <section className="brand-admin-section px-5 py-8 text-center">
            <Icon className="text-[32px] text-[var(--brand-primary-text)]" name="search_off" />
            <p className="mt-2 text-sm font-bold text-[var(--brand-text)]">검색 결과가 없습니다.</p>
            <p className="brand-text-subtle mt-1 text-xs">다른 이름을 입력하거나 검색을 지워 주세요.</p>
            <button className="brand-button-secondary mt-4 rounded-2xl px-4 py-2 text-sm font-bold" onClick={() => editor.setQuery("")} type="button">검색 지우기</button>
          </section>
        ) : editor.categoryCount === 0 ? (
          <section className="brand-admin-section px-5 py-8 text-center">
            <Icon className="text-[32px] text-[var(--brand-primary-text)]" name="restaurant_menu" />
            <p className="mt-2 text-sm font-bold text-[var(--brand-text)]">등록된 카테고리가 없습니다.</p>
            <p className="brand-text-subtle mt-1 text-xs">아래 버튼으로 첫 카테고리를 추가해 주세요.</p>
          </section>
        ) : (
          editor.results.map((result) => (
            <FoodMenuEditorCategory
              invalidFieldId={editor.invalidFieldId}
              key={result.category.key}
              menuActions={editor.menuActions}
              onAddMenu={() => editor.addMenu(result.category.key)}
              onChangeName={(name) => editor.changeCategory(result.category.key, name)}
              onRequestDelete={() => editor.requestCategoryDelete(result.category.key)}
              onSearchBlur={editor.blurSearchResult}
              onSearchFocus={editor.focusSearchResult}
              onToggle={() => editor.toggleCategory(result.category.key)}
              open={searchActive || editor.expanded.has(result.category.key)}
              result={result}
              searchActive={searchActive}
            />
          ))
        )}

        {searchActive ? null : (
          <button className="brand-button-secondary flex w-full items-center justify-center gap-1 rounded-2xl px-4 py-3 text-sm font-bold" onClick={editor.handleAddCategory} type="button">
            <Icon className="text-[20px]" name="add" /> 카테고리 추가
          </button>
        )}

        <section aria-label="메뉴 저장 작업" className="brand-card-soft sticky bottom-[calc(var(--brand-dock-clearance)+var(--brand-safe-bottom))] z-10 rounded-3xl p-4 shadow-brand">
          {editor.validationMessage ? <p className="brand-inline-danger mb-3 rounded-2xl px-3 py-2 text-sm font-semibold" role="alert">{editor.validationMessage}</p> : null}
          {editor.failure ? (
            <div className="brand-inline-danger mb-3 rounded-2xl px-3 py-3" role="alert">
              <p className="text-sm font-bold">변경 내용을 반영하지 못했습니다.</p>
              <p className="mt-1 text-xs">{editor.failure.message}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="brand-button-secondary rounded-2xl px-3 py-2 text-xs font-bold" disabled={working} onClick={() => void (editor.failure?.operation === "reload" ? editor.reload() : editor.save())} type="button">
                  {editor.failure.operation === "reload" ? "불러오기 다시 시도" : "저장 다시 시도"}
                </button>
                <button className="brand-button-secondary rounded-2xl px-3 py-2 text-xs font-bold" disabled={working} onClick={requestReload} type="button">서버 데이터 다시 불러오기</button>
              </div>
            </div>
          ) : null}
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p aria-live="polite" className="text-sm font-extrabold text-[var(--brand-text)]">저장 전 변경 {editor.dirtyCount}개</p>
              <p className="brand-text-subtle mt-1 text-xs">저장본: 카테고리 {editor.savedSummary.categoryCount} · 메뉴 {editor.savedSummary.menuCount} · 판매 중 {editor.savedSummary.activeMenuCount} · 판매 조합 {editor.savedSummary.activeVariantCount}</p>
            </div>
            <div className="grid w-full grid-cols-2 gap-2">
              <button className="brand-button-secondary rounded-2xl px-3 py-3 text-sm font-bold" disabled={working || editor.dirtyCount === 0} onClick={() => setDiscardOpen(true)} type="button">변경 버리기</button>
              <button className="brand-button-primary rounded-2xl px-3 py-3 text-sm font-bold" disabled={working || editor.dirtyCount === 0} onClick={() => void editor.save()} type="button">{editor.saving ? "저장 중..." : "저장"}</button>
            </div>
          </div>
        </section>
      </div>
      </fieldset>

      <Dialog description={deletion.description} onClose={() => editor.setDeleteTarget(null)} open={editor.deleteTarget !== null} title={deletion.title}>
        <div className="flex gap-3">
          <button className="brand-button-secondary flex-1 rounded-2xl px-4 py-3 text-sm font-bold" disabled={editor.saving} onClick={() => editor.setDeleteTarget(null)} type="button">취소</button>
          <button className="brand-button-danger-solid flex-1 rounded-2xl px-4 py-3 text-sm font-bold" disabled={editor.saving} onClick={editor.confirmDelete} type="button">{deletion.action}</button>
        </div>
      </Dialog>

      <Dialog description={`저장 전 변경 ${editor.dirtyCount}개는 복구할 수 없습니다.`} onClose={() => setDiscardOpen(false)} open={discardOpen} title="변경 내용을 버릴까요?">
        <div className="flex gap-3">
          <button className="brand-button-secondary flex-1 rounded-2xl px-4 py-3 text-sm font-bold" disabled={editor.saving} onClick={() => setDiscardOpen(false)} type="button">계속 편집</button>
          <button className="brand-button-danger-solid flex-1 rounded-2xl px-4 py-3 text-sm font-bold" disabled={editor.saving} onClick={() => { editor.discard(); setDiscardOpen(false); }} type="button">변경 버리기</button>
        </div>
      </Dialog>

      <Dialog description="현재 편집 중인 내용은 사라지고 서버에 저장된 메뉴로 바뀝니다." onClose={() => setReloadOpen(false)} open={reloadOpen} title="서버 데이터로 다시 불러올까요?">
        <div className="flex gap-3">
          <button className="brand-button-secondary flex-1 rounded-2xl px-4 py-3 text-sm font-bold" disabled={editor.saving} onClick={() => setReloadOpen(false)} type="button">현재 내용 유지</button>
          <button className="brand-button-danger-solid flex-1 rounded-2xl px-4 py-3 text-sm font-bold" disabled={editor.saving} onClick={() => { setReloadOpen(false); void editor.reload(); }} type="button">서버 데이터 불러오기</button>
        </div>
      </Dialog>

      {toasts.map((toast) => <Toast key={toast.id} message={toast.message} onClose={() => removeToast(toast.id)} type={toast.type} />)}
    </>
  );
}
