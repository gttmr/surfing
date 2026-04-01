import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/session";

export async function POST(req: NextRequest) {
  const user = getSessionFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "카카오 로그인이 필요합니다" }, { status: 401 });
  }

  const body = await req.json();
  const { meetingId, name, note, companionKakaoIds } = body;

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

  // 본인 신청 처리
  const cancelled = meeting.participants.find((p) => p.kakaoId === user.kakaoId && p.status === "CANCELLED");

  let participant;
  if (cancelled) {
    participant = await prisma.participant.update({
      where: { meetingId_kakaoId: { meetingId: parseInt(meetingId), kakaoId: user.kakaoId } },
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
  const companionResults: { kakaoId: string; name: string; status: string }[] = [];
  if (Array.isArray(companionKakaoIds) && companionKakaoIds.length > 0) {
    // 동반인들이 실제로 나의 동반인인지 확인
    const myCompanions = await prisma.user.findMany({
      where: {
        kakaoId: { in: companionKakaoIds },
        memberType: "COMPANION",
        companionOfKakaoId: user.kakaoId,
      },
      select: { kakaoId: true, name: true },
    });

    for (const companion of myCompanions) {
      const compExisting = meeting.participants.find(
        (p) => p.kakaoId === companion.kakaoId && p.status !== "CANCELLED"
      );
      if (compExisting) continue; // 이미 신청된 동반인은 건너뜀

      const compCancelled = meeting.participants.find(
        (p) => p.kakaoId === companion.kakaoId && p.status === "CANCELLED"
      );

      if (compCancelled) {
        await prisma.participant.update({
          where: { meetingId_kakaoId: { meetingId: parseInt(meetingId), kakaoId: companion.kakaoId } },
          data: {
            name: companion.name || "동반인",
            note: `${name.trim()}의 동반`,
            status: "APPROVED",
            waitlistPosition: null,
            cancelledAt: null,
            submittedAt: new Date(),
          },
        });
      } else {
        await prisma.participant.create({
          data: {
            meetingId: parseInt(meetingId),
            name: companion.name || "동반인",
            kakaoId: companion.kakaoId,
            kakaoNickname: companion.name || "동반인",
            note: `${name.trim()}의 동반`,
            status: "APPROVED",
          },
        });
      }
      companionResults.push({
        kakaoId: companion.kakaoId,
        name: companion.name || "동반인",
        status: "APPROVED",
      });
    }
  }

  return NextResponse.json({ ...participant, companions: companionResults }, { status: 201 });
}
