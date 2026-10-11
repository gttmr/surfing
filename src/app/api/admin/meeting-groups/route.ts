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

// 1박 요금 수정. 청구가 공개되기 전까지만 바꿀 수 있다(공개 후에는 청구 정정 절차).
export async function PATCH(req: NextRequest) {
  if (!await isAdminAuthenticated()) {
    return NextResponse.json({ error: "관리자 로그인이 필요합니다." }, { status: 401 });
  }

  const body: unknown = await req.json().catch(() => null);
  const value = typeof body === "object" && body !== null ? body as Record<string, unknown> : {};
  const groupId = Number(value.groupId);
  const fees = {
    regularBaseFee: Number(value.regularBaseFee),
    companionBaseFee: Number(value.companionBaseFee),
    lodgingFee: Number(value.lodgingFee),
  };
  if (!Number.isInteger(groupId)) return NextResponse.json({ error: "1박 모임을 찾을 수 없습니다." }, { status: 400 });
  if (Object.values(fees).some((fee) => !Number.isSafeInteger(fee) || fee < 0 || fee > 10_000_000)) {
    return NextResponse.json({ error: "금액은 0원 이상의 정수로 입력해 주세요." }, { status: 400 });
  }

  const result = await runSerializableTransaction(async (tx) => {
    const group = await tx.meetingGroup.findUnique({
      where: { id: groupId },
      include: { meetings: { select: { settlementOpen: true, billingReviewConfirmedAt: true } } },
    });
    if (!group) return { error: "1박 모임을 찾을 수 없습니다.", status: 404 } as const;
    if (group.meetings.some((meeting) => meeting.settlementOpen || meeting.billingReviewConfirmedAt)) {
      return { error: "청구 검토가 시작되어 1박 요금을 바꿀 수 없습니다. 청구 정정 후 수정해 주세요.", status: 409 } as const;
    }
    return { group: await tx.meetingGroup.update({ where: { id: groupId }, data: fees }) } as const;
  });

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({
    regularBaseFee: result.group.regularBaseFee,
    companionBaseFee: result.group.companionBaseFee,
    lodgingFee: result.group.lodgingFee,
  });
}
