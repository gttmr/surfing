import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/session";

// 내 프로필 정보 가져오기
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { kakaoId: session.kakaoId },
    include: {
      _count: {
        select: {
          participants: true,
        },
      },
      companionOf: {
        select: { kakaoId: true, name: true },
      },
    },
  });

  if (!user) {
    return NextResponse.json({ error: "회원 정보를 찾을 수 없습니다" }, { status: 404 });
  }

  return NextResponse.json(user);
}

// 내 프로필 수정
export async function PUT(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const body = await req.json();
  const { name, phoneNumber, memberType, companionOfKakaoId } = body;

  const trimmedName = name !== undefined ? (name.trim() || null) : undefined;

  // memberType 유효성 검사
  if (memberType !== undefined && !["REGULAR", "COMPANION"].includes(memberType)) {
    return NextResponse.json({ error: "잘못된 회원 유형입니다" }, { status: 400 });
  }

  // COMPANION인 경우 companionOfKakaoId 필수
  if (memberType === "COMPANION" && !companionOfKakaoId) {
    return NextResponse.json({ error: "동반인은 정회원을 선택해야 합니다" }, { status: 400 });
  }

  // REGULAR로 변경 시 companionOfKakaoId 초기화
  const updateData: Record<string, unknown> = {};
  if (trimmedName !== undefined) updateData.name = trimmedName;
  if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber.trim() || null;
  if (memberType !== undefined) {
    updateData.memberType = memberType;
    updateData.companionOfKakaoId = memberType === "COMPANION" ? companionOfKakaoId : null;
  }

  const user = await prisma.user.update({
    where: { kakaoId: session.kakaoId },
    data: updateData,
    include: {
      _count: {
        select: {
          participants: true,
        },
      },
      companionOf: {
        select: { kakaoId: true, name: true },
      },
    },
  });

  // 이름 변경 시 기존 신청 기록의 이름도 동기화
  if (trimmedName) {
    await prisma.participant.updateMany({
      where: { kakaoId: session.kakaoId },
      data: { name: trimmedName },
    });
  }

  return NextResponse.json(user);
}
