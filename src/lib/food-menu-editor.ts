import type { AdminFoodMenuSettingsData } from "@/lib/food-ordering-data";

export const DEFAULT_OPTION_GROUP_NAME = "옵션";
export const HOT_ICE_OPTION_LABELS = ["ICE", "HOT"] as const;

export type MenuOptionDraft = {
  readonly id: number | null;
  readonly key: string;
  readonly menuKey: string;
  readonly label: string;
  readonly price: string;
};

export type MenuDraft = {
  readonly id: number | null;
  readonly key: string;
  readonly categoryKey: string;
  readonly name: string;
  readonly price: string;
  readonly optionGroupName: string;
  readonly options: readonly MenuOptionDraft[];
  readonly isActive: boolean;
};

export type CategoryDraft = {
  readonly id: number | null;
  readonly key: string;
  readonly name: string;
  readonly menus: readonly MenuDraft[];
};

export type CatalogDraft = readonly CategoryDraft[];

export type CatalogSummary = {
  readonly categoryCount: number;
  readonly menuCount: number;
  readonly activeMenuCount: number;
  readonly activeVariantCount: number;
};

export type MenuSearchResult = {
  readonly menu: MenuDraft;
  readonly options: readonly MenuOptionDraft[];
};

export type CategorySearchResult = {
  readonly category: CategoryDraft;
  readonly menus: readonly MenuSearchResult[];
  readonly variantCount: number;
};

export type SearchFocus = {
  readonly kind: "category" | "menu" | "option";
  readonly key: string;
};

let draftSequence = 0;

function nextDraftKey(kind: "category" | "menu" | "option"): string {
  draftSequence += 1;
  return `new-${kind}-${draftSequence}`;
}

function menuDraft(
  source: AdminFoodMenuSettingsData["categories"][number]["menus"][number],
  categoryKey: string
): MenuDraft {
  const key = `menu-${source.id}`;
  return {
    id: source.id,
    key,
    categoryKey,
    name: source.name,
    price: String(source.price),
    optionGroupName:
      source.optionGroupName ?? (source.options.length > 0 ? DEFAULT_OPTION_GROUP_NAME : ""),
    options: source.options.map((option) => ({
      id: option.id,
      key: `option-${option.id}`,
      menuKey: key,
      label: option.label,
      price: String(option.price),
    })),
    isActive: source.isActive ?? true,
  };
}

