import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import { getActiveSessionFromRequest } from "@/lib/active-session";
import { resolveProfileImage } from "@/lib/profile-image";
import { parseMeetingFee } from "@/lib/meeting-create-form";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const meeting = await prisma.meeting.findUnique({
    where: { id: parseInt(id) },
    include: {
      participants: {
        orderBy: [{ status: "asc" }, { submittedAt: "asc" }],
        include: {
          user: {
            select: {
              profileImage: true,
              customProfileImageUrl: true,
            },
          },
        },
      },
    },
  });

  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const approvedCount = meeting.participants.filter((p) => p.status === "APPROVED").length;
  const waitlistedCount = meeting.participants.filter((p) => p.status === "WAITLISTED").length;
  const [isAdmin, session] = await Promise.all([
    isAdminAuthenticated(),
    getActiveSessionFromRequest(req),
  ]);
  const publicGroupIds = new Map<string, string>();
  let nextGroup = 1;

  const participants = meeting.participants.map((participant) => {
    let visibleKakaoId = participant.kakaoId;
    if (!isAdmin && participant.kakaoId !== session?.kakaoId) {
      let publicGroupId = publicGroupIds.get(participant.kakaoId);
      if (!publicGroupId) {
        publicGroupId = `meeting-${meeting.id}-group-${nextGroup}`;
        publicGroupIds.set(participant.kakaoId, publicGroupId);
        nextGroup += 1;
      }
      visibleKakaoId = publicGroupId;
    }
    return {
      id: participant.id,
      name: participant.name,
      kakaoId: visibleKakaoId,
      kakaoNickname: isAdmin ? participant.kakaoNickname : participant.name,
      profileImage: resolveProfileImage(participant.user),
      note: isAdmin ? participant.note : null,
      hasLesson: isAdmin ? participant.hasLesson : false,
      hasBus: isAdmin ? participant.hasBus : false,
      hasRental: isAdmin ? participant.hasRental : false,
      hasDay2Rental: isAdmin ? participant.hasDay2Rental : false,
      usesClubLodging: isAdmin || participant.kakaoId === session?.kakaoId ? participant.usesClubLodging : false,
      status: participant.status,
      absent: participant.absentAt !== null,
      waitlistPosition: participant.waitlistPosition,
      isPenalized: isAdmin ? participant.isPenalized : false,
      cancelledAt: participant.cancelledAt,
      submittedAt: participant.submittedAt,
      companionId: participant.companionId,
    };
  });

  return NextResponse.json({
    ...meeting,
    billingPublished: meeting.billingPublishedAt !== null,
    participants,
    approvedCount,
    waitlistedCount,
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const { date, startTime, endTime, location, description, isOpen, meetingType } = body;
  const meetingId = parseInt(id);
  const current = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { id: true, billingPublishedAt: true },
  });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // 참가비·숙박비는 청구 공개 전까지만 바꿀 수 있다(공개 후에는 청구 정정 절차).
  const fees = {
    regularFee: parseMeetingFee(body.regularFee, "정회원 참가비"),
    companionFee: parseMeetingFee(body.companionFee, "동반인 참가비"),
    lodgingFee: parseMeetingFee(body.lodgingFee, "숙박비"),
  };
  const feeData: { regularFee?: number; companionFee?: number; lodgingFee?: number } = {};
  for (const [key, fee] of Object.entries(fees) as [keyof typeof fees, (typeof fees)[keyof typeof fees]][]) {
    if (!fee.ok) return NextResponse.json({ error: fee.error }, { status: 400 });
    if (fee.value !== null) feeData[key] = fee.value;
  }
  if (Object.keys(feeData).length > 0 && current.billingPublishedAt) {
    return NextResponse.json({ error: "청구가 공개되어 참가비를 바꿀 수 없습니다. 청구 정정 후 바꿔 주세요." }, { status: 409 });
  }

  const meeting = await prisma.meeting.update({
    where: { id: meetingId },
    data: {
      ...(date && { date }),
      ...(startTime && { startTime }),
      ...(endTime && { endTime }),
      ...(location && { location }),
      ...(description !== undefined && { description: description || null }),
      ...(isOpen !== undefined && { isOpen }),
      ...(meetingType && { meetingType }),
      ...feeData,
    },
  });

  return NextResponse.json(meeting);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const meetingId = parseInt(id);
  const meeting = await prisma.meeting.findUnique({ where: { id: meetingId }, select: { id: true } });
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.meeting.delete({ where: { id: meetingId } });

  return NextResponse.json({ ok: true });
}
