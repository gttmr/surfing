import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/session";
import { isAdminAuthenticated } from "@/lib/auth";
import { shouldApplyPenalty, DEFAULT_PENALTY_MESSAGE } from "@/lib/penalty";

// 회원이 자신의 참가를 취소
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = getSessionFromRequest(req);
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
  }

  const { id } = await params;
  const participant = await prisma.participant.findUnique({
    where: { id: parseInt(id) },
    include: { meeting: true },
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

  // 패널티 확인 (2일 이내 취소)
  const penaltyDaysSetting = await prisma.setting.findUnique({ where: { key: "cancellation_penalty_days" } });
  const penaltyDays = penaltyDaysSetting ? parseInt(penaltyDaysSetting.value) : 2;
  const hasPenalty = shouldApplyPenalty(participant.meeting.date, penaltyDays);

  // 패널티 메시지 조회
  let penaltyMessage: string | null = null;
  if (hasPenalty) {
    const msgSetting = await prisma.setting.findUnique({ where: { key: "cancellation_penalty_message" } });
    penaltyMessage = msgSetting?.value ?? DEFAULT_PENALTY_MESSAGE;
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

// 관리자가 참가자 상태 변경
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { action } = body; // action: "approve" | "waitlist" | "cancel"

  const participant = await prisma.participant.findUnique({
    where: { id: parseInt(id) },
    include: { meeting: { include: { participants: { select: { status: true } } } } },
  });

  if (!participant) return NextResponse.json({ error: "Not found" }, { status: 404 });

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

  const updated = await prisma.participant.update({
    where: { id: parseInt(id) },
    data: {
      status: newStatus,
      waitlistPosition: newWaitlistPosition,
      cancelledAt: action === "cancel" ? new Date() : participant.cancelledAt,
    },
  });

  return NextResponse.json(updated);
}
