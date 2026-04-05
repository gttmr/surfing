import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";

function parseNoticeId(value: string) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: rawId } = await params;
  const id = parseNoticeId(rawId);
  if (!id) {
    return NextResponse.json({ error: "잘못된 공지 ID입니다" }, { status: 400 });
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
        where: { isPinned: true, NOT: { id } },
        data: { isPinned: false },
      });
    }

    return tx.notice.update({
      where: { id },
      data: { title, body: bodyText, isPinned },
    });
  });

  return NextResponse.json(notice);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: rawId } = await params;
  const id = parseNoticeId(rawId);
  if (!id) {
    return NextResponse.json({ error: "잘못된 공지 ID입니다" }, { status: 400 });
  }

  await prisma.notice.delete({
    where: { id },
  });

  return NextResponse.json({ ok: true });
}
