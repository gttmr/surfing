import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveSessionFromRequest } from "@/lib/active-session";
import { withResolvedProfileImage } from "@/lib/profile-image";

// 내 프로필 정보 가져오기
export async function GET(req: NextRequest) {
  const session = await getActiveSessionFromRequest(req);
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
    },
  });
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  return NextResponse.json(withResolvedProfileImage(user));
}

// 내 프로필 수정
export async function PUT(req: NextRequest) {
  const session = await getActiveSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const body = await req.json();
  const { name, phoneNumber, memberType, customProfileImageUrl, forceMemberTypeSetup } = body;

  const trimmedName = name !== undefined ? (name.trim() || null) : undefined;

  // memberType은 기본적으로 최초 설정 시에만 허용한다.
  // setup 플로우가 명시적으로 요청한 경우에는 다시 선택할 수 있다.
  const existing = await prisma.user.findUnique({ where: { kakaoId: session.kakaoId } });
  if (!existing) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }
  const canSetMemberType = Boolean(memberType) && (!existing?.name || forceMemberTypeSetup === true);

  const user = await prisma.user.update({
    where: { kakaoId: session.kakaoId },
    data: {
      ...(trimmedName !== undefined && { name: trimmedName }),
      ...(phoneNumber !== undefined && { phoneNumber: phoneNumber.trim() || null }),
      ...(canSetMemberType && { memberType }),
      ...(customProfileImageUrl !== undefined && { customProfileImageUrl: customProfileImageUrl || null }),
    },
    include: {
      _count: {
        select: {
          participants: true,
        },
      },
    },
  });

  // 이름 변경 시 기존 신청 기록의 이름도 동기화 (본인 참가분만, 동반인 참가는 제외)
  if (trimmedName) {
    await prisma.participant.updateMany({
      where: { kakaoId: session.kakaoId, companionId: null },
      data: { name: trimmedName },
    });
  }

  return NextResponse.json(withResolvedProfileImage(user));
}
