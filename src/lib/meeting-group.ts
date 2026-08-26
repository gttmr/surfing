import { getTodayInSeoul } from "@/lib/date";
import { validateMeetingCreate, type MeetingCreateErrors, type MeetingCreateFields } from "@/lib/meeting-create-form";

export const OVERNIGHT_MEETING_GROUP_KIND = "OVERNIGHT" as const;

export type MeetingGroupDaySummary = {
  id: number;
  dayIndex: number;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
};

export type OvernightMeetingGroupSummary = {
  id: number;
  kind: typeof OVERNIGHT_MEETING_GROUP_KIND;
  regularBaseFee: number;
  companionBaseFee: number;
  lodgingFee: number;
  days: MeetingGroupDaySummary[];
};

export type OvernightMeetingSpanSummary = {
  startDate: string;
  endDate: string;
  startTime: string;
  endTime: string;
  location: string;
};

export type OvernightMeetingDayInput = MeetingCreateFields & {
  description?: string | null;
};

type OvernightMeetingSpanInput = MeetingCreateFields & {
  description?: string | null;
};

export type OvernightMeetingCreateInput = {
  meetingType: string;
  regularBaseFee: number;
  companionBaseFee: number;
  lodgingFee: number;
  days: [OvernightMeetingDayInput, OvernightMeetingDayInput];
};

export type OvernightMeetingCreateErrors = {
  meetingType?: string;
  regularBaseFee?: string;
  companionBaseFee?: string;
  lodgingFee?: string;
  days?: string;
  day1?: MeetingCreateErrors;
  day2?: MeetingCreateErrors;
};

export type OvernightMeetingCreateParseResult =
  | { ok: true; value: OvernightMeetingCreateInput }
  | { ok: false; error: string };

type MeetingGroupRecord = {
  id: number;
  kind: string;
  regularBaseFee: number;
  companionBaseFee: number;
  lodgingFee: number;
  meetings: Array<{
    id: number;
    groupDayIndex: number | null;
    date: string;
    startTime: string;
    endTime: string;
    location: string;
  }>;
};

export function addDaysToDate(date: string, amount: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return "";
  parsed.setUTCDate(parsed.getUTCDate() + amount);
  return parsed.toISOString().slice(0, 10);
}

export function isOvernightMeetingGroupKind(kind: string | null | undefined): kind is typeof OVERNIGHT_MEETING_GROUP_KIND {
  return kind === OVERNIGHT_MEETING_GROUP_KIND;
}

export function toOvernightMeetingGroupSummary(group: MeetingGroupRecord | null | undefined): OvernightMeetingGroupSummary | null {
  if (!group || !isOvernightMeetingGroupKind(group.kind)) return null;

  const days = group.meetings
    .filter((meeting): meeting is typeof meeting & { groupDayIndex: number } => meeting.groupDayIndex !== null)
    .sort((left, right) => left.groupDayIndex - right.groupDayIndex)
    .map((meeting) => ({
      id: meeting.id,
      dayIndex: meeting.groupDayIndex,
      date: meeting.date,
      startTime: meeting.startTime,
      endTime: meeting.endTime,
      location: meeting.location,
    }));

  if (days.length !== 2 || days[0]?.dayIndex !== 1 || days[1]?.dayIndex !== 2) return null;

  return {
    id: group.id,
    kind: OVERNIGHT_MEETING_GROUP_KIND,
    regularBaseFee: group.regularBaseFee,
    companionBaseFee: group.companionBaseFee,
    lodgingFee: group.lodgingFee,
    days,
  };
}

export function getOvernightMeetingSpan(group: OvernightMeetingGroupSummary): OvernightMeetingSpanSummary | null {
  const startDay = group.days[0];
  const endDay = group.days.at(-1);
  if (!startDay || !endDay) return null;
  return {
    startDate: startDay.date,
    endDate: endDay.date,
    startTime: startDay.startTime,
    endTime: endDay.endTime,
    location: startDay.location,
  };
}

