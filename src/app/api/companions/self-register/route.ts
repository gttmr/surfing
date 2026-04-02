import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/session";

// 동반인이 특정 정회원의 동반인으로 자기 자신을 등록 (카카오 로그인 연동)
export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const { ownerKakaoId, name } = await req.json();
  if (!ownerKakaoId?.trim() || !name?.trim()) {
    return NextResponse.json({ error: "정회원과 이름을 입력해주세요" }, { status: 400 });
  }

  // 이미 해당 정회원의 동반인으로 연동된 경우 확인
  const alreadyLinked = await prisma.companion.findFirst({
    where: { ownerKakaoId, linkedKakaoId: session.kakaoId },
  });
  if (alreadyLinked) {
    return NextResponse.json({ error: "이미 해당 정회원의 동반인으로 등록되어 있습니다" }, { status: 409 });
  }

  const companion = await prisma.companion.create({
    data: {
      name: name.trim(),
      ownerKakaoId,
      linkedKakaoId: session.kakaoId,
    },
  });

  return NextResponse.json(companion, { status: 201 });
}
