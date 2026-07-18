"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MenuEditorActions } from "@/components/admin/FoodMenuEditorMenu";
import {
  catalogDraftFromResponse,
  catalogSummary,
  countCatalogChanges,
  createCatalogDraft,
  createCategoryDraft,
  searchCatalog,
  variantLabel,
  type CatalogDraft,
  type SearchFocus,
} from "@/lib/food-menu-editor";
import {
  addHotIceOptions,
  addMenu,
  addOption,
  removeCategory,
  removeMenu,
  removeOption,
  updateCategory,
  updateMenu,
  updateOption,
  type MenuLocation,
  type OptionLocation,
} from "@/lib/food-menu-editor-updates";
import {
  categoryToggleId,
  MENU_EDITOR_SEARCH_FIELD_ID,
  menuNameFieldIdFromKey,
  validateCatalog,
} from "@/lib/food-menu-editor-validation";
import type { AdminFoodMenuSettingsData } from "@/lib/food-ordering-data";

export type DeleteTarget =
  | { readonly kind: "category"; readonly key: string; readonly name: string; readonly menuCount: number; readonly variantCount: number }
  | { readonly kind: "menu"; readonly location: MenuLocation; readonly name: string; readonly optionCount: number }
  | { readonly kind: "option"; readonly location: OptionLocation; readonly label: string };

export type EditorFailure = {
  readonly operation: "save" | "reload";
  readonly message: string;
};

type AddToast = (message: string, type: "success" | "error") => void;

function errorMessage(value: unknown, fallback: string): string {
  if (typeof value !== "object" || value === null || !("error" in value)) return fallback;
  return typeof value.error === "string" && value.error.trim() ? value.error : fallback;
}

function firstExpanded(categories: CatalogDraft): ReadonlySet<string> {
  const firstKey = categories[0]?.key;
  return new Set(firstKey ? [firstKey] : []);
}

