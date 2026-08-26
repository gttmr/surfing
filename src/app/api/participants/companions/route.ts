import { NextRequest, NextResponse } from "next/server";
import type { Participant } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getActiveSessionFromRequest } from "@/lib/active-session";
import {
  InvalidParticipantOptionsError,
  normalizeParticipantOptions,
} from "@/lib/participant-options";
import { createParticipantWithRecoveredSequence } from "@/lib/participant-sequence";
import { runSerializableTransaction } from "@/lib/transaction";

// 참가 완료 후 동반인 추가 신청
export async function POST(req: NextRequest) {
  const user = await getActiveSessionFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const { meetingId, companionId, hasLesson, hasBus, hasRental, day2HasRental, usesClubLodging } = await req.json();
  if (!meetingId || !companionId) {
    return NextResponse.json({ error: "필수 정보가 누락되었습니다" }, { status: 400 });
  }

  let options;
  try {
    if ([day2HasRental, usesClubLodging].some((value) => value !== undefined && typeof value !== "boolean")) {
      return NextResponse.json({ error: "참가 옵션을 확인해 주세요." }, { status: 400 });
    }
    options = normalizeParticipantOptions({ hasLesson, hasBus, hasRental });
  } catch (error) {
    if (error instanceof InvalidParticipantOptionsError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  const mid = parseInt(meetingId);
  const cid = parseInt(companionId);

  const result = await runSerializableTransaction(async (tx) => {
    const meeting = await tx.meeting.findUnique({
      where: { id: mid },
      include: {
        meetingGroup: {
          include: { meetings: { orderBy: { groupDayIndex: "asc" } } },
        },
      },
    });
    if (!meeting) {
      return { status: 404, body: { error: "모임을 찾을 수 없습니다" } };
    }
    const day1 = meeting.meetingGroup?.meetings.find((day) => day.groupDayIndex === 1) ?? meeting;
    const day2 = meeting.meetingGroup?.meetings.find((day) => day.groupDayIndex === 2) ?? null;
    const targetMeetings = day2 ? [day1, day2] : [day1];
    if (targetMeetings.some((day) => !day.isOpen)) {
      return { status: 400, body: { error: "신청이 마감된 모임입니다" } };
    }

    const myParticipant = await tx.participant.findFirst({
      where: {
        meetingId: day1.id,
        kakaoId: user.kakaoId,
        companionId: null,
        status: { not: "CANCELLED" },
      },
    });
    if (!myParticipant) {
      return { status: 400, body: { error: "본인이 먼저 참가 신청을 해야 합니다" } };
    }

    const companion = await tx.companion.findUnique({ where: { id: cid } });
    if (!companion || companion.ownerKakaoId !== user.kakaoId || companion.archivedAt) {
      return { status: 403, body: { error: "내 동반인이 아닙니다" } };
    }

    const existing = await tx.participant.findFirst({
      where: { meetingId: { in: targetMeetings.map((day) => day.id) }, companionId: cid, status: { not: "CANCELLED" } },
      select: { id: true },
    });
    if (existing) {
      return { status: 409, body: { error: "이미 신청된 동반인입니다" } };
    }

    const created: Participant[] = [];
    for (const [index, targetMeeting] of targetMeetings.entries()) {
      const targetOptions = index === 0
        ? options
        : { hasLesson: false, hasBus: options.hasBus, hasRental: !!day2HasRental };
      const cancelledRecord = await tx.participant.findFirst({
        where: { meetingId: targetMeeting.id, companionId: cid, status: "CANCELLED" },
        orderBy: { submittedAt: "desc" },
      });
      const participant = cancelledRecord
        ? await tx.participant.update({
            where: { id: cancelledRecord.id },
            data: {
              ...targetOptions,
              usesClubLodging: !!usesClubLodging,
              status: "APPROVED",
              waitlistPosition: null,
              cancelledAt: null,
              submittedAt: new Date(),
            },
          })
        : await createParticipantWithRecoveredSequence(tx, {
            meetingId: targetMeeting.id,
            name: companion.name,
            kakaoId: user.kakaoId,
            kakaoNickname: companion.name,
            companionId: cid,
            note: `${myParticipant.name}의 동반`,
            ...targetOptions,
            usesClubLodging: !!usesClubLodging,
            status: "APPROVED",
          });
      created.push(participant);
    }

    return {
      status: 201,
      body: {
        ...created[0],
        day2ParticipantId: created[1]?.id,
        day2HasRental: created[1]?.hasRental ?? false,
        usesClubLodging: created[0]?.usesClubLodging ?? false,
      },
    };
  });

  return NextResponse.json(result.body, { status: result.status });
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
  if (!companion || companion.ownerKakaoId !== user.kakaoId || companion.archivedAt) {
    return NextResponse.json({ error: "내 동반인이 아닙니다" }, { status: 403 });
  }

  const meeting = await prisma.meeting.findUnique({
    where: { id: mid },
    include: { meetingGroup: { include: { meetings: true } } },
  });
  if (!meeting) return NextResponse.json({ error: "모임을 찾을 수 없습니다" }, { status: 404 });
  const meetingIds = meeting.meetingGroup?.meetings.map((day) => day.id) ?? [meeting.id];

  const participant = await prisma.participant.findFirst({
    where: { meetingId: { in: meetingIds }, companionId: cid, status: { not: "CANCELLED" } },
  });
  if (!participant) {
    return NextResponse.json({ error: "취소할 신청이 없습니다" }, { status: 404 });
  }

  await prisma.participant.updateMany({
    where: { meetingId: { in: meetingIds }, companionId: cid, status: { not: "CANCELLED" } },
    data: { status: "CANCELLED", cancelledAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