function isNonNegativeInteger(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isExactDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function isExactTime(value: string): boolean {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;
  return Number(match[1]) <= 23 && Number(match[2]) <= 59;
}

function parseMeetingSpan(value: Record<string, unknown>): OvernightMeetingSpanInput | null {
  const { startDate, startTime, endTime, location, description } = value;
  if (
    typeof startDate !== "string" || !isExactDate(startDate)
    || typeof startTime !== "string" || !isExactTime(startTime)
    || typeof endTime !== "string" || !isExactTime(endTime)
    || typeof location !== "string" || location.trim().length === 0 || location.trim().length > 120
    || (description !== undefined && description !== null && typeof description !== "string")
    || (typeof description === "string" && description.trim().length > 300)
  ) {
    return null;
  }

  return {
    date: startDate,
    startTime,
    endTime,
    location: location.trim(),
    description: typeof description === "string" && description.trim() ? description.trim() : null,
  };
}

function parseDay(value: unknown): OvernightMeetingDayInput | null {
  if (!isPlainObject(value)) return null;
  const { date, startTime, endTime, location, description } = value;
  if (
    typeof date !== "string" || !isExactDate(date)
    || typeof startTime !== "string" || !isExactTime(startTime)
    || typeof endTime !== "string" || !isExactTime(endTime)
    || typeof location !== "string" || location.trim().length === 0 || location.trim().length > 120
    || (description !== undefined && description !== null && typeof description !== "string")
    || (typeof description === "string" && description.trim().length > 300)
  ) {
    return null;
  }
  return {
    date,
    startTime,
    endTime,
    location: location.trim(),
    description: typeof description === "string" && description.trim() ? description.trim() : null,
  };
}

export function parseOvernightMeetingCreateInput(value: unknown): OvernightMeetingCreateParseResult {
  if (!isPlainObject(value)) return { ok: false, error: "요청 형식이 올바르지 않습니다." };
  if (typeof value.meetingType !== "string") return { ok: false, error: "모임 유형을 확인해 주세요." };
  const lodgingFee = value.lodgingFee === undefined ? 0 : value.lodgingFee;
  if (
    typeof value.regularBaseFee !== "number"
    || typeof value.companionBaseFee !== "number"
    || typeof lodgingFee !== "number"
  ) {
    return { ok: false, error: "참가비와 숙박비를 숫자로 입력해 주세요." };
  }

  let days: [OvernightMeetingDayInput, OvernightMeetingDayInput];
  if (Array.isArray(value.days)) {
    if (value.days.length !== 2) return { ok: false, error: "1박2일 일정은 첫째 날과 둘째 날이 모두 필요합니다." };
    const day1 = parseDay(value.days[0]);
    const day2 = parseDay(value.days[1]);
    if (!day1 || !day2) return { ok: false, error: "날짜, 시간, 장소 입력을 확인해 주세요." };
    days = [day1, day2];
  } else {
    const span = parseMeetingSpan(value);
    if (!span) return { ok: false, error: "날짜, 시간, 장소 입력을 확인해 주세요." };
    const shared = {
      location: span.location,
      description: span.description ?? null,
    };
    days = [
      { ...shared, date: span.date, startTime: span.startTime, endTime: "23:59" },
      { ...shared, date: addDaysToDate(span.date, 1), startTime: "00:00", endTime: span.endTime },
    ];
  }

  return {
    ok: true,
    value: {
      meetingType: value.meetingType,
      regularBaseFee: value.regularBaseFee,
      companionBaseFee: value.companionBaseFee,
      lodgingFee,
      days,
    },
  };
}

export function validateOvernightMeetingSpan(
  fields: MeetingCreateFields,
  today = getTodayInSeoul(),
): MeetingCreateErrors {
  const errors: MeetingCreateErrors = {};
  if (!fields.date) errors.date = "시작일을 선택해 주세요.";
  else if (fields.date < today) errors.date = "오늘 이후 시작일을 선택해 주세요.";
  if (!fields.startTime) errors.startTime = "시작 시간을 입력해 주세요.";
  else if (fields.startTime >= "23:59") errors.startTime = "시작 시간은 자정 전으로 입력해 주세요.";
  if (!fields.endTime) errors.endTime = "종료 시간을 입력해 주세요.";
  else if (fields.endTime <= "00:00") errors.endTime = "종료 시간은 자정 이후로 입력해 주세요.";
  if (!fields.location.trim()) errors.location = "장소를 입력해 주세요.";
  return errors;
}

export function validateOvernightMeetingCreate(
  input: OvernightMeetingCreateInput,
  today = getTodayInSeoul(),
): OvernightMeetingCreateErrors {
  const day1 = validateMeetingCreate(input.days[0], today);
  const day2 = validateMeetingCreate(input.days[1], today);
  const errors: OvernightMeetingCreateErrors = {};

  if (Object.keys(day1).length > 0) errors.day1 = day1;
  if (Object.keys(day2).length > 0) errors.day2 = day2;
  if (input.meetingType !== "정기" && input.meetingType !== "비정기") {
    errors.meetingType = "올바른 모임 유형을 선택해 주세요.";
  }
  if (!isNonNegativeInteger(input.regularBaseFee)) {
    errors.regularBaseFee = "회원 기본 참가비는 0원 이상의 정수로 입력해 주세요.";
  }
  if (!isNonNegativeInteger(input.companionBaseFee)) {
    errors.companionBaseFee = "동반인 기본 참가비는 0원 이상의 정수로 입력해 주세요.";
  }
  if (!isNonNegativeInteger(input.lodgingFee)) {
    errors.lodgingFee = "1인 숙박비는 0원 이상의 정수로 입력해 주세요.";
  }
  if (input.days[0].date && input.days[1].date !== addDaysToDate(input.days[0].date, 1)) {
    errors.days = "둘째 날은 첫째 날 바로 다음 날짜여야 합니다.";
  }

  return errors;
}

export function hasOvernightMeetingCreateErrors(errors: OvernightMeetingCreateErrors): boolean {
  return Object.keys(errors).length > 0;
}

export function participantIdentity(kakaoId: string, companionId: number | null): string {
  return `${kakaoId}:${companionId ?? "self"}`;
}
