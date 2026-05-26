import type { FoodMenuCategorySaveItem } from "@/lib/food-ordering-data";

type BulkMenuOptionPayloadItem = {
  id?: number | null;
  label?: string;
  price?: number;
};

type BulkMenuPayloadItem = {
  id?: number | null;
  name?: string;
  price?: number;
  isActive?: boolean;
  optionGroupName?: string | null;
  options?: BulkMenuOptionPayloadItem[];
};

type BulkCategoryPayloadItem = {
  id?: number | null;
  name?: string;
  menus?: BulkMenuPayloadItem[];
};

export function normalizeCatalogPayload(body: unknown): FoodMenuCategorySaveItem[] {
  const categories = Array.isArray((body as { categories?: unknown })?.categories)
    ? ((body as { categories: BulkCategoryPayloadItem[] }).categories ?? [])
    : null;

  if (!categories || categories.length === 0) {
    throw new Error("최소 한 개 이상의 카테고리가 필요합니다.");
  }

  return categories.map((category, categoryIndex) => {
    const id = category?.id === null || category?.id === undefined ? null : Number(category.id);
    const name = typeof category?.name === "string" ? category.name.trim() : "";
    const menus = Array.isArray(category?.menus) ? category.menus : [];

    if (id !== null && !Number.isInteger(id)) {
      throw new Error("잘못된 카테고리가 포함되어 있습니다.");
    }
    if (!name) {
      throw new Error("카테고리 이름을 입력해 주세요.");
    }

    return {
      id,
      name,
      displayOrder: categoryIndex,
      menus: menus.map((menu, menuIndex) => {
        const menuId = menu?.id === null || menu?.id === undefined ? null : Number(menu.id);
        const menuName = typeof menu?.name === "string" ? menu.name.trim() : "";
        const price = Number(menu?.price);
        const isActive = menu?.isActive !== false;
        const optionGroupName =
          typeof menu?.optionGroupName === "string" ? menu.optionGroupName.trim() : "";
        const options = Array.isArray(menu?.options) ? menu.options : [];

        if (menuId !== null && !Number.isInteger(menuId)) {
          throw new Error("잘못된 메뉴가 포함되어 있습니다.");
        }
        if (!menuName) {
          throw new Error("메뉴 이름을 입력해 주세요.");
        }
        if (!Number.isInteger(price) || price < 0) {
          throw new Error("가격은 0 이상의 정수여야 합니다.");
        }

        const normalizedOptions = options.map((option, optionIndex) => {
          const optionId = option?.id === null || option?.id === undefined ? null : Number(option.id);
          const label = typeof option?.label === "string" ? option.label.trim() : "";
          const optionPrice = option?.price === undefined ? price : Number(option.price);

          if (optionId !== null && !Number.isInteger(optionId)) {
            throw new Error("잘못된 메뉴 옵션이 포함되어 있습니다.");
          }
          if (!label) {
            throw new Error("메뉴 옵션 선택지를 입력해 주세요.");
          }
          if (!Number.isInteger(optionPrice) || optionPrice < 0) {
            throw new Error("메뉴 옵션 가격은 0 이상의 정수여야 합니다.");
          }

          return {
            id: optionId,
            label,
            price: optionPrice,
            displayOrder: optionIndex,
          };
        });

        if (normalizedOptions.length > 0 && !optionGroupName) {
          throw new Error("메뉴 옵션명을 입력해 주세요.");
        }
        if (optionGroupName && normalizedOptions.length === 0) {
          throw new Error("메뉴 옵션 선택지를 한 개 이상 입력해 주세요.");
        }

        return {
          id: menuId,
          name: menuName,
          price,
          optionGroupName: optionGroupName || null,
          options: normalizedOptions,
          isActive,
          displayOrder: menuIndex,
        };
      }),
    };
  });
}
