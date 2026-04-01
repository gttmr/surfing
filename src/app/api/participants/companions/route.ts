import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/session";

// 참가 완료 후 동반인 추가 신청
export async function POST(req: NextRequest) {
  const user = getSessionFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const { meetingId, companionKakaoId } = await req.json();
  if (!meetingId || !companionKakaoId) {
    return NextResponse.json({ error: "필수 정보가 누락되었습니다" }, { status: 400 });
  }

  const mid = parseInt(meetingId);

  // 본인이 이 모임에 참가 중인지 확인
  const myParticipant = await prisma.participant.findUnique({
    where: { meetingId_kakaoId: { meetingId: mid, kakaoId: user.kakaoId } },
  });
  if (!myParticipant || myParticipant.status === "CANCELLED") {
    return NextResponse.json({ error: "본인이 먼저 참가 신청을 해야 합니다" }, { status: 400 });
  }

  // 동반인이 실제로 나의 동반인인지 확인
  const companion = await prisma.user.findUnique({
    where: { kakaoId: companionKakaoId },
    select: { kakaoId: true, name: true, memberType: true, companionOfKakaoId: true },
  });
  if (!companion || companion.memberType !== "COMPANION" || companion.companionOfKakaoId !== user.kakaoId) {
    return NextResponse.json({ error: "내 동반인이 아닙니다" }, { status: 403 });
  }

  // 모임 확인
  const meeting = await prisma.meeting.findUnique({ where: { id: mid } });
  if (!meeting) return NextResponse.json({ error: "모임을 찾을 수 없습니다" }, { status: 404 });
  if (!meeting.isOpen) return NextResponse.json({ error: "신청이 마감된 모임입니다" }, { status: 400 });

  // 이미 신청 여부 확인
  const existing = await prisma.participant.findUnique({
    where: { meetingId_kakaoId: { meetingId: mid, kakaoId: companionKakaoId } },
  });

  if (existing && existing.status !== "CANCELLED") {
    return NextResponse.json({ error: "이미 신청된 동반인입니다" }, { status: 409 });
  }

  const participantName = companion.name || "동반인";
  const myName = myParticipant.name;

  let result;
  if (existing && existing.status === "CANCELLED") {
    result = await prisma.participant.update({
      where: { meetingId_kakaoId: { meetingId: mid, kakaoId: companionKakaoId } },
      data: {
        name: participantName,
        note: `${myName}의 동반`,
        status: "APPROVED",
        waitlistPosition: null,
        cancelledAt: null,
        submittedAt: new Date(),
      },
    });
  } else {
    result = await prisma.participant.create({
      data: {
        meetingId: mid,
        name: participantName,
        kakaoId: companionKakaoId,
        kakaoNickname: participantName,
        note: `${myName}의 동반`,
        status: "APPROVED",
      },
    });
  }

  return NextResponse.json(result, { status: 201 });
}

// 동반인 개별 취소 (정회원이 자기 동반인의 참가를 취소)
export async function DELETE(req: NextRequest) {
  const user = getSessionFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const { meetingId, companionKakaoId } = await req.json();
  if (!meetingId || !companionKakaoId) {
    return NextResponse.json({ error: "필수 정보가 누락되었습니다" }, { status: 400 });
  }

  const mid = parseInt(meetingId);

  // 동반인이 실제로 나의 동반인인지 확인
  const companion = await prisma.user.findUnique({
    where: { kakaoId: companionKakaoId },
    select: { memberType: true, companionOfKakaoId: true },
  });
  if (!companion || companion.memberType !== "COMPANION" || companion.companionOfKakaoId !== user.kakaoId) {
    return NextResponse.json({ error: "내 동반인이 아닙니다" }, { status: 403 });
  }

  const participant = await prisma.participant.findUnique({
    where: { meetingId_kakaoId: { meetingId: mid, kakaoId: companionKakaoId } },
  });
  if (!participant || participant.status === "CANCELLED") {
    return NextResponse.json({ error: "취소할 신청이 없습니다" }, { status: 404 });
  }

  await prisma.participant.update({
    where: { id: participant.id },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
