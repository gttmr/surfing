import { prisma } from "@/lib/db";
import { getTodayInSeoul } from "@/lib/date";
import {
  getFoodOrderParticipantAccess,
  isMeetingOrderOpen,
  parseAmount,
  sortFoodMenuCategories,
  sortFoodMenus,
  type FoodMenuCategoryCatalogItem,
  type FoodMenuCatalogItem,
} from "@/lib/food-ordering";
import { getAdminMeetingFoodOrdersData } from "@/lib/fulfillment-order-data";
import type { AdminMeetingFoodOrdersData } from "@/lib/fulfillment-order-types";
import {
  DEFAULT_FOOD_ORDER_SUPPORT_CAP,
  FOOD_ORDER_SUPPORT_CAP_KEY,
} from "@/lib/settings";
import { getShopMeetingSurfUsageData, type ShopMeetingSurfUsageData } from "@/lib/surf-usage-data";

export { getAdminMeetingFoodOrdersData };
export type { AdminMeetingFoodOrdersData };

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
  const [meeting, supportCap, menus, actor] = await Promise.all([
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
    prisma.user.findUnique({ where: { kakaoId }, select: { role: true } }),
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
    participants: meeting.participants.map((participant) => {
      const access = getFoodOrderParticipantAccess({
        sessionKakaoId: kakaoId,
        participantKakaoId: participant.kakaoId,
        companionId: participant.companionId,
        companionOwnerKakaoId: participant.companion?.ownerKakaoId ?? null,
        companionLinkedKakaoId: participant.companion?.linkedKakaoId ?? null,
      });
      const participantAccess = actor?.role === "BANNED"
        ? { ...access, canOrder: false, roleLabel: "읽기 전용", lockedReason: "이 계정에서는 주문 내역만 확인할 수 있습니다." }
        : access;
      return {
        participantId: participant.id,
        name: participant.name,
        companionId: participant.companionId,
        ...participantAccess,
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
      };
    }),
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
  selectedUsageDataByDay: ShopMeetingSurfUsageData[];
};

export async function getShopDashboardData(requestedMeetingId?: number): Promise<ShopDashboardData> {
  const meetings = await prisma.meeting.findMany({
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
    select: {
      id: true,
      date: true,
      startTime: true,
      location: true,
      meetingGroup: {
        select: {
          meetings: {
            orderBy: { groupDayIndex: "asc" },
            select: { id: true },
          },
        },
      },
    },
  });

  const today = getTodayInSeoul();
  const selectedMeeting =
    meetings.find((meeting) => meeting.id === requestedMeetingId) ??
    meetings.find((meeting) => meeting.date === today) ??
    meetings.find((meeting) => meeting.date >= today) ??
    meetings.at(-1) ??
    null;

  const selectedUsageMeetingIds = selectedMeeting?.meetingGroup?.meetings.map((meeting) => meeting.id)
    ?? (selectedMeeting ? [selectedMeeting.id] : []);
  const selectedResults = selectedMeeting
    ? await Promise.all([
        getAdminMeetingFoodOrdersData(selectedMeeting.id),
        ...selectedUsageMeetingIds.map((meetingId) => getShopMeetingSurfUsageData(meetingId)),
      ])
    : [];
  const selectedMeetingData = (selectedResults[0] as AdminMeetingFoodOrdersData | null | undefined) ?? null;
  const selectedUsageDataByDay = selectedResults.slice(1)
    .filter((data): data is ShopMeetingSurfUsageData => data !== null);
  const selectedUsageData = selectedUsageDataByDay.find((data) => data.meeting.id === selectedMeeting?.id) ?? null;

  return {
    meetings: meetings.map((meeting) => ({
      id: meeting.id,
      date: meeting.date,
      label: `${meeting.date} ${meeting.startTime} · ${meeting.location}`,
    })),
    selectedMeetingId: selectedMeeting?.id ?? null,
    selectedMeetingData,
    selectedUsageData,
    selectedUsageDataByDay,
  };
}
