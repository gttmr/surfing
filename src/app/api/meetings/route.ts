import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isAdminAuthenticated } from "@/lib/auth";
import { getActiveSessionFromRequest } from "@/lib/active-session";
import { getTodayInSeoul } from "@/lib/date";
import { addDaysToDate, OVERNIGHT_DAY2_FEE_DEFAULT } from "@/lib/meeting-days";
import { parseMeetingFee, validateMeetingCreate, validateOvernightMeetingSpan } from "@/lib/meeting-create-form";
import { getPricingConfig } from "@/lib/pricing";
import { PRICING_SETTING_KEYS } from "@/lib/settings";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const upcoming = searchParams.get("upcoming") === "true";

  const today = getTodayInSeoul();

  const meetings = await prisma.meeting.findMany({
    where: upcoming ? { OR: [{ date: { gte: today } }, { endDate: { gte: today } }] } : undefined,
    orderBy: { date: "asc" },
    include: {
      _count: {
        select: { participants: { where: { status: "APPROVED" } } },
      },
    },
  });

  const result = meetings.map((m) => ({
    id: m.id,
    date: m.date,
    startTime: m.startTime,
    endTime: m.endTime,
    location: m.location,
    description: m.description,
    isOpen: m.isOpen,
    meetingType: m.meetingType,
    createdByKakaoId: m.createdByKakaoId,
    approvedCount: m._count.participants,
    endDate: m.endDate,
    regularFee: m.regularFee,
    companionFee: m.companionFee,
    lodgingFee: m.lodgingFee,
  }));

  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (typeof body !== "object" || body === null) {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }
  const { date, startTime, endTime, location, description, isOpen, meetingType } = body as Record<string, unknown>;
  const overnight = (body as Record<string, unknown>).overnight === true;

  const isAdmin = await isAdminAuthenticated();
  const sessionUser = await getActiveSessionFromRequest(req);

  // 비정기 모임은 로그인한 일반 회원도 생성 가능
  if (!isAdmin) {
    if (!sessionUser) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }
    // 일반 회원은 당일 비정기 모임만 생성 가능
    if (meetingType !== "비정기" || overnight) {
      return NextResponse.json({ error: "일반 회원은 비정기 모임만 등록할 수 있습니다" }, { status: 403 });
    }
  }

  if (typeof date !== "string" || typeof startTime !== "string" || typeof endTime !== "string" || typeof location !== "string") {
    return NextResponse.json({ error: "필수 항목을 입력해주세요" }, { status: 400 });
  }
  const fields = { date, startTime, endTime, location };
  const fieldErrors = overnight ? validateOvernightMeetingSpan(fields) : validateMeetingCreate(fields);
  const firstFieldError = Object.values(fieldErrors)[0];
  if (firstFieldError) return NextResponse.json({ error: firstFieldError, fields: fieldErrors }, { status: 400 });
  if (meetingType !== undefined && meetingType !== "정기" && meetingType !== "비정기") {
    return NextResponse.json({ error: "올바른 모임 유형을 선택해 주세요." }, { status: 400 });
  }

  // 참가비는 모임마다 저장한다. 입력이 없으면 요금 설정의 기본 참가비(1박은 둘째 날 참가비를 더한 총액)로 채운다.
  const fees = {
    regularFee: parseMeetingFee((body as Record<string, unknown>).regularFee, "정회원 참가비"),
    companionFee: parseMeetingFee((body as Record<string, unknown>).companionFee, "동반인 참가비"),
    lodgingFee: parseMeetingFee((body as Record<string, unknown>).lodgingFee, "숙박비"),
  };
  for (const fee of Object.values(fees)) {
    if (!fee.ok) return NextResponse.json({ error: fee.error }, { status: 400 });
  }
  if (!isAdmin && Object.values(fees).some((fee) => fee.ok && fee.value !== null)) {
    return NextResponse.json({ error: "참가비는 운영진만 정할 수 있습니다" }, { status: 403 });
  }
  const pricing = await getPricingConfig();
  const day2Fee = overnight ? OVERNIGHT_DAY2_FEE_DEFAULT : 0;
  const valueOf = (fee: (typeof fees)[keyof typeof fees], fallback: number) => (fee.ok && fee.value !== null ? fee.value : fallback);

  if (meetingType === "비정기") {
    const existingMeeting = await prisma.meeting.findFirst({
      where: { date },
      select: { id: true },
    });

    if (existingMeeting) {
      return NextResponse.json({ error: "이미 해당 날짜에 모임이 있어 비정기 모임을 생성할 수 없습니다" }, { status: 409 });
    }
  }

  const meeting = await prisma.meeting.create({
    data: {
      date,
      endDate: overnight ? addDaysToDate(date, 1) : null,
      startTime,
      endTime,
      location: location.trim(),
      description: typeof description === "string" && description.trim() ? description.trim() : null,
      isOpen: isOpen !== false,
      meetingType: typeof meetingType === "string" ? meetingType : "정기",
      createdByKakaoId: isAdmin ? null : (sessionUser?.kakaoId ?? null),
      regularFee: valueOf(fees.regularFee, pricing[PRICING_SETTING_KEYS.regularBaseFee] + day2Fee),
      companionFee: valueOf(fees.companionFee, pricing[PRICING_SETTING_KEYS.companionBaseFee] + day2Fee),
      lodgingFee: overnight ? valueOf(fees.lodgingFee, 0) : 0,
    },
  });

  return NextResponse.json(meeting, { status: 201 });
}
