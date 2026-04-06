import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveSessionFromRequest } from "@/lib/active-session";

// 동반인 계정과 카카오 로그인 연동
export async function POST(req: NextRequest) {
  const session = await getActiveSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const { companionId } = await req.json();
  if (!companionId) {
    return NextResponse.json({ error: "동반인을 선택해주세요" }, { status: 400 });
  }

  const companion = await prisma.companion.findUnique({ where: { id: parseInt(companionId) } });
  if (!companion) {
    return NextResponse.json({ error: "동반인을 찾을 수 없습니다" }, { status: 404 });
  }

  if (companion.linkedKakaoId) {
    return NextResponse.json({ error: "이미 연동된 동반인입니다" }, { status: 409 });
  }

  const updated = await prisma.companion.update({
    where: { id: parseInt(companionId) },
    data: { linkedKakaoId: session.kakaoId },
  });

  return NextResponse.json(updated);
}
