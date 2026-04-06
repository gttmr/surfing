import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveSessionFromRequest } from "@/lib/active-session";

// 정회원 목록 조회 (동반인 등록 시 선택용)
export async function GET(req: NextRequest) {
  const session = await getActiveSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const members = await prisma.user.findMany({
    where: {
      memberType: "REGULAR",
      kakaoId: { not: session.kakaoId },
      companions: {
        some: {},
      },
    },
    select: {
      kakaoId: true,
      name: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(members);
}
