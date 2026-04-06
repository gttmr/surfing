import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveSessionFromRequest } from "@/lib/active-session";

// 카카오 로그인된 동반인의 특정 모임 참가 현황 조회
export async function GET(req: NextRequest) {
  const session = await getActiveSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const meetingId = req.nextUrl.searchParams.get("meetingId");
  if (!meetingId) {
    return NextResponse.json({ error: "meetingId가 필요합니다" }, { status: 400 });
  }

  // 현재 사용자와 연동된 companion 찾기
  const companion = await prisma.companion.findFirst({
    where: { linkedKakaoId: session.kakaoId },
    include: { owner: { select: { name: true, kakaoId: true } } },
  });

  if (!companion) {
    return NextResponse.json({ linked: false });
  }

  // 해당 모임의 참가 현황 찾기
  const participant = await prisma.participant.findFirst({
    where: {
      meetingId: parseInt(meetingId),
      companionId: companion.id,
      status: { not: "CANCELLED" },
    },
  });

  return NextResponse.json({
    linked: true,
    companion: { id: companion.id, name: companion.name, owner: companion.owner },
    participant: participant
      ? { id: participant.id, status: participant.status, hasLesson: participant.hasLesson, hasBus: participant.hasBus, hasRental: participant.hasRental }
      : null,
  });
}
