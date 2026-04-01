import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/session";

// 내 동반인 목록 조회 (정회원용)
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const companions = await prisma.user.findMany({
    where: { companionOfKakaoId: session.kakaoId },
    select: {
      id: true,
      kakaoId: true,
      name: true,
      profileImage: true,
      memberType: true,
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(companions);
}

// 동반인 추가 (정회원이 기존 회원을 자신의 동반인으로 지정)
export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  // 요청자가 정회원인지 확인
  const me = await prisma.user.findUnique({
    where: { kakaoId: session.kakaoId },
    select: { memberType: true },
  });
  if (!me || me.memberType !== "REGULAR") {
    return NextResponse.json({ error: "정회원만 동반인을 추가할 수 있습니다" }, { status: 403 });
  }

  const { kakaoId } = await req.json();
  if (!kakaoId) {
    return NextResponse.json({ error: "대상 회원을 선택해주세요" }, { status: 400 });
  }

  // 자기 자신은 추가 불가
  if (kakaoId === session.kakaoId) {
    return NextResponse.json({ error: "자기 자신은 동반인으로 추가할 수 없습니다" }, { status: 400 });
  }

  // 대상 회원 확인
  const target = await prisma.user.findUnique({
    where: { kakaoId },
    select: { memberType: true, companionOfKakaoId: true },
  });
  if (!target) {
    return NextResponse.json({ error: "회원을 찾을 수 없습니다" }, { status: 404 });
  }
  if (target.memberType === "COMPANION" && target.companionOfKakaoId && target.companionOfKakaoId !== session.kakaoId) {
    return NextResponse.json({ error: "이미 다른 정회원의 동반인으로 등록된 회원입니다" }, { status: 409 });
  }

  // 동반인으로 지정
  const updated = await prisma.user.update({
    where: { kakaoId },
    data: {
      memberType: "COMPANION",
      companionOfKakaoId: session.kakaoId,
    },
    select: {
      id: true,
      kakaoId: true,
      name: true,
      profileImage: true,
      memberType: true,
    },
  });

  return NextResponse.json(updated, { status: 201 });
}

// 동반인 해제
export async function DELETE(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const { kakaoId } = await req.json();
  if (!kakaoId) {
    return NextResponse.json({ error: "대상 회원을 선택해주세요" }, { status: 400 });
  }

  // 해당 회원이 나의 동반인인지 확인
  const target = await prisma.user.findUnique({
    where: { kakaoId },
    select: { companionOfKakaoId: true },
  });
  if (!target || target.companionOfKakaoId !== session.kakaoId) {
    return NextResponse.json({ error: "내 동반인이 아닙니다" }, { status: 403 });
  }

  await prisma.user.update({
    where: { kakaoId },
    data: {
      memberType: "REGULAR",
      companionOfKakaoId: null,
    },
  });

  return NextResponse.json({ ok: true });
}
