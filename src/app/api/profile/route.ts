import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/session";
import { withResolvedProfileImage } from "@/lib/profile-image";

// 내 프로필 정보 가져오기
export async function GET(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const user = await prisma.user.upsert({
    where: { kakaoId: session.kakaoId },
    update: {
      profileImage: session.profileImage || null,
    },
    create: {
      kakaoId: session.kakaoId,
      name: session.nickname || null,
      profileImage: session.profileImage || null,
      role: "MEMBER",
    },
    include: {
      _count: {
        select: {
          participants: true,
        },
      },
    },
  });

  return NextResponse.json(withResolvedProfileImage(user));
}

// 내 프로필 수정
export async function PUT(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const body = await req.json();
  const { name, phoneNumber, memberType, customProfileImageUrl } = body;

  const trimmedName = name !== undefined ? (name.trim() || null) : undefined;

  // memberType은 최초 설정 시에만 허용 (이름이 없는 상태 = 초기 설정)
  const existing = await prisma.user.findUnique({ where: { kakaoId: session.kakaoId } });
  const canSetMemberType = memberType && !existing?.name; // 이름이 없을 때만 설정 가능

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
