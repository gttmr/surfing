import type {
  ParticipantFoodOrderData,
  ParticipantFoodOrderItemData,
  ParticipantMeetingFoodOrdersData,
} from "@/lib/food-ordering-data";

export type OrderDraft = Readonly<Record<string, number>>;

export type OrderMenuVariant = {
  readonly key: string;
  readonly categoryName: string;
  readonly menuId: number;
  readonly optionChoiceId: number | null;
  readonly menuName: string;
  readonly optionLabel: string | null;
  readonly label: string;
  readonly price: number;
  readonly searchText: string;
};

export type SelectedOrderLine = OrderMenuVariant & {
  readonly quantity: number;
  readonly total: number;
};

export type OrderPresentation = {
  readonly tone: "received" | "preparing" | "served" | "cancelled" | "mixed";
  readonly label: string;
  readonly editable: boolean;
  readonly lockedReason: string | null;
};

export type OrderItemPresentation = {
  readonly tone: "received" | "preparing" | "served" | "cancelled";
  readonly label: string;
};

function normalizeSearch(value: string): string {
  return value.trim().toLocaleLowerCase("ko-KR").replace(/\s+/g, " ");
}

export function buildOrderMenuVariants(
  menus: ParticipantMeetingFoodOrdersData["menus"],
): OrderMenuVariant[] {
  return menus.flatMap((menu): OrderMenuVariant[] => {
    if (menu.options.length === 0) {
      return [{
        key: `${menu.id}:none`,
        categoryName: menu.categoryName,
        menuId: menu.id,
        optionChoiceId: null,
        menuName: menu.name,
        optionLabel: null,
        label: menu.name,
        price: menu.price,
        searchText: normalizeSearch(`${menu.categoryName} ${menu.name}`),
      }];
    }
    return menu.options.map((option) => ({
      key: `${menu.id}:${option.id}`,
      categoryName: menu.categoryName,
      menuId: menu.id,
      optionChoiceId: option.id,
      menuName: menu.name,
      optionLabel: option.label,
      label: `${menu.name} · ${option.label}`,
      price: option.price,
      searchText: normalizeSearch(
        `${menu.categoryName} ${menu.name} ${menu.optionGroupName ?? ""} ${option.label}`,
      ),
    }));
  });
}

export function filterOrderMenuVariants(
  variants: readonly OrderMenuVariant[],
  query: string,
  selectedOnly: boolean,
  draft: OrderDraft,
): OrderMenuVariant[] {
  const terms = normalizeSearch(query).split(" ").filter(Boolean);
  return variants.filter((variant) => {
    if (selectedOnly && (draft[variant.key] ?? 0) <= 0) return false;
    return terms.every((term) => variant.searchText.includes(term));
  });
}

export function prefillOrderDraft(
  variants: readonly OrderMenuVariant[],
  order: ParticipantFoodOrderData,
): Record<string, number> {
  const available = new Set(variants.map((variant) => variant.key));
  const draft: Record<string, number> = {};
  for (const item of order.items) {
    if (item.cancelledAt) continue;
    const key = `${item.menuItemId ?? "missing"}:${item.menuOptionChoiceId ?? "none"}`;
    if (!available.has(key)) continue;
    draft[key] = (draft[key] ?? 0) + item.quantity;
  }
  return draft;
}

export function selectedOrderLines(
  variants: readonly OrderMenuVariant[],
  draft: OrderDraft,
): SelectedOrderLine[] {
  return variants.flatMap((variant) => {
    const quantity = draft[variant.key] ?? 0;
    return quantity > 0 ? [{ ...variant, quantity, total: variant.price * quantity }] : [];
  });
}

export function getOrderCartSummary(
  lines: readonly SelectedOrderLine[],
  supportCap: number,
  existingSubtotal: number,
) {
  const totalQuantity = lines.reduce((total, line) => total + line.quantity, 0);
  const subtotal = lines.reduce((total, line) => total + line.total, 0);
  const supportRemaining = Math.max(0, supportCap - existingSubtotal);
  const supportApplied = Math.min(subtotal, supportRemaining);
  return {
    totalQuantity,
    subtotal,
    supportRemaining,
    supportApplied,
    billableAmount: subtotal - supportApplied,
  };
}

export function getParticipantOrderSubtotal(
  orders: readonly ParticipantFoodOrderData[],
  excludedOrderId: number | null = null,
): number {
  return orders.reduce((total, order) => {
    if (order.orderId === excludedOrderId) return total;
    return total + order.items.reduce(
      (itemTotal, item) => itemTotal + (item.cancelledAt ? 0 : item.unitPriceSnapshot * item.quantity),
      0,
    );
  }, 0);
}

export function getOrderPresentation(order: ParticipantFoodOrderData): OrderPresentation {
  if (order.items.length === 0) {
    return { tone: "mixed", label: "확인 필요", editable: false, lockedReason: "주문 항목이 없어 수정할 수 없습니다." };
  }
  const cancelledCount = order.items.filter((item) => item.cancelledAt).length;
  if (cancelledCount === order.items.length) {
    return {
      tone: "cancelled",
      label: "취소됨",
      editable: false,
      lockedReason: order.items.find((item) => item.cancelledReasonText)?.cancelledReasonText ?? "이미 취소된 주문입니다.",
    };
  }
  if (cancelledCount > 0) {
    return { tone: "mixed", label: "일부 취소", editable: false, lockedReason: "일부 항목이 취소되어 수정할 수 없습니다." };
  }

  const hasServed = order.items.some((item) => item.servedQuantity > 0);
  if (hasServed) {
    const complete = order.items.every((item) => item.servedQuantity >= item.quantity);
    return {
      tone: "served",
      label: complete ? "제공 완료" : "제공 중",
      editable: false,
      lockedReason: complete ? "제공이 완료되어 수정할 수 없습니다." : "제공이 시작되어 수정할 수 없습니다.",
    };
  }
  if (order.items.some((item) => item.preparingQuantity > 0)) {
    return { tone: "preparing", label: "준비 중", editable: false, lockedReason: "준비가 시작되어 수정할 수 없습니다." };
  }
  return { tone: "received", label: "접수됨", editable: true, lockedReason: null };
}

export function getOrderItemPresentation(item: ParticipantFoodOrderItemData): OrderItemPresentation {
  if (item.cancelledAt) return { tone: "cancelled", label: "취소" };
  if (item.servedQuantity >= item.quantity) return { tone: "served", label: "제공 완료" };
  if (item.servedQuantity > 0) return { tone: "served", label: `${item.servedQuantity}/${item.quantity} 제공` };
  if (item.preparingQuantity > 0) return { tone: "preparing", label: "준비 중" };
  return { tone: "received", label: "접수" };
}

export function formatOrderTime(value: string): string {
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(value));
}

export function expectedItemsForOrder(order: ParticipantFoodOrderData) {
  return order.items.map((item) => ({ id: item.id, updatedAt: item.updatedAt }));
}
