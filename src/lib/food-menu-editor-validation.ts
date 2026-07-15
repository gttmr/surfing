import {
  DEFAULT_OPTION_GROUP_NAME,
  type CatalogDraft,
  type CategoryDraft,
  type MenuDraft,
  type MenuOptionDraft,
} from "@/lib/food-menu-editor";

export type CatalogSavePayload = {
  readonly categories: readonly {
    readonly id: number | null;
    readonly name: string;
    readonly menus: readonly {
      readonly id: number | null;
      readonly name: string;
      readonly price: number;
      readonly optionGroupName: string | null;
      readonly options: readonly {
        readonly id: number | null;
        readonly label: string;
        readonly price: number;
      }[];
      readonly isActive: boolean;
    }[];
  }[];
};

export type CatalogValidation =
  | { readonly valid: true; readonly payload: CatalogSavePayload }
  | { readonly valid: false; readonly categoryKey: string | null; readonly fieldId: string | null; readonly message: string };

export const MENU_EDITOR_SEARCH_FIELD_ID = "menu-editor-search";

export function categoryToggleId(categoryKey: string): string {
  return `category-toggle-${categoryKey}`;
}

export function categoryNameFieldId(category: CategoryDraft): string {
  return `category-name-${category.key}`;
}

export function menuNameFieldId(menu: MenuDraft): string {
  return menuNameFieldIdFromKey(menu.key);
}

export function menuNameFieldIdFromKey(menuKey: string): string {
  return `menu-name-${menuKey}`;
}

export function menuPriceFieldId(menu: MenuDraft): string {
  return `menu-price-${menu.key}`;
}

export function optionGroupFieldId(menu: MenuDraft): string {
  return `option-group-${menu.key}`;
}

export function optionLabelFieldId(option: MenuOptionDraft): string {
  return `option-label-${option.key}`;
}

export function optionPriceFieldId(option: MenuOptionDraft): string {
  return `option-price-${option.key}`;
}

function parsePrice(value: string): number | null {
  const normalized = value.trim();
  if (!/^\d+$/.test(normalized)) return null;
  const price = Number(normalized);
  return Number.isSafeInteger(price) && price >= 0 ? price : null;
}

export function validateCatalog(categories: CatalogDraft): CatalogValidation {
  if (categories.length === 0) {
    return { valid: false, categoryKey: null, fieldId: null, message: "최소 한 개 이상의 카테고리를 남겨 주세요." };
  }

  for (const category of categories) {
    if (!category.name.trim()) {
      return { valid: false, categoryKey: category.key, fieldId: categoryNameFieldId(category), message: "카테고리 이름을 입력해 주세요." };
    }
    for (const menu of category.menus) {
      if (menu.categoryKey !== category.key) {
        return { valid: false, categoryKey: category.key, fieldId: menuNameFieldId(menu), message: "메뉴의 카테고리 연결을 확인해 주세요." };
      }
      if (!menu.name.trim()) {
        return { valid: false, categoryKey: category.key, fieldId: menuNameFieldId(menu), message: "메뉴 이름을 입력해 주세요." };
      }
      if (menu.options.length === 0 && parsePrice(menu.price) === null) {
        return { valid: false, categoryKey: category.key, fieldId: menuPriceFieldId(menu), message: "가격은 0 이상의 정수로 입력해 주세요." };
      }
      if (menu.options.length > 0 && !menu.optionGroupName.trim()) {
        return { valid: false, categoryKey: category.key, fieldId: optionGroupFieldId(menu), message: "옵션 이름을 입력해 주세요." };
      }
      for (const option of menu.options) {
        if (option.menuKey !== menu.key) {
          return { valid: false, categoryKey: category.key, fieldId: optionLabelFieldId(option), message: "옵션의 메뉴 연결을 확인해 주세요." };
        }
        if (!option.label.trim()) {
          return { valid: false, categoryKey: category.key, fieldId: optionLabelFieldId(option), message: "옵션 선택지 이름을 입력해 주세요." };
        }
        if (parsePrice(option.price) === null) {
          return { valid: false, categoryKey: category.key, fieldId: optionPriceFieldId(option), message: "옵션 가격은 0 이상의 정수로 입력해 주세요." };
        }
      }
    }
  }

  return {
    valid: true,
    payload: {
      categories: categories.map((category) => ({
        id: category.id,
        name: category.name.trim(),
        menus: category.menus.map((menu) => ({
          id: menu.id,
          name: menu.name.trim(),
          price: menu.options.length === 0
            ? parsePrice(menu.price) ?? 0
            : parsePrice(menu.options[0]?.price ?? "") ?? 0,
          optionGroupName: menu.options.length > 0
            ? menu.optionGroupName.trim() || DEFAULT_OPTION_GROUP_NAME
            : null,
          options: menu.options.map((option) => ({
            id: option.id,
            label: option.label.trim(),
            price: parsePrice(option.price) ?? 0,
          })),
          isActive: menu.isActive,
        })),
      })),
    },
  };
}
