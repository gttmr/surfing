import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import {
  hasOvernightMeetingCreateErrors,
  OVERNIGHT_MEETING_GROUP_KIND,
  parseOvernightMeetingCreateInput,
  toOvernightMeetingGroupSummary,
  validateOvernightMeetingCreate,
} from "@/lib/meeting-group";
import { runSerializableTransaction } from "@/lib/transaction";

export async function POST(req: NextRequest) {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  const parsed = parseOvernightMeetingCreateInput(body);
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const validation = validateOvernightMeetingCreate(parsed.value);
  if (hasOvernightMeetingCreateErrors(validation)) {
    const firstError = validation.days
      ?? validation.meetingType
      ?? validation.regularBaseFee
      ?? validation.companionBaseFee
      ?? validation.lodgingFee
      ?? Object.values(validation.day1 ?? {})[0]
      ?? Object.values(validation.day2 ?? {})[0]
      ?? "입력 내용을 확인해 주세요.";
    return NextResponse.json({ error: firstError, fields: validation }, { status: 400 });
  }

  const created = await runSerializableTransaction((tx) => tx.meetingGroup.create({
    data: {
      kind: OVERNIGHT_MEETING_GROUP_KIND,
      regularBaseFee: parsed.value.regularBaseFee,
      companionBaseFee: parsed.value.companionBaseFee,
      lodgingFee: parsed.value.lodgingFee,
      meetings: {
        create: parsed.value.days.map((day, index) => ({
          groupDayIndex: index + 1,
          date: day.date,
          startTime: day.startTime,
          endTime: day.endTime,
          location: day.location,
          description: day.description ?? null,
          isOpen: true,
          meetingType: parsed.value.meetingType,
          createdByKakaoId: null,
        })),
      },
    },
    include: {
      meetings: {
        orderBy: { groupDayIndex: "asc" },
      },
    },
  }));

  const group = toOvernightMeetingGroupSummary(created);
  if (!group) {
    return NextResponse.json({ error: "생성된 1박2일 일정을 읽지 못했습니다." }, { status: 500 });
  }

  return NextResponse.json({
    group,
    meetings: created.meetings,
  }, { status: 201 });
}
