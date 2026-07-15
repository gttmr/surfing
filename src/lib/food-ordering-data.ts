import { prisma } from "@/lib/db";
import { getTodayInSeoul } from "@/lib/date";
import {
  canCancelFoodOrderItems,
  getActiveFoodOrderItems,
  getCancelledFoodOrderItems,
  getFoodOrderItemDisplayName,
  getFoodOrderParticipantAccess,
  isMeetingOrderOpen,
  parseAmount,
  sortFoodMenuCategories,
  sortFoodMenus,
  type FoodMenuCategoryCatalogItem,
  type FoodMenuCatalogItem,
} from "@/lib/food-ordering";
import {
  DEFAULT_FOOD_ORDER_SUPPORT_CAP,
  FOOD_ORDER_SUPPORT_CAP_KEY,
} from "@/lib/settings";
import { getShopMeetingSurfUsageData, type ShopMeetingSurfUsageData } from "@/lib/surf-usage-data";

type MenuSelectShape = {
  id: number;
  categoryId: number | null;
  categoryName: string;
  categoryDisplayOrder: number;
  name: string;
  price: number;
  optionGroupName: string | null;
  options: Array<{ id: number; label: string; price: number | null; displayOrder: number }>;
  isActive: boolean;
  displayOrder: number;
};

function mapMenu(menu: MenuSelectShape): FoodMenuCatalogItem {
  return {
    id: menu.id,
    categoryId: menu.categoryId,
    categoryName: menu.categoryName,
    categoryDisplayOrder: menu.categoryDisplayOrder,
    name: menu.name,
    price: menu.price,
    optionGroupName: menu.optionGroupName,
    options: [...menu.options]
      .map((option) => ({
        ...option,
        price: option.price ?? menu.price,
      }))
      .sort((a, b) => {
        if (a.displayOrder !== b.displayOrder) return a.displayOrder - b.displayOrder;
        return a.label.localeCompare(b.label, "ko-KR");
      }),
    isActive: menu.isActive,
    displayOrder: menu.displayOrder,
  };
}

export async function getFoodOrderSupportCap() {
  const setting = await prisma.setting.findUnique({
    where: { key: FOOD_ORDER_SUPPORT_CAP_KEY },
  });

  return parseAmount(setting?.value ?? DEFAULT_FOOD_ORDER_SUPPORT_CAP);
}

export async function getFoodMenus() {
  const rows = await prisma.foodMenuItem.findMany({
    where: { isActive: true },
    orderBy: [
      { category: { displayOrder: "asc" } },
      { category: { name: "asc" } },
      { displayOrder: "asc" },
      { name: "asc" },
    ],
    select: {
      id: true,
      categoryId: true,
      name: true,
      price: true,
      optionGroupName: true,
      isActive: true,
      displayOrder: true,
      optionChoices: {
        orderBy: [{ displayOrder: "asc" }, { label: "asc" }],
        select: {
          id: true,
          label: true,
          price: true,
          displayOrder: true,
        },
      },
      category: {
        select: {
          name: true,
          displayOrder: true,
        },
      },
    },
  });

  return sortFoodMenus(
    rows.map((row) =>
      mapMenu({
        id: row.id,
        categoryId: row.categoryId,
        categoryName: row.category.name,
        categoryDisplayOrder: row.category.displayOrder,
        name: row.name,
        price: row.price,
        optionGroupName: row.optionGroupName,
        options: row.optionChoices,
        isActive: row.isActive,
        displayOrder: row.displayOrder,
      })
    )
  );
}

