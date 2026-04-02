import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/session";

// 정회원 목록 조회 (동반인 선택 등 범용)
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const members = await prisma.user.findMany({
    where: {
      kakaoId: { not: session.kakaoId },
    },
    select: {
      kakaoId: true,
      name: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(members);
}
