import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import {
  getAdminFoodMenuSettingsData,
  saveFoodMenuCatalog,
} from "@/lib/food-ordering-data";

type BulkMenuPayloadItem = {
  id?: number | null;
  name?: string;
  price?: number;
  isActive?: boolean;
};

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const data = await getAdminFoodMenuSettingsData();
  return NextResponse.json({ menus: data.menus });
}

export async function PUT(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const menus = Array.isArray(body?.menus) ? (body.menus as BulkMenuPayloadItem[]) : null;

  if (!menus || menus.length === 0) {
    return NextResponse.json({ error: "최소 한 개 이상의 메뉴가 필요합니다." }, { status: 400 });
  }

  let normalizedMenus: Array<{
    id: number | null;
    name: string;
    price: number;
    isActive: boolean;
    displayOrder: number;
  }>;
  try {
    normalizedMenus = menus.map((menu, index) => {
      const id = menu?.id === null || menu?.id === undefined ? null : Number(menu.id);
      const name = typeof menu?.name === "string" ? menu.name.trim() : "";
      const price = Number(menu?.price);
      const isActive = menu?.isActive !== false;

      if (id !== null && !Number.isInteger(id)) {
        throw new Error("잘못된 메뉴가 포함되어 있습니다.");
      }
      if (!name) {
        throw new Error("메뉴 이름을 입력해 주세요.");
      }
      if (!Number.isInteger(price) || price < 0) {
        throw new Error("가격은 0 이상의 정수여야 합니다.");
      }

      return {
        id,
        name,
        price,
        isActive,
        displayOrder: index,
      };
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "메뉴를 저장하지 못했습니다." },
      { status: 400 }
    );
  }

  try {
    const next = await saveFoodMenuCatalog(normalizedMenus);
    return NextResponse.json({ menus: next.menus });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "메뉴를 저장하지 못했습니다." },
      { status: 400 }
    );
  }
}
