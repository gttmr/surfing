import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getActiveSessionFromRequest } from "@/lib/active-session";
import { isAdminAuthenticated } from "@/lib/auth";
import { shouldApplyPenalty, DEFAULT_PENALTY_MESSAGE } from "@/lib/penalty";
import { CANCELLATION_PENALTY_MESSAGE_KEY } from "@/lib/settings";
import {
  InvalidParticipantOptionsError,
  normalizeParticipantOptions,
} from "@/lib/participant-options";
import { getSessionPayload } from "@/lib/session";
import { runSerializableTransaction } from "@/lib/transaction";

// 회원이 자신의 참가를 취소
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getActiveSessionFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const { id } = await params;
  const participant = await prisma.participant.findUnique({
    where: { id: parseInt(id) },
    include: {
      meeting: {
        include: {
          meetingGroup: { include: { meetings: { orderBy: { groupDayIndex: "asc" } } } },
        },
      },
    },
  });

  if (!participant) {
    return NextResponse.json({ error: "신청 내역을 찾을 수 없습니다" }, { status: 404 });
  }

  // 본인 확인 (관리자는 패스)
  const isAdmin = await isAdminAuthenticated();
  if (!isAdmin && participant.kakaoId !== user.kakaoId) {
    return NextResponse.json({ error: "본인의 신청만 취소할 수 있습니다" }, { status: 403 });
  }

  if (participant.status === "CANCELLED") {
    return NextResponse.json({ error: "이미 취소된 신청입니다" }, { status: 400 });
  }

  // 패널티 확인 (해당 주 화요일 18시 이후 취소)
  const cancellationDate = participant.meeting.meetingGroup?.meetings.find((meeting) => meeting.groupDayIndex === 1)?.date
    ?? participant.meeting.date;
  const hasPenalty = shouldApplyPenalty(cancellationDate);

  // 패널티 메시지 조회
  let penaltyMessage: string | null = null;
  if (hasPenalty) {
    const msgSetting = await prisma.setting.findUnique({ where: { key: CANCELLATION_PENALTY_MESSAGE_KEY } });
    penaltyMessage = msgSetting?.value ?? DEFAULT_PENALTY_MESSAGE;
  }

  const groupMeetingIds = participant.meeting.meetingGroup?.meetings.map((meeting) => meeting.id) ?? [];
  if (groupMeetingIds.length === 2) {
    const cancelledCompanions = await runSerializableTransaction(async (tx) => {
      const firstMeetingId = participant.meeting.meetingGroup!.meetings.find((meeting) => meeting.groupDayIndex === 1)!.id;
      const companions = participant.companionId === null
        ? await tx.participant.findMany({
            where: {
              meetingId: firstMeetingId,
              kakaoId: participant.kakaoId,
              companionId: { not: null },
              status: { not: "CANCELLED" },
            },
            select: { companionId: true },
          })
        : [];

      await tx.participant.updateMany({
        where: {
          meetingId: { in: groupMeetingIds },
          kakaoId: participant.kakaoId,
          ...(participant.companionId === null ? {} : { companionId: participant.companionId }),
          status: { not: "CANCELLED" },
        },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });
      if (hasPenalty) {
        await tx.participant.updateMany({
          where: {
            meetingId: { in: groupMeetingIds },
            kakaoId: participant.kakaoId,
            companionId: participant.companionId,
          },
          data: { isPenalized: true },
        });
        await tx.user.update({
          where: { kakaoId: participant.kakaoId },
          data: { penaltyCount: { increment: 1 } },
        });
      }

      if (participant.status === "APPROVED") {
        const nextWaitlisted = await tx.participant.findFirst({
          where: { meetingId: firstMeetingId, status: "WAITLISTED" },
          orderBy: { waitlistPosition: "asc" },
        });
        if (nextWaitlisted) {
          await tx.participant.updateMany({
            where: {
              meetingId: { in: groupMeetingIds },
              kakaoId: nextWaitlisted.kakaoId,
              companionId: nextWaitlisted.companionId,
              status: "WAITLISTED",
            },
            data: { status: "APPROVED", waitlistPosition: null },
          });
        }
      }

      return new Set(companions.map((item) => item.companionId)).size;
    });

    return NextResponse.json({
      ok: true,
      penalty: hasPenalty,
      penaltyMessage,
      cancelledCompanions,
    });
  }

  const wasApproved = participant.status === "APPROVED";

  // 참가 취소 처리
  await prisma.participant.update({
    where: { id: parseInt(id) },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      isPenalized: hasPenalty,
    },
  });

  // 패널티 카운트 증가
  if (hasPenalty) {
    await prisma.user.update({
      where: { kakaoId: participant.kakaoId },
      data: { penaltyCount: { increment: 1 } },
    });
  }

  // 본인 취소 시 동반인 참가도 함께 취소 (companionId가 null이 아닌 본인 kakaoId의 참가자)
  let cancelledCompanions = 0;
  if (!participant.companionId) {
    const result = await prisma.participant.updateMany({
      where: {
        meetingId: participant.meetingId,
        kakaoId: participant.kakaoId,
        companionId: { not: null },
        status: { not: "CANCELLED" },
      },
      data: {
        status: "CANCELLED",
        cancelledAt: new Date(),
      },
    });
    cancelledCompanions = result.count;
  }

  // 취소된 자리에 대기자 승격
  if (wasApproved) {
    const nextWaitlisted = await prisma.participant.findFirst({
      where: {
        meetingId: participant.meetingId,
        status: "WAITLISTED",
      },
      orderBy: { waitlistPosition: "asc" },
    });

    if (nextWaitlisted) {
      await prisma.participant.update({
        where: { id: nextWaitlisted.id },
        data: { status: "APPROVED", waitlistPosition: null },
      });
    }
  }

  return NextResponse.json({
    ok: true,
    penalty: hasPenalty,
    penaltyMessage,
    cancelledCompanions,
  });
}

