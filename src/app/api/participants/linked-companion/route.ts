import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveSessionFromRequest } from "@/lib/active-session";
import {
  InvalidParticipantOptionsError,
  normalizeParticipantOptions,
} from "@/lib/participant-options";
import { runSerializableTransaction } from "@/lib/transaction";

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
    where: { linkedKakaoId: session.kakaoId, archivedAt: null },
    include: { owner: { select: { name: true, kakaoId: true } } },
  });

  if (!companion) {
    return NextResponse.json({ linked: false, ownerApplied: false });
  }

  const ownerParticipant = await prisma.participant.findFirst({
    where: {
      meetingId: parseInt(meetingId),
      kakaoId: companion.ownerKakaoId,
      companionId: null,
      status: { not: "CANCELLED" },
    },
    select: { id: true },
  });

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
    ownerApplied: !!ownerParticipant,
    companion: { id: companion.id, name: companion.name, owner: companion.owner },
    participant: participant
      ? { id: participant.id, status: participant.status, hasLesson: participant.hasLesson, hasBus: participant.hasBus, hasRental: participant.hasRental }
      : null,
  });
}

// 카카오 로그인된 동반인이 직접 모임 참가 신청
export async function POST(req: NextRequest) {
  const session = await getActiveSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const { meetingId, hasLesson, hasBus, hasRental } = await req.json();
  if (!meetingId) {
    return NextResponse.json({ error: "meetingId가 필요합니다" }, { status: 400 });
  }

  let options;
  try {
    options = normalizeParticipantOptions({ hasLesson, hasBus, hasRental });
  } catch (error) {
    if (error instanceof InvalidParticipantOptionsError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const mid = parseInt(String(meetingId));

  const result = await runSerializableTransaction(async (tx) => {
    const companion = await tx.companion.findFirst({
      where: { linkedKakaoId: session.kakaoId, archivedAt: null },
      include: { owner: { select: { name: true, kakaoId: true } } },
    });

    if (!companion) {
      return { status: 403, body: { error: "연동된 동반인 정보가 없습니다" } };
    }

    const meeting = await tx.meeting.findUnique({
      where: { id: mid },
      select: { id: true, isOpen: true },
    });
    if (!meeting) {
      return { status: 404, body: { error: "모임을 찾을 수 없습니다" } };
    }
    if (!meeting.isOpen) {
      return { status: 400, body: { error: "신청이 마감된 모임입니다" } };
    }

    const ownerParticipant = await tx.participant.findFirst({
      where: {
        meetingId: mid,
        kakaoId: companion.ownerKakaoId,
        companionId: null,
        status: { not: "CANCELLED" },
      },
      select: { id: true, name: true },
    });
    if (!ownerParticipant) {
      return { status: 400, body: { error: "연동된 정회원이 먼저 이 모임에 참가 신청해야 합니다" } };
    }

    const existing = await tx.participant.findFirst({
      where: {
        meetingId: mid,
        companionId: companion.id,
        status: { not: "CANCELLED" },
      },
      select: { id: true },
    });
    if (existing) {
      return { status: 409, body: { error: "이미 신청하셨습니다" } };
    }

    const cancelledRecord = await tx.participant.findFirst({
      where: {
        meetingId: mid,
        companionId: companion.id,
        status: "CANCELLED",
      },
    });

    const participant = cancelledRecord
      ? await tx.participant.update({
          where: { id: cancelledRecord.id },
          data: {
            name: companion.name,
            kakaoId: companion.ownerKakaoId,
            kakaoNickname: companion.name,
            note: `${ownerParticipant.name}의 동반`,
            ...options,
            status: "APPROVED",
            waitlistPosition: null,
            cancelledAt: null,
            submittedAt: new Date(),
          },
        })
      : await tx.participant.create({
          data: {
            meetingId: mid,
            name: companion.name,
            kakaoId: companion.ownerKakaoId,
            kakaoNickname: companion.name,
            companionId: companion.id,
            note: `${ownerParticipant.name}의 동반`,
            ...options,
            status: "APPROVED",
          },
        });

    return {
      status: 201,
      body: {
        id: participant.id,
        status: participant.status,
        hasLesson: participant.hasLesson,
        hasBus: participant.hasBus,
        hasRental: participant.hasRental,
        companion: { id: companion.id, name: companion.name, owner: companion.owner },
      },
    };
  });

  return NextResponse.json(result.body, { status: result.status });
}
