import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const upcoming = searchParams.get("upcoming") === "true";

  const today = new Date().toISOString().split("T")[0];

  const meetings = await prisma.meeting.findMany({
    where: upcoming ? { date: { gte: today } } : undefined,
    orderBy: { date: "asc" },
    include: {
      participants: {
        select: { status: true },
      },
    },
  });

  const result = meetings.map((m) => {
    const approvedCount = m.participants.filter((p) => p.status === "APPROVED").length;
    const waitlistedCount = m.participants.filter((p) => p.status === "WAITLISTED").length;
    return {
      id: m.id,
      date: m.date,
      startTime: m.startTime,
      endTime: m.endTime,
      location: m.location,
      maxCapacity: m.maxCapacity,
      description: m.description,
      isOpen: m.isOpen,
      approvedCount,
      waitlistedCount,
    };
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { date, startTime, endTime, location, maxCapacity, description, isOpen } = body;

  const meeting = await prisma.meeting.create({
    data: {
      date,
      startTime,
      endTime,
      location,
      maxCapacity: parseInt(maxCapacity),
      description: description || null,
      isOpen: isOpen !== false,
    },
  });

  return NextResponse.json(meeting, { status: 201 });
}
