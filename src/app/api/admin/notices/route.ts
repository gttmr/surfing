import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const notices = await prisma.notice.findMany({
    orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
  });

  return NextResponse.json(notices);
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const title = String(body.title ?? "").trim();
  const bodyText = String(body.body ?? "").trim();
  const isPinned = Boolean(body.isPinned);

  if (!title || !bodyText) {
    return NextResponse.json({ error: "제목과 내용을 입력해 주세요" }, { status: 400 });
  }

  const notice = await prisma.$transaction(async (tx) => {
    if (isPinned) {
      await tx.notice.updateMany({
        where: { isPinned: true },
        data: { isPinned: false },
      });
    }

    return tx.notice.create({
      data: { title, body: bodyText, isPinned },
    });
  });

  return NextResponse.json(notice, { status: 201 });
}