// 신청 정보 업데이트 (정회원 또는 연동된 동반인 본인)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getActiveSessionFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const { id } = await params;
  const participant = await prisma.participant.findUnique({
    where: { id: parseInt(id) },
    include: {
      companion: true,
      meeting: {
        include: {
          meetingGroup: {
            include: {
              meetings: { orderBy: { groupDayIndex: "asc" } },
            },
          },
        },
      },
    },
  });

  if (!participant) {
    return NextResponse.json({ error: "신청 내역을 찾을 수 없습니다" }, { status: 404 });
  }

  // 권한 확인: 정회원(participant.kakaoId) 또는 연동된 동반인 본인(companion.linkedKakaoId)
  const isOwner = participant.kakaoId === user.kakaoId;
  const isLinkedCompanion = participant.companion?.linkedKakaoId === user.kakaoId;
  if (!isOwner && !isLinkedCompanion) {
    return NextResponse.json({ error: "수정 권한이 없습니다" }, { status: 403 });
  }

  const body = await req.json();
  const { hasLesson, hasBus, hasRental, note, day2HasRental, usesClubLodging } = body;
  const invalidBoolean = [hasLesson, hasBus, hasRental, day2HasRental, usesClubLodging]
    .some((value) => value !== undefined && typeof value !== "boolean");
  if (invalidBoolean) return NextResponse.json({ error: "참가 옵션을 확인해 주세요." }, { status: 400 });

  const groupDays = participant.meeting.meetingGroup?.meetings ?? [];
  const day1Meeting = groupDays.find((meeting) => meeting.groupDayIndex === 1);
  const day2Meeting = groupDays.find((meeting) => meeting.groupDayIndex === 2);
  const isOvernight = Boolean(day1Meeting && day2Meeting);
  const day1Participant = isOvernight && participant.meetingId !== day1Meeting!.id
    ? await prisma.participant.findFirst({
        where: {
          meetingId: day1Meeting!.id,
          kakaoId: participant.kakaoId,
          companionId: participant.companionId,
          status: { not: "CANCELLED" },
        },
      })
    : participant;
  if (!day1Participant) {
    return NextResponse.json({ error: "첫째 날 신청 내역을 찾을 수 없습니다." }, { status: 409 });
  }

  const hasOptionUpdate =
    hasLesson !== undefined || hasBus !== undefined || hasRental !== undefined;

  let nextOptions: ReturnType<typeof normalizeParticipantOptions> | null = null;
  if (hasOptionUpdate) {
    try {
      nextOptions = normalizeParticipantOptions({
        hasLesson: hasLesson ?? day1Participant.hasLesson,
        hasBus: hasBus ?? day1Participant.hasBus,
        hasRental: hasRental ?? day1Participant.hasRental,
      });
    } catch (error) {
      if (error instanceof InvalidParticipantOptionsError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }
  }

  const normalizedNote = note !== undefined
    ? typeof note === "string" ? (note.slice(0, 100).trim() || null) : null
    : undefined;

  if (!isOvernight) {
    const updated = await prisma.participant.update({
      where: { id: participant.id },
      data: {
        ...(nextOptions ?? {}),
        ...(normalizedNote !== undefined && { note: normalizedNote }),
      },
    });
    return NextResponse.json(updated);
  }

  const result = await runSerializableTransaction(async (tx) => {
    const secondParticipant = await tx.participant.findFirst({
      where: {
        meetingId: day2Meeting!.id,
        kakaoId: participant.kakaoId,
        companionId: participant.companionId,
        status: { not: "CANCELLED" },
      },
    });
    if (!secondParticipant) return null;

    const [updatedFirst, updatedSecond] = await Promise.all([
      tx.participant.update({
        where: { id: day1Participant.id },
        data: {
          ...(nextOptions ?? {}),
          ...(normalizedNote !== undefined && { note: normalizedNote }),
          ...(usesClubLodging !== undefined && { usesClubLodging }),
        },
      }),
      tx.participant.update({
        where: { id: secondParticipant.id },
        data: {
          ...(hasBus !== undefined && { hasBus }),
          ...(day2HasRental !== undefined && { hasRental: day2HasRental }),
          ...(normalizedNote !== undefined && { note: normalizedNote }),
          ...(usesClubLodging !== undefined && { usesClubLodging }),
        },
      }),
    ]);
    return { updatedFirst, updatedSecond };
  });
  if (!result) return NextResponse.json({ error: "둘째 날 신청 내역을 찾을 수 없습니다." }, { status: 409 });

  return NextResponse.json({
    ...result.updatedFirst,
    day2ParticipantId: result.updatedSecond.id,
    day2HasRental: result.updatedSecond.hasRental,
  });
}

