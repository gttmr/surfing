import { prisma } from "@/lib/db";
import { getTodayInSeoul } from "@/lib/date";
import {
  getFoodOrderSummary,
  isFoodOrderLocked,
  isMeetingOrderOpen,
  parseAmount,
  sortFoodMenuCategories,
  sortFoodMenus,
  UNCATEGORIZED_MENU_NAME,
  UNCATEGORIZED_MENU_ORDER,
  type FoodMenuCategoryCatalogItem,
  type FoodMenuCatalogItem,
  type FoodOrderItemSnapshot,
} from "@/lib/food-ordering";
import {
  DEFAULT_FOOD_ORDER_SUPPORT_CAP,
  FOOD_ORDER_SUPPORT_CAP_KEY,
} from "@/lib/settings";

type MenuSelectShape = {
  id: number;
  categoryId: number | null;
  categoryName: string;
  categoryDisplayOrder: number;
  name: string;
  price: number;
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
    isActive: menu.isActive,
    displayOrder: menu.displayOrder,
  };
}

function mapFoodOrderItem(item: {
  id: number;
  participantId: number;
  menuItemId: number;
  menuNameSnapshot: string;
  unitPriceSnapshot: number;
  quantity: number;
  preparingQuantity: number;
  servedQuantity: number;
}): FoodOrderItemSnapshot {
  return {
    id: item.id,
    participantId: item.participantId,
    menuItemId: item.menuItemId,
    menuNameSnapshot: item.menuNameSnapshot,
    unitPriceSnapshot: item.unitPriceSnapshot,
    quantity: item.quantity,
    preparingQuantity: item.preparingQuantity,
    servedQuantity: item.servedQuantity,
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
      isActive: true,
      displayOrder: true,
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
        isActive: row.isActive,
        displayOrder: row.displayOrder,
      })
    )
  );
}

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
    orders: Array<{
      orderId: number;
      createdAt: string;
      items: Array<{ menuItemId: number; quantity: number }>;
    }>;
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
            OR: [{ kakaoId }, { companion: { linkedKakaoId: kakaoId } }],
          },
          orderBy: [{ companionId: "asc" }, { submittedAt: "asc" }],
          select: {
            id: true,
            name: true,
            companionId: true,
            foodOrders: {
              orderBy: { createdAt: "asc" },
              select: {
                id: true,
                createdAt: true,
                items: {
                  select: {
                    menuItemId: true,
                    quantity: true,
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
      orders: participant.foodOrders.map((order) => ({
        orderId: order.id,
        createdAt: order.createdAt.toISOString(),
        items: order.items.map((item) => ({
          menuItemId: item.menuItemId,
          quantity: item.quantity,
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
  };
  menuRows: Array<{
    menuItemId: number;
    menuName: string;
    unitPrice: number;
    orderedQuantity: number;
    preparingQuantity: number;
    servedQuantity: number;
    remainingQuantity: number;
    participantOrders: Array<{
      participantId: number;
      menuItemId: number;
      participantName: string;
      companionId: number | null;
      orderedAt: string | null;
      quantity: number;
      preparingQuantity: number;
      servedQuantity: number;
      remainingQuantity: number;
    }>;
  }>;
  participantRows: Array<{
    participantId: number;
    participantName: string;
    companionId: number | null;
    subtotal: number;
    items: Array<{
      menuItemId: number;
      menuName: string;
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
                menuNameSnapshot: true,
                unitPriceSnapshot: true,
                quantity: true,
                preparingQuantity: true,
                servedQuantity: true,
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

  const itemsByMenu = new Map<number, AdminMeetingFoodOrdersData["menuRows"][number]["participantOrders"]>();
  const participantRows: AdminMeetingFoodOrdersData["participantRows"] = [];
  const extraMenus = new Map<number, FoodMenuCatalogItem>();

  const menuIdSet = new Set(menus.map((menu) => menu.id));
  let orderAmount = 0;
  let totalOrderedQuantity = 0;
  let remainingQuantity = 0;

  for (const participant of meeting.participants) {
    const rawItems = participant.foodOrderItems;

    // (participantId, menuItemId) 단위로 집계
    const menuAgg = new Map<number, {
      menuItemId: number;
      menuName: string;
      unitPrice: number;
      orderedAt: string | null;
      quantity: number;
      preparingQuantity: number;
      servedQuantity: number;
    }>();

    for (const item of rawItems) {
      const existing = menuAgg.get(item.menuItemId);
      if (existing) {
        existing.quantity += item.quantity;
        existing.preparingQuantity += item.preparingQuantity;
        existing.servedQuantity += item.servedQuantity;
      } else {
        menuAgg.set(item.menuItemId, {
          menuItemId: item.menuItemId,
          menuName: item.menuNameSnapshot,
          unitPrice: item.unitPriceSnapshot,
          orderedAt: item.createdAt ? item.createdAt.toISOString() : null,
          quantity: item.quantity,
          preparingQuantity: item.preparingQuantity,
          servedQuantity: item.servedQuantity,
        });
      }

      if (!menuIdSet.has(item.menuItemId) && !extraMenus.has(item.menuItemId)) {
        extraMenus.set(item.menuItemId, {
          id: item.menuItemId,
          categoryId: null,
          categoryName: UNCATEGORIZED_MENU_NAME,
          categoryDisplayOrder: UNCATEGORIZED_MENU_ORDER,
          name: item.menuNameSnapshot,
          price: item.unitPriceSnapshot,
          isActive: false,
          displayOrder: Number.MAX_SAFE_INTEGER,
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
          menuItemId: item.menuItemId,
          menuName: item.menuName,
          quantity: item.quantity,
          preparingQuantity: item.preparingQuantity,
          servedQuantity: item.servedQuantity,
          remainingQuantity: Math.max(item.quantity - item.servedQuantity, 0),
        })),
      });
    }

    for (const item of aggItems) {
      const list = itemsByMenu.get(item.menuItemId) ?? [];
      list.push({
        participantId: participant.id,
        menuItemId: item.menuItemId,
        participantName: participant.name,
        companionId: participant.companionId,
        orderedAt: item.orderedAt,
        quantity: item.quantity,
        preparingQuantity: item.preparingQuantity,
        servedQuantity: item.servedQuantity,
        remainingQuantity: Math.max(item.quantity - item.servedQuantity, 0),
      });
      itemsByMenu.set(item.menuItemId, list);
    }
  }

  const menuRows = [...menus, ...sortFoodMenus(Array.from(extraMenus.values()))].map((menu) => {
    const participantOrders = itemsByMenu.get(menu.id) ?? [];
    return {
      menuItemId: menu.id,
      menuName: menu.name,
      unitPrice: menu.price,
      orderedQuantity: participantOrders.reduce((sum, item) => sum + item.quantity, 0),
      preparingQuantity: participantOrders.reduce((sum, item) => sum + item.preparingQuantity, 0),
      servedQuantity: participantOrders.reduce((sum, item) => sum + item.servedQuantity, 0),
      remainingQuantity: participantOrders.reduce((sum, item) => sum + item.remainingQuantity, 0),
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
          isActive: true,
          displayOrder: true,
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
  const [existingCategories, existingMenus] = await Promise.all([
    prisma.foodMenuCategory.findMany({
      select: { id: true },
    }),
    prisma.foodMenuItem.findMany({
      select: { id: true },
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

  const removedCategoryIds = Array.from(existingCategoryIds).filter((id) => !incomingCategoryIds.has(id));
  const removedMenuIds = Array.from(existingMenuIds).filter((id) => !incomingMenuIds.has(id));

  if (removedMenuIds.length > 0) {
    const orderCount = await prisma.participantFoodOrderItem.count({
      where: { menuItemId: { in: removedMenuIds } },
    });

    if (orderCount > 0) {
      throw new Error("이미 주문 기록이 있는 메뉴는 제거할 수 없습니다.");
    }
  }

  await prisma.$transaction(async (tx) => {
    if (removedMenuIds.length > 0) {
      await tx.foodMenuItem.deleteMany({
        where: { id: { in: removedMenuIds } },
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
              isActive: menu.isActive,
              displayOrder: menu.displayOrder,
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
            isActive: menu.isActive,
            displayOrder: menu.displayOrder,
          },
        });
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

export type MeetingOrderAction = "prepare" | "serve" | "undo_prepare" | "undo_serve";

export async function applyMeetingOrderAction(
  meetingId: number,
  participantId: number,
  menuItemId: number,
  action: MeetingOrderAction
) {
  if (!["prepare", "serve", "undo_prepare", "undo_serve"].includes(action)) {
    throw new Error("지원하지 않는 주문 액션입니다.");
  }

  const items = await prisma.participantFoodOrderItem.findMany({
    where: { meetingId, participantId, menuItemId },
  });

  if (items.length === 0) {
    throw new Error("주문 항목을 찾을 수 없습니다.");
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
      where: { meetingId, participantId, menuItemId },
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
      where: { meetingId, participantId, menuItemId },
      data: { servedQuantity: 0, preparingQuantity: 0 },
    });
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

  return {
    meetings: meetings.map((meeting) => ({
      id: meeting.id,
      date: meeting.date,
      label: `${meeting.date} ${meeting.startTime} · ${meeting.location}`,
    })),
    selectedMeetingId: selectedMeeting?.id ?? null,
    selectedMeetingData: selectedMeeting
      ? await getAdminMeetingFoodOrdersData(selectedMeeting.id)
      : null,
  };
}
