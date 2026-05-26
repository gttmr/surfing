import type { ParticipantFoodOrderItem } from "@prisma/client";
import { getTodayInSeoul } from "@/lib/date";

export const UNCATEGORIZED_MENU_NAME = "미분류";
export const UNCATEGORIZED_MENU_ORDER = Number.MAX_SAFE_INTEGER;

export type FoodMenuCategoryCatalogItem = {
  id: number;
  name: string;
  displayOrder: number;
};

export type FoodMenuCatalogItem = {
  id: number;
  categoryId: number | null;
  categoryName: string;
  categoryDisplayOrder: number;
  name: string;
  price: number;
  optionGroupName: string | null;
  options: FoodMenuOptionChoiceCatalogItem[];
  isActive: boolean;
  displayOrder: number;
};

export type FoodMenuOptionChoiceCatalogItem = {
  id: number;
  label: string;
  displayOrder: number;
};

export type FoodOrderItemSnapshot = Pick<
  ParticipantFoodOrderItem,
  | "id"
  | "participantId"
  | "menuItemId"
  | "menuOptionChoiceId"
  | "menuNameSnapshot"
  | "optionGroupNameSnapshot"
  | "optionChoiceLabelSnapshot"
  | "unitPriceSnapshot"
  | "quantity"
  | "preparingQuantity"
  | "servedQuantity"
>;

export type FoodOrderSummary = {
  subtotal: number;
  supportApplied: number;
  billableAmount: number;
  totalQuantity: number;
  preparingQuantity: number;
  servedQuantity: number;
  remainingQuantity: number;
};

export function parseAmount(value: string | undefined) {
  const digits = (value ?? "").replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

export function sortFoodMenus<T extends { displayOrder: number; name: string }>(menus: T[]) {
  return [...menus].sort((a, b) => {
    const aCategoryOrder =
      "categoryDisplayOrder" in a && typeof a.categoryDisplayOrder === "number"
        ? a.categoryDisplayOrder
        : UNCATEGORIZED_MENU_ORDER;
    const bCategoryOrder =
      "categoryDisplayOrder" in b && typeof b.categoryDisplayOrder === "number"
        ? b.categoryDisplayOrder
        : UNCATEGORIZED_MENU_ORDER;

    if (aCategoryOrder !== bCategoryOrder) {
      return aCategoryOrder - bCategoryOrder;
    }

    const aCategoryName =
      "categoryName" in a && typeof a.categoryName === "string" ? a.categoryName : UNCATEGORIZED_MENU_NAME;
    const bCategoryName =
      "categoryName" in b && typeof b.categoryName === "string" ? b.categoryName : UNCATEGORIZED_MENU_NAME;

    const categoryCompare = aCategoryName.localeCompare(bCategoryName, "ko-KR");
    if (categoryCompare !== 0) {
      return categoryCompare;
    }

    if (a.displayOrder !== b.displayOrder) {
      return a.displayOrder - b.displayOrder;
    }
    return a.name.localeCompare(b.name, "ko-KR");
  });
}

export function sortFoodMenuCategories<T extends { displayOrder: number; name: string }>(categories: T[]) {
  return [...categories].sort((a, b) => {
    if (a.displayOrder !== b.displayOrder) {
      return a.displayOrder - b.displayOrder;
    }
    return a.name.localeCompare(b.name, "ko-KR");
  });
}

export function isFoodOrderLocked(items: Array<Pick<FoodOrderItemSnapshot, "preparingQuantity" | "servedQuantity">>) {
  return items.some((item) => item.preparingQuantity > 0 || item.servedQuantity > 0);
}

export function isMeetingOrderOpen(meetingDate: string, today = getTodayInSeoul()) {
  return meetingDate === today;
}

export function getFoodOrderSummary(items: FoodOrderItemSnapshot[], supportCap: number): FoodOrderSummary {
  const subtotal = items.reduce((sum, item) => sum + item.unitPriceSnapshot * item.quantity, 0);
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const preparingQuantity = items.reduce((sum, item) => sum + item.preparingQuantity, 0);
  const servedQuantity = items.reduce((sum, item) => sum + item.servedQuantity, 0);
  const supportApplied = Math.min(subtotal, Math.max(supportCap, 0));

  return {
    subtotal,
    supportApplied,
    billableAmount: subtotal - supportApplied,
    totalQuantity,
    preparingQuantity,
    servedQuantity,
    remainingQuantity: Math.max(totalQuantity - servedQuantity, 0),
  };
}

export function getFoodOrderItemDisplayName(
  item: Pick<FoodOrderItemSnapshot, "menuNameSnapshot" | "optionChoiceLabelSnapshot">
) {
  return item.optionChoiceLabelSnapshot ? `${item.menuNameSnapshot} · ${item.optionChoiceLabelSnapshot}` : item.menuNameSnapshot;
}

export function normalizeFoodOrderPayload(
  items: Array<{ menuItemId: number; optionChoiceId?: number | null; quantity: number }>,
  menus: FoodMenuCatalogItem[]
) {
  const menuMap = new Map(menus.map((menu) => [menu.id, menu]));
  const deduped = new Map<string, { menuItemId: number; optionChoiceId: number | null; quantity: number }>();

  for (const item of items) {
    const menuItemId = Number(item.menuItemId);
    const quantity = Number(item.quantity);
    const optionChoiceId =
      item.optionChoiceId === null || item.optionChoiceId === undefined ? null : Number(item.optionChoiceId);
    const menu = menuMap.get(menuItemId);

    if (!Number.isInteger(menuItemId) || !menu) {
      continue;
    }
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new Error("수량은 0 이상의 정수여야 합니다.");
    }
    if (optionChoiceId !== null && !Number.isInteger(optionChoiceId)) {
      throw new Error("잘못된 메뉴 옵션이 포함되어 있습니다.");
    }

    const hasOptions = menu.options.length > 0;
    if (hasOptions && optionChoiceId === null) {
      if (quantity > 0) {
        throw new Error("옵션이 있는 메뉴는 선택지를 골라 주세요.");
      }
      continue;
    }

    if (!hasOptions && optionChoiceId !== null) {
      if (quantity > 0) {
        throw new Error("옵션이 없는 메뉴에 잘못된 선택지가 포함되어 있습니다.");
      }
      continue;
    }

    if (optionChoiceId !== null && !menu.options.some((option) => option.id === optionChoiceId)) {
      if (quantity > 0) {
        throw new Error("판매 중인 메뉴 옵션만 주문할 수 있습니다.");
      }
      continue;
    }

    deduped.set(`${menuItemId}:${optionChoiceId ?? "none"}`, {
      menuItemId,
      optionChoiceId,
      quantity,
    });
  }

  return Array.from(deduped.values());
}