export function useFoodMenuEditor(
  initialData: AdminFoodMenuSettingsData,
  saveEndpoint: string,
  addToast: AddToast
) {
  const [saved, setSaved] = useState<CatalogDraft>(() => createCatalogDraft(initialData));
  const [categories, setCategories] = useState<CatalogDraft>(() => createCatalogDraft(initialData));
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => firstExpanded(createCatalogDraft(initialData)));
  const [query, setQuery] = useState("");
  const [searchFocus, setSearchFocus] = useState<SearchFocus | null>(null);
  const [saving, setSaving] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [invalidFieldId, setInvalidFieldId] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState("");
  const [failure, setFailure] = useState<EditorFailure | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const pendingDeleteFocusRef = useRef<string | null>(null);
  const blurFrameRef = useRef<number | null>(null);

  const results = useMemo(() => searchCatalog(categories, query, searchFocus), [categories, query, searchFocus]);
  const dirtyCount = useMemo(() => countCatalogChanges(saved, categories), [saved, categories]);
  const savedSummary = useMemo(() => catalogSummary(saved), [saved]);

  useEffect(() => {
    const focusId = pendingDeleteFocusRef.current;
    if (!focusId || deleteTarget !== null) return;
    pendingDeleteFocusRef.current = null;
    document.getElementById(focusId)?.focus();
  }, [categories, deleteTarget]);

  function change(update: (current: CatalogDraft) => CatalogDraft) {
    if (saving) return;
    setCategories(update);
    setInvalidFieldId(null);
    setValidationMessage("");
  }

  function toggleCategory(categoryKey: string) {
    if (saving) return;
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(categoryKey)) next.delete(categoryKey);
      else next.add(categoryKey);
      return next;
    });
  }

  function handleAddCategory() {
    if (saving) return;
    const category = createCategoryDraft();
    change((current) => [...current, category]);
    setExpanded((current) => new Set([...current, category.key]));
  }

  function requestMenuDelete(location: MenuLocation) {
    if (saving) return;
    const menu = categories.find((category) => category.key === location.categoryKey)
      ?.menus.find((candidate) => candidate.key === location.menuKey);
    if (!menu) return;
    setDeleteTarget({ kind: "menu", location, name: menu.name.trim() || "이름 없는 메뉴", optionCount: menu.options.length });
  }

  function requestOptionDelete(location: OptionLocation) {
    if (saving) return;
    const menu = categories.find((category) => category.key === location.categoryKey)
      ?.menus.find((candidate) => candidate.key === location.menuKey);
    const option = menu?.options.find((candidate) => candidate.key === location.optionKey);
    if (!menu || !option) return;
    const index = menu.options.findIndex((candidate) => candidate.key === option.key);
    setDeleteTarget({ kind: "option", location, label: variantLabel(menu, option, Math.max(0, index)) });
  }

  function requestCategoryDelete(categoryKey: string) {
    if (saving) return;
    const category = categories.find((candidate) => candidate.key === categoryKey);
    if (!category) return;
    setDeleteTarget({
      kind: "category",
      key: category.key,
      name: category.name.trim() || "이름 없는 카테고리",
      menuCount: category.menus.length,
      variantCount: category.menus.reduce((total, menu) => total + Math.max(1, menu.options.length), 0),
    });
  }

  function confirmDelete() {
    if (!deleteTarget || saving) return;
    if (deleteTarget.kind === "category") {
      pendingDeleteFocusRef.current = MENU_EDITOR_SEARCH_FIELD_ID;
      setSearchFocus(null);
      change((current) => removeCategory(current, deleteTarget.key));
    }
    if (deleteTarget.kind === "menu") {
      pendingDeleteFocusRef.current = categoryToggleId(deleteTarget.location.categoryKey);
      setSearchFocus({ kind: "category", key: deleteTarget.location.categoryKey });
      change((current) => removeMenu(current, deleteTarget.location));
    }
    if (deleteTarget.kind === "option") {
      pendingDeleteFocusRef.current = menuNameFieldIdFromKey(deleteTarget.location.menuKey);
      setSearchFocus({ kind: "menu", key: deleteTarget.location.menuKey });
      change((current) => removeOption(current, deleteTarget.location));
    }
    setDeleteTarget(null);
  }

  const menuActions: MenuEditorActions = {
    changeMenu: (location, patch) => change((current) => updateMenu(current, location, patch)),
    changeOption: (location, patch) => change((current) => updateOption(current, location, patch)),
    addOption: (location) => change((current) => addOption(current, location)),
    addHotIce: (location) => change((current) => addHotIceOptions(current, location)),
    requestMenuDelete,
    requestOptionDelete,
  };

  async function save() {
    if (saving) return;
    const validation = validateCatalog(categories);
    if (!validation.valid) {
      setFailure(null);
      setInvalidFieldId(validation.fieldId);
      setValidationMessage(validation.message);
      const categoryKey = validation.categoryKey;
      if (categoryKey) setExpanded((current) => new Set([...current, categoryKey]));
      if (validation.fieldId) requestAnimationFrame(() => document.getElementById(validation.fieldId ?? "")?.focus());
      return;
    }
    setSaving(true);
    setFailure(null);
    try {
      const response = await fetch(saveEndpoint, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(validation.payload) });
      const body: unknown = await response.json();
      if (!response.ok) {
        setFailure({ operation: "save", message: errorMessage(body, "메뉴를 저장하지 못했습니다.") });
        return;
      }
      const next = catalogDraftFromResponse(body);
      if (!next) {
        setFailure({ operation: "save", message: "저장 응답을 확인하지 못했습니다. 다시 시도해 주세요." });
        return;
      }
      setCategories(next);
      setSaved(next);
      setExpanded(firstExpanded(next));
      setInvalidFieldId(null);
      setValidationMessage("");
      addToast("카테고리와 메뉴를 저장했습니다.", "success");
    } catch (error) {
      setFailure({ operation: "save", message: error instanceof Error ? error.message : "메뉴를 저장하지 못했습니다." });
    } finally {
      setSaving(false);
    }
  }

  async function reload() {
    if (saving) return;
    setReloading(true);
    setFailure(null);
    try {
      const response = await fetch(saveEndpoint, { method: "GET" });
      const body: unknown = await response.json();
      if (!response.ok) {
        setFailure({ operation: "reload", message: errorMessage(body, "서버 데이터를 불러오지 못했습니다.") });
        return;
      }
      const next = catalogDraftFromResponse(body);
      if (!next) {
        setFailure({ operation: "reload", message: "서버 데이터 형식을 확인하지 못했습니다." });
        return;
      }
      setCategories(next);
      setSaved(next);
      setExpanded(firstExpanded(next));
      setInvalidFieldId(null);
      setValidationMessage("");
      addToast("서버의 최신 메뉴를 불러왔습니다.", "success");
    } catch (error) {
      setFailure({ operation: "reload", message: error instanceof Error ? error.message : "서버 데이터를 불러오지 못했습니다." });
    } finally {
      setReloading(false);
    }
  }

  function discard() {
    if (saving) return;
    setCategories(saved);
    setExpanded(firstExpanded(saved));
    setInvalidFieldId(null);
    setValidationMessage("");
    setFailure(null);
  }

  return {
    results, categoryCount: categories.length, query, expanded, toggleCategory, dirtyCount, savedSummary, saving, reloading,
    invalidFieldId, validationMessage, failure, deleteTarget, setDeleteTarget, menuActions,
    handleAddCategory, requestCategoryDelete, confirmDelete, save, reload, discard,
    setQuery: (value: string) => {
      if (saving) return;
      setSearchFocus(null);
      setQuery(value);
    },
    focusSearchResult: (focus: SearchFocus) => {
      if (blurFrameRef.current !== null) cancelAnimationFrame(blurFrameRef.current);
      blurFrameRef.current = null;
      setSearchFocus(focus);
    },
    blurSearchResult: () => {
      if (blurFrameRef.current !== null) cancelAnimationFrame(blurFrameRef.current);
      blurFrameRef.current = requestAnimationFrame(() => { blurFrameRef.current = null; setSearchFocus(null); });
    },
    changeCategory: (categoryKey: string, name: string) => change((current) => updateCategory(current, categoryKey, { name })),
    addMenu: (categoryKey: string) => change((current) => addMenu(current, categoryKey)),
  };
}
