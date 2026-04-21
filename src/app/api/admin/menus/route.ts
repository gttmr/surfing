import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import {
  getAdminFoodMenuSettingsData,
  type FoodMenuCategorySaveItem,
  saveFoodMenuCatalog,
} from "@/lib/food-ordering-data";

type BulkMenuPayloadItem = {
  id?: number | null;
  name?: string;
  price?: number;
  isActive?: boolean;
};

type BulkCategoryPayloadItem = {
  id?: number | null;
  name?: string;
  menus?: BulkMenuPayloadItem[];
};

function normalizeCatalogPayload(body: unknown): FoodMenuCategorySaveItem[] {
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

        if (menuId !== null && !Number.isInteger(menuId)) {
          throw new Error("잘못된 메뉴가 포함되어 있습니다.");
        }
        if (!menuName) {
          throw new Error("메뉴 이름을 입력해 주세요.");
        }
        if (!Number.isInteger(price) || price < 0) {
          throw new Error("가격은 0 이상의 정수여야 합니다.");
        }

        return {
          id: menuId,
          name: menuName,
          price,
          isActive,
          displayOrder: menuIndex,
        };
      }),
    };
  });
}

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await getAdminFoodMenuSettingsData();
  return NextResponse.json({ categories: data.categories });
}

export async function PUT(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let normalizedCategories: FoodMenuCategorySaveItem[];
  try {
    normalizedCategories = normalizeCatalogPayload(await req.json());
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "메뉴를 저장하지 못했습니다." },
      { status: 400 }
    );
  }

  try {
    const next = await saveFoodMenuCatalog(normalizedCategories);
    return NextResponse.json({ categories: next.categories });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "메뉴를 저장하지 못했습니다." },
      { status: 400 }
    );
  }
}
