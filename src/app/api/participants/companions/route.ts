import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveSessionFromRequest } from "@/lib/active-session";

// 참가 완료 후 동반인 추가 신청
export async function POST(req: NextRequest) {
  const user = await getActiveSessionFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const { meetingId, companionId, hasLesson, hasBus, hasRental } = await req.json();
  if (!meetingId || !companionId) {
    return NextResponse.json({ error: "필수 정보가 누락되었습니다" }, { status: 400 });
  }

  const mid = parseInt(meetingId);
  const cid = parseInt(companionId);

  // 본인이 이 모임에 참가 중인지 확인
  const myParticipant = await prisma.participant.findFirst({
    where: { meetingId: mid, kakaoId: user.kakaoId, companionId: null, status: { not: "CANCELLED" } },
  });
  if (!myParticipant) {
    return NextResponse.json({ error: "본인이 먼저 참가 신청을 해야 합니다" }, { status: 400 });
  }

  // 동반인이 실제로 나의 동반인인지 확인
  const companion = await prisma.companion.findUnique({ where: { id: cid } });
  if (!companion || companion.ownerKakaoId !== user.kakaoId) {
    return NextResponse.json({ error: "내 동반인이 아닙니다" }, { status: 403 });
  }

  // 모임 확인
  const meeting = await prisma.meeting.findUnique({ where: { id: mid } });
  if (!meeting) return NextResponse.json({ error: "모임을 찾을 수 없습니다" }, { status: 404 });
  if (!meeting.isOpen) return NextResponse.json({ error: "신청이 마감된 모임입니다" }, { status: 400 });

  // 취소된 기존 기록 확인
  const cancelledRecord = await prisma.participant.findFirst({
    where: { meetingId: mid, companionId: cid, status: "CANCELLED" },
  });

  // 이미 신청(활성) 여부 확인
  const existing = await prisma.participant.findFirst({
    where: { meetingId: mid, companionId: cid, status: { not: "CANCELLED" } },
  });
  if (existing) {
    return NextResponse.json({ error: "이미 신청된 동반인입니다" }, { status: 409 });
  }

  let result;
  if (cancelledRecord) {
    result = await prisma.participant.update({
      where: { id: cancelledRecord.id },
      data: {
        hasLesson: !!hasLesson,
        hasBus: !!hasBus,
        hasRental: !!hasRental,
        status: "APPROVED",
        cancelledAt: null,
        submittedAt: new Date(),
      },
    });
  } else {
    result = await prisma.participant.create({
      data: {
        meetingId: mid,
        name: companion.name,
        kakaoId: user.kakaoId,
        kakaoNickname: companion.name,
        companionId: cid,
        note: `${myParticipant.name}의 동반`,
        hasLesson: !!hasLesson,
        hasBus: !!hasBus,
        hasRental: !!hasRental,
        status: "APPROVED",
      },
    });
  }

  return NextResponse.json(result, { status: 201 });
}

// 동반인 개별 취소
export async function DELETE(req: NextRequest) {
  const user = await getActiveSessionFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const { meetingId, companionId } = await req.json();
  if (!meetingId || !companionId) {
    return NextResponse.json({ error: "필수 정보가 누락되었습니다" }, { status: 400 });
  }

  const mid = parseInt(meetingId);
  const cid = parseInt(companionId);

  // 동반인이 나의 것인지 확인
  const companion = await prisma.companion.findUnique({ where: { id: cid } });
  if (!companion || companion.ownerKakaoId !== user.kakaoId) {
    return NextResponse.json({ error: "내 동반인이 아닙니다" }, { status: 403 });
  }

  const participant = await prisma.participant.findFirst({
    where: { meetingId: mid, companionId: cid, status: { not: "CANCELLED" } },
  });
  if (!participant) {
    return NextResponse.json({ error: "취소할 신청이 없습니다" }, { status: 404 });
  }

  await prisma.participant.update({
    where: { id: participant.id },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