export type ParticipantFoodOrderItemData = {
  id: number;
  menuItemId: number | null;
  menuOptionChoiceId: number | null;
  menuNameSnapshot: string;
  optionGroupNameSnapshot: string | null;
  optionChoiceLabelSnapshot: string | null;
  unitPriceSnapshot: number;
  quantity: number;
  preparingQuantity: number;
  servedQuantity: number;
  cancelledAt: string | null;
  cancelledReasonCode: string | null;
  cancelledReasonText: string | null;
  cancelledByKakaoId: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ParticipantFoodOrderData = {
  orderId: number;
  createdAt: string;
  items: ParticipantFoodOrderItemData[];
};

export type ParticipantMeetingFoodOrdersData = {
  meeting: {
    id: number;
    date: string;
    orderOpen: boolean;
  };
  supportCap: number;
  menus: FoodMenuCatalogItem[];
  participants: Array<{
    participantId: number;
    name: string;
    companionId: number | null;
    orders: ParticipantFoodOrderData[];
    canOrder: boolean;
    orderRole: "self" | "owner_proxy" | "linked_companion_locked";
    roleLabel: string;
    lockedReason: string | null;
  }>;
};

export async function getParticipantMeetingFoodOrdersData(
  meetingId: number,
  kakaoId: string
): Promise<ParticipantMeetingFoodOrdersData | null> {
  const [meeting, supportCap, menus] = await Promise.all([
    prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        id: true,
        date: true,
        participants: {
          where: {
            status: "APPROVED",
            OR: [
              { kakaoId, companionId: null },
              { companion: { ownerKakaoId: kakaoId } },
              { companion: { linkedKakaoId: kakaoId } },
            ],
          },
          orderBy: [{ companionId: "asc" }, { submittedAt: "asc" }],
          select: {
            id: true,
            name: true,
            kakaoId: true,
            companionId: true,
            companion: {
              select: {
                ownerKakaoId: true,
                linkedKakaoId: true,
              },
            },
            foodOrders: {
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
              select: {
                id: true,
                createdAt: true,
                items: {
                  orderBy: [{ createdAt: "asc" }, { id: "asc" }],
                  select: {
                    id: true,
                    menuItemId: true,
                    menuOptionChoiceId: true,
                    menuNameSnapshot: true,
                    optionGroupNameSnapshot: true,
                    optionChoiceLabelSnapshot: true,
                    unitPriceSnapshot: true,
                    quantity: true,
                    preparingQuantity: true,
                    servedQuantity: true,
                    cancelledAt: true,
                    cancelledReasonCode: true,
                    cancelledReasonText: true,
                    cancelledByKakaoId: true,
                    createdAt: true,
                    updatedAt: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    getFoodOrderSupportCap(),
    getFoodMenus(),
  ]);

  if (!meeting) {
    return null;
  }

  return {
    meeting: {
      id: meeting.id,
      date: meeting.date,
      orderOpen: isMeetingOrderOpen(meeting.date),
    },
    supportCap,
    menus,
    participants: meeting.participants.map((participant) => ({
      participantId: participant.id,
      name: participant.name,
      companionId: participant.companionId,
      ...getFoodOrderParticipantAccess({
        sessionKakaoId: kakaoId,
        participantKakaoId: participant.kakaoId,
        companionId: participant.companionId,
        companionOwnerKakaoId: participant.companion?.ownerKakaoId ?? null,
        companionLinkedKakaoId: participant.companion?.linkedKakaoId ?? null,
      }),
      orders: participant.foodOrders.map((order) => ({
        orderId: order.id,
        createdAt: order.createdAt.toISOString(),
        items: order.items.map((item) => ({
          id: item.id,
          menuItemId: item.menuItemId,
          menuOptionChoiceId: item.menuOptionChoiceId,
          menuNameSnapshot: item.menuNameSnapshot,
          optionGroupNameSnapshot: item.optionGroupNameSnapshot,
          optionChoiceLabelSnapshot: item.optionChoiceLabelSnapshot,
          unitPriceSnapshot: item.unitPriceSnapshot,
          quantity: item.quantity,
          preparingQuantity: item.preparingQuantity,
          servedQuantity: item.servedQuantity,
          cancelledAt: item.cancelledAt?.toISOString() ?? null,
          cancelledReasonCode: item.cancelledReasonCode,
          cancelledReasonText: item.cancelledReasonText,
          cancelledByKakaoId: item.cancelledByKakaoId,
          createdAt: item.createdAt.toISOString(),
          updatedAt: item.updatedAt.toISOString(),
        })),
      })),
    })),
  };
}

export type AdminMeetingFoodOrdersData = {
  meeting: {
    id: number;
    date: string;
    startTime: string;
    endTime: string;
    location: string;
  };
  summary: {
    approvedCount: number;
    lessonCount: number;
    rentalCount: number;
    orderAmount: number;
    totalOrderedQuantity: number;
    remainingQuantity: number;
    cancelledAmount: number;
    cancelledQuantity: number;
  };
  menuRows: Array<{
    rowId: string;
    menuItemId: number | null;
    orderItemIds: number[];
    menuName: string;
    unitPrice: number;
    orderedQuantity: number;
    preparingQuantity: number;
    servedQuantity: number;
    remainingQuantity: number;
    cancelledQuantity: number;
    cancelledAmount: number;
    participantOrders: Array<{
      participantId: number;
      menuItemId: number | null;
      orderItemIds: number[];
      participantName: string;
      companionId: number | null;
      orderedAt: string | null;
      quantity: number;
      preparingQuantity: number;
      servedQuantity: number;
      remainingQuantity: number;
      canCancel: boolean;
    }>;
  }>;
  participantRows: Array<{
    participantId: number;
    participantName: string;
    companionId: number | null;
    subtotal: number;
    items: Array<{
      rowId: string;
      menuItemId: number | null;
      menuName: string;
      orderItemIds: number[];
      quantity: number;
      preparingQuantity: number;
      servedQuantity: number;
      remainingQuantity: number;
    }>;
  }>;
};

export async function getAdminMeetingFoodOrdersData(meetingId: number): Promise<AdminMeetingFoodOrdersData | null> {
  const [meeting, menus] = await Promise.all([
    prisma.meeting.findUnique({
      where: { id: meetingId },
      select: {
        id: true,
        date: true,
        startTime: true,
        endTime: true,
        location: true,
        participants: {
          where: { status: "APPROVED" },
          orderBy: { submittedAt: "asc" },
          select: {
            id: true,
            name: true,
            companionId: true,
            hasLesson: true,
            hasRental: true,
            foodOrderItems: {
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                participantId: true,
                menuItemId: true,
                menuOptionChoiceId: true,
                menuNameSnapshot: true,
                optionGroupNameSnapshot: true,
                optionChoiceLabelSnapshot: true,
                unitPriceSnapshot: true,
                quantity: true,
                preparingQuantity: true,
                servedQuantity: true,
                cancelledAt: true,
                cancelledReasonCode: true,
                cancelledReasonText: true,
                cancelledByKakaoId: true,
                createdAt: true,
              },
            },
          },
        },
      },
    }),
    getFoodMenus(),
  ]);

  if (!meeting) {
    return null;
  }

  const itemsByLine = new Map<string, AdminMeetingFoodOrdersData["menuRows"][number]["participantOrders"]>();
  const participantRows: AdminMeetingFoodOrdersData["participantRows"] = [];
  const extraLines = new Map<
    string,
    Pick<AdminMeetingFoodOrdersData["menuRows"][number], "rowId" | "menuItemId" | "menuName" | "unitPrice">
  >();

  const menuLineRows = sortFoodMenus(menus).flatMap((menu) => {
    if (menu.options.length === 0) {
      return [
        {
          rowId: `${menu.id}:none`,
          menuItemId: menu.id,
          menuName: menu.name,
          unitPrice: menu.price,
        },
      ];
    }

    return menu.options.map((option) => ({
      rowId: `${menu.id}:${option.id}`,
      menuItemId: menu.id,
      menuName: `${menu.name} · ${option.label}`,
      unitPrice: option.price,
    }));
  });
  const menuLineRowIds = new Set(menuLineRows.map((menu) => menu.rowId));
  const cancelledByLine = new Map<string, { quantity: number; amount: number }>();
  let orderAmount = 0;
  let totalOrderedQuantity = 0;
  let remainingQuantity = 0;
  let cancelledAmount = 0;
  let cancelledQuantity = 0;

  function getOrderItemRow(item: {
    menuItemId: number | null;
    menuOptionChoiceId: number | null;
    menuNameSnapshot: string;
    optionChoiceLabelSnapshot: string | null;
  }) {
    const menuRowKey = item.menuItemId ?? `deleted:${item.menuNameSnapshot}`;
    return item.menuOptionChoiceId
      ? `${menuRowKey}:${item.menuOptionChoiceId}`
      : item.optionChoiceLabelSnapshot
        ? `${menuRowKey}:label:${item.optionChoiceLabelSnapshot}`
        : `${menuRowKey}:none`;
  }

  for (const participant of meeting.participants) {
    const rawItems = participant.foodOrderItems;
    const activeItems = getActiveFoodOrderItems(rawItems);
    const cancelledItems = getCancelledFoodOrderItems(rawItems);

    for (const item of cancelledItems) {
      const rowId = getOrderItemRow(item);
      const menuName = getFoodOrderItemDisplayName(item);
      const amount = item.unitPriceSnapshot * item.quantity;
      const existing = cancelledByLine.get(rowId) ?? { quantity: 0, amount: 0 };
      existing.quantity += item.quantity;
      existing.amount += amount;
      cancelledByLine.set(rowId, existing);
      cancelledQuantity += item.quantity;
      cancelledAmount += amount;

      if (!menuLineRowIds.has(rowId) && !extraLines.has(rowId)) {
        extraLines.set(rowId, {
          rowId,
          menuItemId: item.menuItemId,
          menuName,
          unitPrice: item.unitPriceSnapshot,
        });
      }
    }

    // (participantId, menuItemId, option) 단위로 집계
    const menuAgg = new Map<string, {
      rowId: string;
      menuItemId: number | null;
      menuName: string;
      unitPrice: number;
      orderItemIds: number[];
      orderedAt: string | null;
      quantity: number;
      preparingQuantity: number;
      servedQuantity: number;
    }>();

    for (const item of activeItems) {
      const rowId = getOrderItemRow(item);
      const menuName = getFoodOrderItemDisplayName(item);
      const existing = menuAgg.get(rowId);
      if (existing) {
        existing.orderItemIds.push(item.id);
        existing.quantity += item.quantity;
        existing.preparingQuantity += item.preparingQuantity;
        existing.servedQuantity += item.servedQuantity;
      } else {
        menuAgg.set(rowId, {
          rowId,
          menuItemId: item.menuItemId,
          menuName,
          unitPrice: item.unitPriceSnapshot,
          orderItemIds: [item.id],
          orderedAt: item.createdAt ? item.createdAt.toISOString() : null,
          quantity: item.quantity,
          preparingQuantity: item.preparingQuantity,
          servedQuantity: item.servedQuantity,
        });
      }

      if (!menuLineRowIds.has(rowId) && !extraLines.has(rowId)) {
        extraLines.set(rowId, {
          rowId,
          menuItemId: item.menuItemId,
          menuName,
          unitPrice: item.unitPriceSnapshot,
        });
      }
    }

    const aggItems = Array.from(menuAgg.values());
    const subtotal = aggItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    orderAmount += subtotal;
    totalOrderedQuantity += aggItems.reduce((sum, item) => sum + item.quantity, 0);
    remainingQuantity += aggItems.reduce((sum, item) => sum + Math.max(item.quantity - item.servedQuantity, 0), 0);

    if (aggItems.length > 0) {
      participantRows.push({
        participantId: participant.id,
        participantName: participant.name,
        companionId: participant.companionId,
        subtotal,
        items: aggItems.map((item) => ({
          rowId: item.rowId,
          menuItemId: item.menuItemId,
          menuName: item.menuName,
          orderItemIds: item.orderItemIds,
          quantity: item.quantity,
          preparingQuantity: item.preparingQuantity,
          servedQuantity: item.servedQuantity,
          remainingQuantity: Math.max(item.quantity - item.servedQuantity, 0),
        })),
      });
    }

    for (const item of aggItems) {
      const list = itemsByLine.get(item.rowId) ?? [];
      list.push({
        participantId: participant.id,
        menuItemId: item.menuItemId,
        orderItemIds: item.orderItemIds,
        participantName: participant.name,
        companionId: participant.companionId,
        orderedAt: item.orderedAt,
        quantity: item.quantity,
        preparingQuantity: item.preparingQuantity,
        servedQuantity: item.servedQuantity,
        remainingQuantity: Math.max(item.quantity - item.servedQuantity, 0),
        canCancel: canCancelFoodOrderItems(
          rawItems.filter((rawItem) => item.orderItemIds.includes(rawItem.id))
        ),
      });
      itemsByLine.set(item.rowId, list);
    }
  }

  const menuRows = [...menuLineRows, ...Array.from(extraLines.values())].map((menu) => {
    const participantOrders = itemsByLine.get(menu.rowId) ?? [];
    return {
      rowId: menu.rowId,
      menuItemId: menu.menuItemId,
      orderItemIds: participantOrders.flatMap((order) => order.orderItemIds),
      menuName: menu.menuName,
      unitPrice: menu.unitPrice,
      orderedQuantity: participantOrders.reduce((sum, item) => sum + item.quantity, 0),
      preparingQuantity: participantOrders.reduce((sum, item) => sum + item.preparingQuantity, 0),
      servedQuantity: participantOrders.reduce((sum, item) => sum + item.servedQuantity, 0),
      remainingQuantity: participantOrders.reduce((sum, item) => sum + item.remainingQuantity, 0),
      cancelledQuantity: cancelledByLine.get(menu.rowId)?.quantity ?? 0,
      cancelledAmount: cancelledByLine.get(menu.rowId)?.amount ?? 0,
      participantOrders,
    };
  });

  return {
    meeting: {
      id: meeting.id,
      date: meeting.date,
      startTime: meeting.startTime,
      endTime: meeting.endTime,
      location: meeting.location,
    },
    summary: {
      approvedCount: meeting.participants.length,
      lessonCount: meeting.participants.filter((participant) => participant.hasLesson).length,
      rentalCount: meeting.participants.filter((participant) => participant.hasRental).length,
      orderAmount,
      totalOrderedQuantity,
      remainingQuantity,
      cancelledAmount,
      cancelledQuantity,
    },
    menuRows,
    participantRows,
  };
}

export type AdminFoodMenuSettingsData = {
  categories: Array<
    FoodMenuCategoryCatalogItem & {
      menus: FoodMenuCatalogItem[];
    }
  >;
};

export async function getAdminFoodMenuSettingsData(): Promise<AdminFoodMenuSettingsData> {
  const categories = await prisma.foodMenuCategory.findMany({
    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      displayOrder: true,
      menuItems: {
        orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
        select: {
          id: true,
          categoryId: true,
          name: true,
          price: true,
          optionGroupName: true,
          isActive: true,
          displayOrder: true,
          optionChoices: {
            orderBy: [{ displayOrder: "asc" }, { label: "asc" }],
            select: {
              id: true,
              label: true,
              price: true,
              displayOrder: true,
            },
          },
        },
      },
    },
  });

  return {
    categories: sortFoodMenuCategories(
      categories.map((category) => ({
        id: category.id,
        name: category.name,
        displayOrder: category.displayOrder,
        menus: sortFoodMenus(
          category.menuItems.map((menu) =>
            mapMenu({
              id: menu.id,
              categoryId: category.id,
              categoryName: category.name,
              categoryDisplayOrder: category.displayOrder,
              name: menu.name,
              price: menu.price,
              optionGroupName: menu.optionGroupName,
              options: menu.optionChoices,
              isActive: menu.isActive,
              displayOrder: menu.displayOrder,
            })
          )
        ),
      }))
    ),
  };
}

export type FoodMenuSaveItem = {
  id: number | null;
  name: string;
  price: number;
  optionGroupName: string | null;
  options: Array<{
    id: number | null;
    label: string;
    price: number;
    displayOrder: number;
  }>;
  isActive: boolean;
  displayOrder: number;
};

export type FoodMenuCategorySaveItem = {
  id: number | null;
  name: string;
  displayOrder: number;
  menus: FoodMenuSaveItem[];
};

export async function saveFoodMenuCatalog(categories: FoodMenuCategorySaveItem[]) {
  const [existingCategories, existingMenus, existingOptions] = await Promise.all([
    prisma.foodMenuCategory.findMany({
      select: { id: true },
    }),
    prisma.foodMenuItem.findMany({
      select: { id: true },
    }),
    prisma.foodMenuOptionChoice.findMany({
      select: { id: true, menuItemId: true },
    }),
  ]);

  const duplicateCategoryIds = categories
    .map((category) => category.id)
    .filter((id): id is number => id !== null)
    .filter((id, index, array) => array.indexOf(id) !== index);

  if (duplicateCategoryIds.length > 0) {
    throw new Error("중복된 카테고리 ID가 포함되어 있습니다.");
  }

  const duplicateMenuIds = categories
    .flatMap((category) => category.menus.map((menu) => menu.id))
    .filter((id): id is number => id !== null)
    .filter((id, index, array) => array.indexOf(id) !== index);

  if (duplicateMenuIds.length > 0) {
    throw new Error("중복된 메뉴 ID가 포함되어 있습니다.");
  }

  const duplicateOptionIds = categories
    .flatMap((category) => category.menus.flatMap((menu) => menu.options.map((option) => option.id)))
    .filter((id): id is number => id !== null)
    .filter((id, index, array) => array.indexOf(id) !== index);

  if (duplicateOptionIds.length > 0) {
    throw new Error("중복된 메뉴 옵션 ID가 포함되어 있습니다.");
  }

  const existingCategoryIds = new Set(existingCategories.map((category) => category.id));
  const incomingCategoryIds = new Set(
    categories.flatMap((category) => (category.id === null ? [] : [category.id]))
  );

  if (Array.from(incomingCategoryIds).some((id) => !existingCategoryIds.has(id))) {
    throw new Error("이미 삭제된 카테고리가 포함되어 있습니다. 새로고침 후 다시 시도해 주세요.");
  }

  const existingMenuIds = new Set(existingMenus.map((menu) => menu.id));
  const incomingMenuIds = new Set(
    categories.flatMap((category) =>
      category.menus.flatMap((menu) => (menu.id === null ? [] : [menu.id]))
    )
  );

  if (Array.from(incomingMenuIds).some((id) => !existingMenuIds.has(id))) {
    throw new Error("이미 삭제된 메뉴가 포함되어 있습니다. 새로고침 후 다시 시도해 주세요.");
  }

  const existingOptionIds = new Set(existingOptions.map((option) => option.id));
  const incomingOptionIds = new Set(
    categories.flatMap((category) =>
      category.menus.flatMap((menu) =>
        menu.options.flatMap((option) => (option.id === null ? [] : [option.id]))
      )
    )
  );

  if (Array.from(incomingOptionIds).some((id) => !existingOptionIds.has(id))) {
    throw new Error("이미 삭제된 메뉴 옵션이 포함되어 있습니다. 새로고침 후 다시 시도해 주세요.");
  }

  for (const category of categories) {
    for (const menu of category.menus) {
      for (const option of menu.options) {
        if (option.id === null || menu.id === null) continue;
        const existingOption = existingOptions.find((candidate) => candidate.id === option.id);
        if (existingOption && existingOption.menuItemId !== menu.id) {
          throw new Error("메뉴 옵션이 다른 메뉴에 연결되어 있습니다. 새로고침 후 다시 시도해 주세요.");
        }
      }
    }
  }

  const removedCategoryIds = Array.from(existingCategoryIds).filter((id) => !incomingCategoryIds.has(id));
  const removedMenuIds = Array.from(existingMenuIds).filter((id) => !incomingMenuIds.has(id));
  const removedOptionIds = Array.from(existingOptionIds).filter((id) => !incomingOptionIds.has(id));

  await prisma.$transaction(async (tx) => {
    if (removedMenuIds.length > 0) {
      await tx.foodMenuItem.deleteMany({
        where: { id: { in: removedMenuIds } },
      });
    }

    if (removedOptionIds.length > 0) {
      await tx.foodMenuOptionChoice.deleteMany({
        where: {
          id: { in: removedOptionIds },
          menuItemId: { notIn: removedMenuIds },
        },
      });
    }

    for (const category of categories) {
      let categoryId = category.id;

      if (categoryId === null) {
        const createdCategory = await tx.foodMenuCategory.create({
          data: {
            name: category.name,
            displayOrder: category.displayOrder,
          },
        });
        categoryId = createdCategory.id;
      } else {
        await tx.foodMenuCategory.update({
          where: { id: categoryId },
          data: {
            name: category.name,
            displayOrder: category.displayOrder,
          },
        });
      }

      for (const menu of category.menus) {
        if (menu.id === null) {
          await tx.foodMenuItem.create({
            data: {
              categoryId,
              name: menu.name,
              price: menu.price,
              optionGroupName: menu.optionGroupName,
              isActive: menu.isActive,
              displayOrder: menu.displayOrder,
              optionChoices: {
                create: menu.options.map((option) => ({
                  label: option.label,
                  price: option.price,
                  displayOrder: option.displayOrder,
                })),
              },
            },
          });
          continue;
        }

        await tx.foodMenuItem.update({
          where: { id: menu.id },
          data: {
            categoryId,
            name: menu.name,
            price: menu.price,
            optionGroupName: menu.optionGroupName,
            isActive: menu.isActive,
            displayOrder: menu.displayOrder,
          },
        });

        for (const option of menu.options) {
          if (option.id === null) {
            await tx.foodMenuOptionChoice.create({
              data: {
                menuItemId: menu.id,
                label: option.label,
                price: option.price,
                displayOrder: option.displayOrder,
              },
            });
            continue;
          }

          await tx.foodMenuOptionChoice.update({
            where: { id: option.id },
            data: {
              label: option.label,
              price: option.price,
              displayOrder: option.displayOrder,
            },
          });
        }
      }
    }

    if (removedCategoryIds.length > 0) {
      await tx.foodMenuCategory.deleteMany({
        where: { id: { in: removedCategoryIds } },
      });
    }
  });

  return getAdminFoodMenuSettingsData();
}

export type MeetingOrderAction = "prepare" | "serve" | "undo_prepare" | "undo_serve" | "cancel";

export const ORDER_CANCEL_REASON_LABELS: Record<string, string> = {
  sold_out: "품절",
  duplicate: "중복 주문",
  customer_request: "고객 요청",
  other: "기타",
};

export async function applyMeetingOrderAction(
  meetingId: number,
  participantId: number,
  orderItemIds: number[],
  action: MeetingOrderAction,
  options: {
    actorKakaoId?: string | null;
    cancelReasonCode?: string | null;
    cancelReasonText?: string | null;
  } = {}
) {
  if (!["prepare", "serve", "undo_prepare", "undo_serve", "cancel"].includes(action)) {
    throw new Error("지원하지 않는 주문 액션입니다.");
  }
  if (orderItemIds.length === 0 || orderItemIds.some((id) => !Number.isInteger(id))) {
    throw new Error("처리할 주문 항목이 필요합니다.");
  }

  const items = await prisma.participantFoodOrderItem.findMany({
    where: { meetingId, participantId, id: { in: orderItemIds } },
  });

  if (items.length !== orderItemIds.length) {
    throw new Error("주문 항목을 찾을 수 없습니다.");
  }

  if (action !== "cancel" && items.some((item) => item.cancelledAt)) {
    throw new Error("취소된 주문은 상태를 바꿀 수 없습니다.");
  }

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalServed = items.reduce((sum, item) => sum + item.servedQuantity, 0);
  const totalPreparing = items.reduce((sum, item) => sum + item.preparingQuantity, 0);

  if (action === "prepare") {
    if (totalPreparing + totalServed >= totalQuantity) {
      throw new Error("이미 모두 처리된 주문입니다.");
    }
    // 준비 안 된 수량 전부를 준비 중으로 전환
    await prisma.$transaction(
      items.map((item) =>
        prisma.participantFoodOrderItem.update({
          where: { id: item.id },
          data: { preparingQuantity: Math.max(0, item.quantity - item.servedQuantity) },
        })
      )
    );
  }

  if (action === "undo_prepare") {
    if (totalPreparing <= 0) {
      throw new Error("되돌릴 준비중 수량이 없습니다.");
    }
    await prisma.participantFoodOrderItem.updateMany({
      where: { meetingId, participantId, id: { in: orderItemIds } },
      data: { preparingQuantity: 0 },
    });
  }

  if (action === "serve") {
    if (totalServed >= totalQuantity) {
      throw new Error("이미 모두 처리된 주문입니다.");
    }
    // 전체를 완료로 전환
    await prisma.$transaction(
      items.map((item) =>
        prisma.participantFoodOrderItem.update({
          where: { id: item.id },
          data: { servedQuantity: item.quantity, preparingQuantity: 0 },
        })
      )
    );
  }

  if (action === "undo_serve") {
    if (totalServed <= 0) {
      throw new Error("되돌릴 제공완료 수량이 없습니다.");
    }
    // 완료 취소 → 초기 상태로 복원
    await prisma.participantFoodOrderItem.updateMany({
      where: { meetingId, participantId, id: { in: orderItemIds } },
      data: { servedQuantity: 0, preparingQuantity: 0 },
    });
  }

  if (action === "cancel") {
    if (!canCancelFoodOrderItems(items)) {
      throw new Error(totalServed > 0 ? "제공 완료된 주문은 취소할 수 없습니다." : "취소할 수 없는 주문입니다.");
    }

    const participant = await prisma.participant.findUnique({
      where: { id: participantId },
      select: {
        id: true,
        name: true,
        kakaoId: true,
        companionId: true,
        companion: {
          select: {
            linkedKakaoId: true,
          },
        },
        meeting: {
          select: {
            date: true,
            startTime: true,
            location: true,
          },
        },
      },
    });

    if (!participant) {
      throw new Error("주문자를 찾을 수 없습니다.");
    }

    const cancelledAt = new Date();
    const cancelReasonCode = options.cancelReasonCode && ORDER_CANCEL_REASON_LABELS[options.cancelReasonCode]
      ? options.cancelReasonCode
      : "other";
    const cancelReasonText = (options.cancelReasonText ?? "").trim();
    const reasonLabel = cancelReasonText || ORDER_CANCEL_REASON_LABELS[cancelReasonCode];
    const recipientKakaoId =
      participant.companionId && participant.companion?.linkedKakaoId
        ? participant.companion.linkedKakaoId
        : participant.kakaoId;
    const cancelledMenuNames = Array.from(new Set(items.map((item) => getFoodOrderItemDisplayName(item))));
    const title = `${participant.name} 주문이 취소되었습니다`;
    const body = [
      `${participant.meeting.date} ${participant.meeting.startTime} · ${participant.meeting.location}`,
      cancelledMenuNames.join(", "),
      reasonLabel ? `사유: ${reasonLabel}` : null,
    ].filter(Boolean).join("\n");

    await prisma.$transaction([
      prisma.participantFoodOrderItem.updateMany({
        where: { meetingId, participantId, id: { in: orderItemIds } },
        data: {
          preparingQuantity: 0,
          cancelledAt,
          cancelledReasonCode: cancelReasonCode,
          cancelledReasonText: cancelReasonText || null,
          cancelledByKakaoId: options.actorKakaoId ?? null,
        },
      }),
      prisma.userNotification.create({
        data: {
          recipientKakaoId,
          type: "ORDER_CANCELLED",
          meetingId,
          participantId,
          foodOrderItemId: items[0]?.id ?? null,
          title,
          body,
        },
      }),
    ]);
  }

  return getAdminMeetingFoodOrdersData(meetingId);
}

export type ShopMeetingOption = {
  id: number;
  label: string;
  date: string;
};

export type ShopDashboardData = {
  meetings: ShopMeetingOption[];
  selectedMeetingId: number | null;
  selectedMeetingData: AdminMeetingFoodOrdersData | null;
  selectedUsageData: ShopMeetingSurfUsageData | null;
};

export async function getShopDashboardData(requestedMeetingId?: number): Promise<ShopDashboardData> {
  const meetings = await prisma.meeting.findMany({
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    select: {
      id: true,
      date: true,
      startTime: true,
      location: true,
    },
  });

  const today = getTodayInSeoul();
  const selectedMeeting =
    meetings.find((meeting) => meeting.id === requestedMeetingId) ??
    meetings.find((meeting) => meeting.date === today) ??
    meetings.find((meeting) => meeting.date >= today) ??
    meetings.at(-1) ??
    null;

  const [selectedMeetingData, selectedUsageData] = selectedMeeting
    ? await Promise.all([
        getAdminMeetingFoodOrdersData(selectedMeeting.id),
        getShopMeetingSurfUsageData(selectedMeeting.id),
      ])
    : [null, null];

  return {
    meetings: meetings.map((meeting) => ({
      id: meeting.id,
      date: meeting.date,
      label: `${meeting.date} ${meeting.startTime} · ${meeting.location}`,
    })),
    selectedMeetingId: selectedMeeting?.id ?? null,
    selectedMeetingData,
    selectedUsageData,
  };
}
