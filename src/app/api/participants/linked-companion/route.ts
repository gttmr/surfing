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
  const meetingIdNumber = parseInt(meetingId);
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingIdNumber },
    include: { meetingGroup: { include: { meetings: { orderBy: { groupDayIndex: "asc" } } } } },
  });
  if (!meeting) return NextResponse.json({ error: "모임을 찾을 수 없습니다" }, { status: 404 });
  const day1MeetingId = meeting.meetingGroup?.meetings.find((day) => day.groupDayIndex === 1)?.id ?? meeting.id;
  const day2MeetingId = meeting.meetingGroup?.meetings.find((day) => day.groupDayIndex === 2)?.id;

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
      meetingId: day1MeetingId,
      kakaoId: companion.ownerKakaoId,
      companionId: null,
      status: { not: "CANCELLED" },
    },
    select: { id: true },
  });

  // 해당 모임의 참가 현황 찾기
  const participant = await prisma.participant.findFirst({
    where: {
      meetingId: day1MeetingId,
      companionId: companion.id,
      status: { not: "CANCELLED" },
    },
  });
  const day2Participant = day2MeetingId ? await prisma.participant.findFirst({
    where: {
      meetingId: day2MeetingId,
      companionId: companion.id,
      status: { not: "CANCELLED" },
    },
  }) : null;

  return NextResponse.json({
    linked: true,
    ownerApplied: !!ownerParticipant,
    companion: { id: companion.id, name: companion.name, owner: companion.owner },
    participant: participant
      ? {
          id: participant.id,
          status: participant.status,
          hasLesson: participant.hasLesson,
          hasBus: participant.hasBus,
          hasRental: participant.hasRental,
          day2ParticipantId: day2Participant?.id,
          day2HasRental: day2Participant?.hasRental ?? false,
          usesClubLodging: participant.usesClubLodging,
        }
      : null,
  });
}

// 카카오 로그인된 동반인이 직접 모임 참가 신청
export async function POST(req: NextRequest) {
  const session = await getActiveSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const { meetingId, hasLesson, hasBus, hasRental, day2HasRental, usesClubLodging } = await req.json();
  if (!meetingId) {
    return NextResponse.json({ error: "meetingId가 필요합니다" }, { status: 400 });
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
      include: { meetingGroup: { include: { meetings: { orderBy: { groupDayIndex: "asc" } } } } },
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

    const ownerParticipant = await tx.participant.findFirst({
      where: {
        meetingId: day1.id,
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
        meetingId: { in: targetMeetings.map((day) => day.id) },
        companionId: companion.id,
        status: { not: "CANCELLED" },
      },
      select: { id: true },
    });
    if (existing) {
      return { status: 409, body: { error: "이미 신청하셨습니다" } };
    }

    const created: Participant[] = [];
    for (const [index, targetMeeting] of targetMeetings.entries()) {
      const targetOptions = index === 0
        ? options
        : { hasLesson: false, hasBus: options.hasBus, hasRental: !!day2HasRental };
      const cancelledRecord = await tx.participant.findFirst({
        where: {
          meetingId: targetMeeting.id,
          companionId: companion.id,
          status: "CANCELLED",
        },
        orderBy: { submittedAt: "desc" },
      });

      const participant = cancelledRecord
        ? await tx.participant.update({
            where: { id: cancelledRecord.id },
            data: {
              name: companion.name,
              kakaoId: companion.ownerKakaoId,
              kakaoNickname: companion.name,
              note: `${ownerParticipant.name}의 동반`,
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
            kakaoId: companion.ownerKakaoId,
            kakaoNickname: companion.name,
            companionId: companion.id,
            note: `${ownerParticipant.name}의 동반`,
            ...targetOptions,
            usesClubLodging: !!usesClubLodging,
            status: "APPROVED",
          });
      created.push(participant);
    }
    const participant = created[0];

    return {
      status: 201,
      body: {
        id: participant.id,
        status: participant.status,
        hasLesson: participant.hasLesson,
        hasBus: participant.hasBus,
        hasRental: participant.hasRental,
        day2ParticipantId: created[1]?.id,
        day2HasRental: created[1]?.hasRental ?? false,
        usesClubLodging: participant.usesClubLodging,
        companion: { id: companion.id, name: companion.name, owner: companion.owner },
      },
    };
  });

  return NextResponse.json(result.body, { status: result.status });
}
