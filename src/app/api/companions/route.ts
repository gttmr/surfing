import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveSessionFromRequest } from "@/lib/active-session";

// 내 동반인 목록 조회
export async function GET(req: NextRequest) {
  const session = await getActiveSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const companions = await prisma.companion.findMany({
    where: { ownerKakaoId: session.kakaoId, archivedAt: null },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(companions);
}

// 동반인 추가 (이름 입력)
export async function POST(req: NextRequest) {
  const session = await getActiveSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const { name } = await req.json();
  if (!name?.trim()) {
    return NextResponse.json({ error: "이름을 입력해주세요" }, { status: 400 });
  }

  const companion = await prisma.companion.create({
    data: {
      name: name.trim(),
      ownerKakaoId: session.kakaoId,
    },
  });

  return NextResponse.json(companion, { status: 201 });
}

// 동반인 삭제
export async function DELETE(req: NextRequest) {
  const session = await getActiveSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const { id } = await req.json();
  if (!id) {
    return NextResponse.json({ error: "삭제할 동반인을 선택해주세요" }, { status: 400 });
  }

  // 본인의 동반인인지 확인
  const companion = await prisma.companion.findUnique({ where: { id: parseInt(id) } });
  if (!companion || companion.ownerKakaoId !== session.kakaoId || companion.archivedAt) {
    return NextResponse.json({ error: "내 동반인이 아닙니다" }, { status: 403 });
  }

  await prisma.companion.delete({ where: { id: parseInt(id) } });

  return NextResponse.json({ ok: true });
}