// 관리자가 참가자 상태 변경
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { action } = body; // action: "approve" | "waitlist" | "cancel"
  const actor = await getSessionPayload();
  const actorKakaoId = actor?.kakaoId ?? "password-admin";

  const participant = await prisma.participant.findUnique({
    where: { id: parseInt(id) },
    include: {
      meeting: {
        include: {
          participants: { select: { status: true } },
          meetingGroup: {
            include: {
              meetings: {
                orderBy: { groupDayIndex: "asc" },
                select: { id: true, settlementOpen: true },
              },
            },
          },
        },
      },
    },
  });

  if (!participant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const attendanceByAction = {
    attended: "ATTENDED",
    absent: "ABSENT",
    "attendance-pending": "PENDING",
  } as const;
  if (action in attendanceByAction) {
    if (participant.status !== "APPROVED") {
      return NextResponse.json({ error: "승인된 참가자의 참석 상태만 변경할 수 있습니다." }, { status: 409 });
    }
    const scopedMeetings = participant.meeting.meetingGroup?.meetings ?? [participant.meeting];
    if (scopedMeetings.some((meeting) => meeting.settlementOpen)) {
      return NextResponse.json({ error: "청구가 공개된 모임의 참석 상태는 정정 절차 후 변경할 수 있습니다." }, { status: 409 });
    }
    const attendanceStatus = attendanceByAction[action as keyof typeof attendanceByAction];
    const updated = await prisma.participant.update({
      where: { id: participant.id },
      data: {
        attendanceStatus,
        attendanceUpdatedAt: new Date(),
        attendanceUpdatedByKakaoId: actorKakaoId,
      },
    });
    return NextResponse.json(updated);
  }

  let newStatus = participant.status;
  let newWaitlistPosition = participant.waitlistPosition;

  if (action === "approve") {
    newStatus = "APPROVED";
    newWaitlistPosition = null;
  } else if (action === "waitlist") {
    const waitlistedCount = participant.meeting.participants.filter((p) => p.status === "WAITLISTED").length;
    newStatus = "WAITLISTED";
    newWaitlistPosition = waitlistedCount + 1;
  } else if (action === "cancel") {
    newStatus = "CANCELLED";
    newWaitlistPosition = null;
  }

  const groupedMeetingIds = participant.meeting.meetingGroup?.meetings.map((meeting) => meeting.id) ?? [];
  const relatedParticipants = groupedMeetingIds.length > 0
    ? await prisma.participant.findMany({
        where: {
          meetingId: { in: groupedMeetingIds },
          kakaoId: participant.kakaoId,
          companionId: participant.companionId,
        },
        include: { meeting: { include: { participants: { select: { status: true } } } } },
      })
    : [participant];
  const cancelledAt = action === "cancel" ? new Date() : participant.cancelledAt;
  const updatedRows = await prisma.$transaction(
    relatedParticipants.map((related) => {
      const waitlistPosition = action === "waitlist"
        ? related.meeting.participants.filter((item) => item.status === "WAITLISTED").length + 1
        : newWaitlistPosition;
      return prisma.participant.update({
        where: { id: related.id },
        data: { status: newStatus, waitlistPosition, cancelledAt },
      });
    })
  );
  const updated = updatedRows.find((item) => item.id === participant.id) ?? updatedRows[0];

  return NextResponse.json(updated);
}
