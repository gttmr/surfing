import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveSessionFromRequest } from "@/lib/active-session";

// 아직 연동되지 않은 동반인 목록 조회 (동반인 가입 시 연동 선택용)
export async function GET(req: NextRequest) {
  const session = await getActiveSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const companions = await prisma.companion.findMany({
    where: { linkedKakaoId: null },
    select: { id: true, name: true, ownerKakaoId: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(companions);
}
