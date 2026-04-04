import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import { resolveProfileImage } from "@/lib/profile-image";

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

  const participants = meeting.participants.map((participant) => ({
    ...participant,
    profileImage: resolveProfileImage(participant.user),
  }));

  return NextResponse.json({ ...meeting, participants, approvedCount, waitlistedCount });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { date, startTime, endTime, location, description, isOpen, meetingType } = body;

  const meeting = await prisma.meeting.update({
    where: { id: parseInt(id) },
    data: {
      ...(date && { date }),
      ...(startTime && { startTime }),
      ...(endTime && { endTime }),
      ...(location && { location }),
      ...(description !== undefined && { description: description || null }),
      ...(isOpen !== undefined && { isOpen }),
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
  await prisma.meeting.delete({ where: { id: parseInt(id) } });

  return NextResponse.json({ ok: true });
}
