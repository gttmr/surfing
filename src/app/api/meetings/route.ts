import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import { getSessionFromRequest } from "@/lib/session";

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
    return {
      id: m.id,
      date: m.date,
      startTime: m.startTime,
      endTime: m.endTime,
      location: m.location,
      description: m.description,
      isOpen: m.isOpen,
      meetingType: m.meetingType,
      createdByKakaoId: m.createdByKakaoId,
      approvedCount,
    };
  });

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { date, startTime, endTime, location, description, isOpen, meetingType } = body;

  const isAdmin = await isAdminAuthenticated();
  const sessionUser = getSessionFromRequest(req);

  // 비정기 모임은 로그인한 일반 회원도 생성 가능
  if (!isAdmin) {
    if (!sessionUser) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }
    // 일반 회원은 비정기 모임만 생성 가능
    if (meetingType !== "비정기") {
      return NextResponse.json({ error: "일반 회원은 비정기 모임만 등록할 수 있습니다" }, { status: 403 });
    }
  }

  if (!date || !startTime || !endTime || !location) {
    return NextResponse.json({ error: "필수 항목을 입력해주세요" }, { status: 400 });
  }

  const meeting = await prisma.meeting.create({
    data: {
      date,
      startTime,
      endTime,
      location,
      description: description || null,
      isOpen: isOpen !== false,
      meetingType: meetingType || "정기",
      createdByKakaoId: isAdmin ? null : (sessionUser?.kakaoId ?? null),
    },
  });

  return NextResponse.json(meeting, { status: 201 });
}
