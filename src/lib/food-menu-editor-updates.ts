import {
  DEFAULT_OPTION_GROUP_NAME,
  HOT_ICE_OPTION_LABELS,
  createMenuDraft,
  createOptionDraft,
  type CatalogDraft,
  type CategoryDraft,
  type MenuDraft,
  type MenuOptionDraft,
} from "@/lib/food-menu-editor";

export type MenuLocation = {
  readonly categoryKey: string;
  readonly menuKey: string;
};

export type OptionLocation = MenuLocation & {
  readonly optionKey: string;
};

export function updateCategory(
  categories: CatalogDraft,
  categoryKey: string,
  patch: Partial<CategoryDraft>
): CatalogDraft {
  return categories.map((category) =>
    category.key === categoryKey ? { ...category, ...patch } : category
  );
}

export function updateMenu(
  categories: CatalogDraft,
  location: MenuLocation,
  patch: Partial<MenuDraft>
): CatalogDraft {
  return categories.map((category) =>
    category.key === location.categoryKey
      ? {
          ...category,
          menus: category.menus.map((menu) =>
            menu.key === location.menuKey ? { ...menu, ...patch } : menu
          ),
        }
      : category
  );
}

export function updateOption(
  categories: CatalogDraft,
  location: OptionLocation,
  patch: Partial<MenuOptionDraft>
): CatalogDraft {
  return categories.map((category) =>
    category.key === location.categoryKey
      ? {
          ...category,
          menus: category.menus.map((menu) =>
            menu.key === location.menuKey
              ? {
                  ...menu,
                  options: menu.options.map((option) =>
                    option.key === location.optionKey ? { ...option, ...patch } : option
                  ),
                }
              : menu
          ),
        }
      : category
  );
}

export function addMenu(categories: CatalogDraft, categoryKey: string): CatalogDraft {
  return categories.map((category) =>
    category.key === categoryKey
      ? { ...category, menus: [...category.menus, createMenuDraft(category.key)] }
      : category
  );
}

export function removeCategory(categories: CatalogDraft, categoryKey: string): CatalogDraft {
  return categories.filter((category) => category.key !== categoryKey);
}

export function removeMenu(categories: CatalogDraft, location: MenuLocation): CatalogDraft {
  return categories.map((category) =>
    category.key === location.categoryKey
      ? { ...category, menus: category.menus.filter((menu) => menu.key !== location.menuKey) }
      : category
  );
}

export function addOption(categories: CatalogDraft, location: MenuLocation): CatalogDraft {
  return categories.map((category) =>
    category.key === location.categoryKey
      ? {
          ...category,
          menus: category.menus.map((menu) =>
            menu.key === location.menuKey
              ? {
                  ...menu,
                  optionGroupName: menu.optionGroupName || DEFAULT_OPTION_GROUP_NAME,
                  options: [...menu.options, createOptionDraft(menu)],
                }
              : menu
          ),
        }
      : category
  );
}

export function addHotIceOptions(categories: CatalogDraft, location: MenuLocation): CatalogDraft {
  return categories.map((category) =>
    category.key === location.categoryKey
      ? {
          ...category,
          menus: category.menus.map((menu) => {
            if (menu.key !== location.menuKey) return menu;
            const existing = new Set(menu.options.map((option) => option.label.trim().toUpperCase()));
            const additions = HOT_ICE_OPTION_LABELS
              .filter((label) => !existing.has(label))
              .map((label) => createOptionDraft(menu, label));
            return {
              ...menu,
              optionGroupName: menu.optionGroupName || DEFAULT_OPTION_GROUP_NAME,
              options: [...menu.options, ...additions],
            };
          }),
        }
      : category
  );
}

export function removeOption(categories: CatalogDraft, location: OptionLocation): CatalogDraft {
  return categories.map((category) =>
    category.key === location.categoryKey
      ? {
          ...category,
          menus: category.menus.map((menu) => {
            if (menu.key !== location.menuKey) return menu;
            const options = menu.options.filter((option) => option.key !== location.optionKey);
            return { ...menu, optionGroupName: options.length === 0 ? "" : menu.optionGroupName, options };
          }),
        }
      : category
  );
}
