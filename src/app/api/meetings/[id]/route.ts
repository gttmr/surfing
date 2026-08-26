import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import { getActiveSessionFromRequest } from "@/lib/active-session";
import { resolveProfileImage } from "@/lib/profile-image";
import { toOvernightMeetingGroupSummary } from "@/lib/meeting-group";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const meeting = await prisma.meeting.findUnique({
    where: { id: parseInt(id) },
    include: {
      meetingGroup: {
        include: {
          meetings: {
            orderBy: { groupDayIndex: "asc" },
          },
        },
      },
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
      usesClubLodging: isAdmin || participant.kakaoId === session?.kakaoId ? participant.usesClubLodging : false,
      status: participant.status,
      attendanceStatus: participant.attendanceStatus,
      waitlistPosition: participant.waitlistPosition,
      isPenalized: isAdmin ? participant.isPenalized : false,
      cancelledAt: participant.cancelledAt,
      submittedAt: participant.submittedAt,
      companionId: participant.companionId,
    };
  });

  return NextResponse.json({
    ...meeting,
    overnightGroup: toOvernightMeetingGroupSummary(meeting.meetingGroup),
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
  const body = await req.json();
  const { date, startTime, endTime, location, description, isOpen, meetingType } = body;
  const meetingId = parseInt(id);
  const current = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: {
      id: true,
      meetingGroup: { select: { meetings: { select: { id: true } } } },
    },
  });
  if (!current) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (isOpen !== undefined && current.meetingGroup) {
    await prisma.meeting.updateMany({
      where: { id: { in: current.meetingGroup.meetings.map((meeting) => meeting.id) } },
      data: { isOpen },
    });
  }

  const meeting = await prisma.meeting.update({
    where: { id: meetingId },
    data: {
      ...(date && { date }),
      ...(startTime && { startTime }),
      ...(endTime && { endTime }),
      ...(location && { location }),
      ...(description !== undefined && { description: description || null }),
      ...(isOpen !== undefined && !current.meetingGroup && { isOpen }),
      ...(meetingType && { meetingType }),
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
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { meetingGroupId: true },
  });
  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (meeting.meetingGroupId) {
    await prisma.meetingGroup.delete({ where: { id: meeting.meetingGroupId } });
  } else {
    await prisma.meeting.delete({ where: { id: meetingId } });
  }

  return NextResponse.json({ ok: true });
}
