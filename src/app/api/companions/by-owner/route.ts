import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveSessionFromRequest } from "@/lib/active-session";

// 특정 정회원의 동반인 목록 조회 (동반인 가입 시 연동 선택용)
export async function GET(req: NextRequest) {
  const session = await getActiveSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const ownerKakaoId = req.nextUrl.searchParams.get("kakaoId");
  if (!ownerKakaoId) {
    return NextResponse.json({ error: "ownerKakaoId가 필요합니다" }, { status: 400 });
  }

  const companions = await prisma.companion.findMany({
    where: { ownerKakaoId },
    select: { id: true, name: true, linkedKakaoId: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(companions);
}