export function createCatalogDraft(initialData: AdminFoodMenuSettingsData): CatalogDraft {
  return initialData.categories.map((category) => {
    const key = `category-${category.id}`;
    return {
      id: category.id,
      key,
      name: category.name,
      menus: category.menus.map((menu) => menuDraft(menu, key)),
    };
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isOptionSource(
  value: unknown
): value is AdminFoodMenuSettingsData["categories"][number]["menus"][number]["options"][number] {
  return isRecord(value)
    && Number.isInteger(value.id)
    && typeof value.label === "string"
    && Number.isFinite(value.price)
    && Number.isFinite(value.displayOrder);
}

function isMenuSource(
  value: unknown
): value is AdminFoodMenuSettingsData["categories"][number]["menus"][number] {
  return isRecord(value)
    && Number.isInteger(value.id)
    && (value.categoryId === null || Number.isInteger(value.categoryId))
    && typeof value.categoryName === "string"
    && Number.isFinite(value.categoryDisplayOrder)
    && typeof value.name === "string"
    && Number.isFinite(value.price)
    && (value.optionGroupName === null || typeof value.optionGroupName === "string")
    && Array.isArray(value.options)
    && value.options.every(isOptionSource)
    && typeof value.isActive === "boolean"
    && Number.isFinite(value.displayOrder);
}

function isCategorySource(
  value: unknown
): value is AdminFoodMenuSettingsData["categories"][number] {
  return isRecord(value)
    && Number.isInteger(value.id)
    && typeof value.name === "string"
    && Number.isFinite(value.displayOrder)
    && Array.isArray(value.menus)
    && value.menus.every(isMenuSource);
}

export function catalogDraftFromResponse(value: unknown): CatalogDraft | null {
  if (!isRecord(value) || !Array.isArray(value.categories) || !value.categories.every(isCategorySource)) {
    return null;
  }
  return createCatalogDraft({ categories: value.categories });
}

export function createCategoryDraft(): CategoryDraft {
  return { id: null, key: nextDraftKey("category"), name: "", menus: [] };
}

export function createMenuDraft(categoryKey: string): MenuDraft {
  return {
    id: null,
    key: nextDraftKey("menu"),
    categoryKey,
    name: "",
    price: "",
    optionGroupName: "",
    options: [],
    isActive: true,
  };
}

export function createOptionDraft(menu: MenuDraft, label = ""): MenuOptionDraft {
  return {
    id: null,
    key: nextDraftKey("option"),
    menuKey: menu.key,
    label,
    price: menu.price,
  };
}

export function variantLabel(menu: MenuDraft, option: MenuOptionDraft, index: number): string {
  const menuName = menu.name.trim() || "이름 없는 메뉴";
  const optionName = option.label.trim() || `새 옵션 ${index + 1}`;
  return `${menuName} · ${optionName}`;
}

export function catalogSummary(categories: CatalogDraft): CatalogSummary {
  const menus = categories.flatMap((category) => category.menus);
  const activeMenus = menus.filter((menu) => menu.isActive);
  return {
    categoryCount: categories.length,
    menuCount: menus.length,
    activeMenuCount: activeMenus.length,
    activeVariantCount: activeMenus.reduce(
      (total, menu) => total + Math.max(1, menu.options.length),
      0
    ),
  };
}

function unitMap(categories: CatalogDraft): ReadonlyMap<string, string> {
  const units = new Map<string, string>();
  for (const category of categories) {
    units.set(category.key, JSON.stringify([category.id, category.name]));
    for (const menu of category.menus) {
      units.set(
        menu.key,
        JSON.stringify([
          menu.id,
          menu.categoryKey,
          menu.name,
          menu.price,
          menu.optionGroupName,
          menu.isActive,
        ])
      );
      for (const option of menu.options) {
        units.set(
          option.key,
          JSON.stringify([option.id, option.menuKey, option.label, option.price])
        );
      }
    }
  }
  return units;
}

export function countCatalogChanges(saved: CatalogDraft, current: CatalogDraft): number {
  const savedUnits = unitMap(saved);
  const currentUnits = unitMap(current);
  const keys = new Set([...savedUnits.keys(), ...currentUnits.keys()]);
  return Array.from(keys).filter((key) => savedUnits.get(key) !== currentUnits.get(key)).length;
}

export function searchCatalog(
  categories: CatalogDraft,
  rawQuery: string,
  focus: SearchFocus | null = null
): readonly CategorySearchResult[] {
  const query = rawQuery.trim().toLocaleLowerCase("ko-KR");
  return categories.flatMap((category) => {
    const categoryMatches = category.name.toLocaleLowerCase("ko-KR").includes(query);
    const categoryFocused = focus?.kind === "category" && focus.key === category.key;
    const menus = category.menus.flatMap((menu) => {
      const menuMatches = menu.name.toLocaleLowerCase("ko-KR").includes(query);
      const menuFocused = focus?.kind === "menu" && focus.key === menu.key;
      const options = query && !categoryMatches && !menuMatches
        ? menu.options.filter((option) =>
            variantLabel(menu, option, 0).toLocaleLowerCase("ko-KR").includes(query)
            || (focus?.kind === "option" && focus.key === option.key)
          )
        : menu.options;
      if (query && !categoryMatches && !menuMatches && !menuFocused && options.length === 0) return [];
      return [{ menu, options }];
    });
    if (query && !categoryMatches && !categoryFocused && menus.length === 0) return [];
    return [{
      category,
      menus,
      variantCount: menus.reduce((total, result) => total + Math.max(1, result.options.length), 0),
    }];
  });
}
