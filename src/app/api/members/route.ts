import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/session";

// 회원 목록 조회
// ?type=regular → 정회원 목록 (동반인이 정회원 선택할 때)
// ?linkable=true → 동반인으로 추가 가능한 회원 목록 (정회원이 동반인 추가할 때)
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const linkable = searchParams.get("linkable") === "true";

  if (linkable) {
    // 동반인으로 추가 가능한 회원: 자기 자신 제외, 이미 다른 사람의 동반인이 아닌 회원
    const members = await prisma.user.findMany({
      where: {
        kakaoId: { not: session.kakaoId },
        OR: [
          { memberType: "REGULAR" },
          { memberType: "COMPANION", companionOfKakaoId: session.kakaoId }, // 이미 내 동반인
        ],
      },
      select: {
        kakaoId: true,
        name: true,
        profileImage: true,
        memberType: true,
        companionOfKakaoId: true,
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json(members);
  }

  // 기본: 정회원 목록 (동반인 본인이 정회원 선택용)
  const members = await prisma.user.findMany({
    where: {
      memberType: "REGULAR",
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
