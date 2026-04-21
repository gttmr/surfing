import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const menuId = Number(id);

  if (!Number.isInteger(menuId)) {
    return NextResponse.json({ error: "잘못된 메뉴입니다." }, { status: 400 });
  }

  const body = await req.json();
  const data: {
    categoryId?: number;
    name?: string;
    price?: number;
    isActive?: boolean;
    displayOrder?: number;
  } = {};

  if (body?.categoryId !== undefined) {
    const categoryId = Number(body.categoryId);
    if (!Number.isInteger(categoryId)) {
      return NextResponse.json({ error: "카테고리를 선택해 주세요." }, { status: 400 });
    }
    data.categoryId = categoryId;
  }

  if (body?.name !== undefined) {
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "메뉴 이름을 입력해 주세요." }, { status: 400 });
    }
    data.name = name;
  }

  if (body?.price !== undefined) {
    const price = Number(body.price);
    if (!Number.isInteger(price) || price < 0) {
      return NextResponse.json({ error: "가격은 0 이상의 정수여야 합니다." }, { status: 400 });
    }
    data.price = price;
  }

  if (body?.isActive !== undefined) {
    data.isActive = Boolean(body.isActive);
  }

  if (body?.displayOrder !== undefined) {
    const displayOrder = Number(body.displayOrder);
    if (!Number.isInteger(displayOrder) || displayOrder < 0) {
      return NextResponse.json({ error: "순서는 0 이상의 정수여야 합니다." }, { status: 400 });
    }
    data.displayOrder = displayOrder;
  }

  const menu = await prisma.foodMenuItem.update({
    where: { id: menuId },
    data,
  });

  return NextResponse.json(menu);
}
