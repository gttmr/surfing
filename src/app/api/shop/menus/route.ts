import { NextRequest, NextResponse } from "next/server";
import { canAccessShopPortalFromRequest } from "@/lib/auth";
import {
  getAdminFoodMenuSettingsData,
  type FoodMenuCategorySaveItem,
  saveFoodMenuCatalog,
} from "@/lib/food-ordering-data";
import { normalizeCatalogPayload } from "@/lib/food-menu-catalog-payload";

export async function GET(req: NextRequest) {
  if (!(await canAccessShopPortalFromRequest(req))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await getAdminFoodMenuSettingsData();
  return NextResponse.json({ categories: data.categories });
}

export async function PUT(req: NextRequest) {
  if (!(await canAccessShopPortalFromRequest(req))) {
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
