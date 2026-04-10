import type { ParticipantFoodOrderItem } from "@prisma/client";
import { getTodayInSeoul } from "@/lib/date";

export type FoodMenuCatalogItem = {
  id: number;
  name: string;
  price: number;
  isActive: boolean;
  displayOrder: number;
};

export type FoodOrderItemSnapshot = Pick<
  ParticipantFoodOrderItem,
  | "id"
  | "participantId"
  | "menuItemId"
  | "menuNameSnapshot"
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

export function normalizeFoodOrderPayload(
  items: Array<{ menuItemId: number; quantity: number }>,
  allowedMenuIds: Set<number>
) {
  const deduped = new Map<number, number>();

  for (const item of items) {
    const menuItemId = Number(item.menuItemId);
    const quantity = Number(item.quantity);

    if (!Number.isInteger(menuItemId) || !allowedMenuIds.has(menuItemId)) {
      continue;
    }
    if (!Number.isInteger(quantity) || quantity < 0) {
      throw new Error("수량은 0 이상의 정수여야 합니다.");
    }

    deduped.set(menuItemId, quantity);
  }

  return Array.from(deduped.entries()).map(([menuItemId, quantity]) => ({
    menuItemId,
    quantity,
  }));
}
