import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/session";

export async function POST(req: NextRequest) {
  const user = getSessionFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "카카오 로그인이 필요합니다" }, { status: 401 });
  }

  const body = await req.json();
  const { meetingId, name, note } = body;

  if (!meetingId || !name?.trim()) {
    return NextResponse.json({ error: "이름을 입력해주세요" }, { status: 400 });
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id: parseInt(meetingId) },
    include: { participants: { select: { status: true, kakaoId: true } } },
  });

  if (!meeting) return NextResponse.json({ error: "모임을 찾을 수 없습니다" }, { status: 404 });
  if (!meeting.isOpen) return NextResponse.json({ error: "신청이 마감된 모임입니다" }, { status: 400 });

  // 같은 카카오 계정으로 중복 신청 확인 (취소된 건 제외)
  const existing = meeting.participants.find((p) => p.kakaoId === user.kakaoId && p.status !== "CANCELLED");
  if (existing) {
    return NextResponse.json({ error: "이미 신청하셨습니다" }, { status: 409 });
  }

  const approvedCount = meeting.participants.filter((p) => p.status === "APPROVED").length;
  const waitlistedCount = meeting.participants.filter((p) => p.status === "WAITLISTED").length;
  const isFull = approvedCount >= meeting.maxCapacity;

  const status = isFull ? "WAITLISTED" : "APPROVED";
  const waitlistPosition = isFull ? waitlistedCount + 1 : null;

  // 이전에 취소한 기록이 있으면 업데이트, 없으면 새로 생성
  const cancelled = meeting.participants.find((p) => p.kakaoId === user.kakaoId && p.status === "CANCELLED");

  let participant;
  if (cancelled) {
    participant = await prisma.participant.update({
      where: { meetingId_kakaoId: { meetingId: parseInt(meetingId), kakaoId: user.kakaoId } },
      data: {
        name: name.trim(),
        note: note?.trim() || null,
        status,
        waitlistPosition,
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
        status,
        waitlistPosition,
      },
    });
  }

  return NextResponse.json(participant, { status: 201 });
}
