import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const meeting = await prisma.meeting.findUnique({
    where: { id: parseInt(id) },
    include: {
      participants: {
        orderBy: [{ status: "asc" }, { submittedAt: "asc" }],
      },
    },
  });

  if (!meeting) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const approvedCount = meeting.participants.filter((p) => p.status === "APPROVED").length;
  const waitlistedCount = meeting.participants.filter((p) => p.status === "WAITLISTED").length;

  return NextResponse.json({ ...meeting, approvedCount, waitlistedCount });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const { date, startTime, endTime, location, maxCapacity, description, isOpen } = body;

  const meeting = await prisma.meeting.update({
    where: { id: parseInt(id) },
    data: {
      ...(date && { date }),
      ...(startTime && { startTime }),
      ...(endTime && { endTime }),
      ...(location && { location }),
      ...(maxCapacity !== undefined && { maxCapacity: parseInt(maxCapacity) }),
      ...(description !== undefined && { description: description || null }),
      ...(isOpen !== undefined && { isOpen }),
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
