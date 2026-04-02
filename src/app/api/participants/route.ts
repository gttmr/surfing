import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/session";

export async function POST(req: NextRequest) {
  const user = getSessionFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "카카오 로그인이 필요합니다" }, { status: 401 });
  }

  const body = await req.json();
  const { meetingId, name, note, companionIds } = body;

  if (!meetingId || !name?.trim()) {
    return NextResponse.json({ error: "이름을 입력해주세요" }, { status: 400 });
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id: parseInt(meetingId) },
    include: { participants: { select: { status: true, kakaoId: true, companionId: true } } },
  });

  if (!meeting) return NextResponse.json({ error: "모임을 찾을 수 없습니다" }, { status: 404 });
  if (!meeting.isOpen) return NextResponse.json({ error: "신청이 마감된 모임입니다" }, { status: 400 });

  // 같은 카카오 계정으로 중복 신청 확인 (취소된 건 제외)
  const existing = meeting.participants.find((p) => p.kakaoId === user.kakaoId && p.companionId === null && p.status !== "CANCELLED");
  if (existing) {
    return NextResponse.json({ error: "이미 신청하셨습니다" }, { status: 409 });
  }

  // 본인 신청 처리
  const cancelledRecord = await prisma.participant.findFirst({
    where: { meetingId: parseInt(meetingId), kakaoId: user.kakaoId, companionId: null, status: "CANCELLED" },
  });

  let participant;
  if (cancelledRecord) {
    participant = await prisma.participant.update({
      where: { id: cancelledRecord.id },
      data: {
        name: name.trim(),
        note: note?.trim() || null,
        status: "APPROVED",
        waitlistPosition: null,
        cancelledAt: null,
        submittedAt: new Date(),
      },
    });
  } else {
    participant = await prisma.participant.create({
      data: {
        meetingId: parseInt(meetingId),
        name: name.trim(),
        kakaoId: user.kakaoId,
        kakaoNickname: user.nickname,
        note: note?.trim() || null,
        status: "APPROVED",
      },
    });
  }

  // 동반인 신청 처리
  const companionResults: { companionId: number; name: string; status: string }[] = [];
  if (Array.isArray(companionIds) && companionIds.length > 0) {
    // 동반인들이 실제로 나의 동반인인지 확인
    const myCompanions = await prisma.companion.findMany({
      where: {
        id: { in: companionIds.map((id: number) => parseInt(String(id))) },
        ownerKakaoId: user.kakaoId,
      },
    });

    for (const companion of myCompanions) {
      // 이미 신청 확인
      const compExisting = await prisma.participant.findFirst({
        where: { meetingId: parseInt(meetingId), companionId: companion.id, status: { not: "CANCELLED" } },
      });
      if (compExisting) continue;

      await prisma.participant.create({
        data: {
          meetingId: parseInt(meetingId),
          name: companion.name,
          kakaoId: user.kakaoId,
          kakaoNickname: companion.name,
          companionId: companion.id,
          note: `${name.trim()}의 동반`,
          status: "APPROVED",
        },
      });
      companionResults.push({
        companionId: companion.id,
        name: companion.name,
        status: "APPROVED",
      });
    }
  }

  return NextResponse.json({ ...participant, companions: companionResults }, { status: 201 });
}
