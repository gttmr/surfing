import { getTodayInSeoul } from "@/lib/date";

export type MeetingCreateFields = {
  date: string;
  startTime: string;
  endTime: string;
  location: string;
};

export type MeetingCreateField = keyof MeetingCreateFields;
export type MeetingCreateErrors = Partial<Record<MeetingCreateField, string>>;

export function validateMeetingCreate(fields: MeetingCreateFields, today = getTodayInSeoul()): MeetingCreateErrors {
  const errors: MeetingCreateErrors = {};
  if (!fields.date) errors.date = "날짜를 선택해 주세요.";
  else if (fields.date < today) errors.date = "오늘 이후 날짜를 선택해 주세요.";
  if (!fields.startTime) errors.startTime = "시작 시간을 입력해 주세요.";
  if (!fields.endTime) errors.endTime = "종료 시간을 입력해 주세요.";
  if (fields.startTime && fields.endTime && fields.startTime >= fields.endTime) {
    errors.endTime = "종료 시간은 시작 시간보다 늦어야 합니다.";
  }
  if (!fields.location.trim()) errors.location = "장소를 입력해 주세요.";
  return errors;
}

/** 1박: 시작일·첫날 시작 시각·마지막 날 종료 시각. 날짜가 달라 시각 순서는 비교하지 않는다. */
export function validateOvernightMeetingSpan(fields: MeetingCreateFields, today = getTodayInSeoul()): MeetingCreateErrors {
  const errors: MeetingCreateErrors = {};
  if (!fields.date) errors.date = "시작일을 선택해 주세요.";
  else if (fields.date < today) errors.date = "오늘 이후 시작일을 선택해 주세요.";
  if (!fields.startTime) errors.startTime = "시작 시간을 입력해 주세요.";
  if (!fields.endTime) errors.endTime = "종료 시간을 입력해 주세요.";
  if (!fields.location.trim()) errors.location = "장소를 입력해 주세요.";
  return errors;
}

const MAX_FEE = 10_000_000;

/** 모임 참가비·숙박비 입력. 없으면 null, 잘못되면 오류 문구 */
export function parseMeetingFee(value: unknown, label: string): { ok: true; value: number | null } | { ok: false; error: string } {
  if (value === undefined || value === null || value === "") return { ok: true, value: null };
  const amount = typeof value === "number" ? value : Number(String(value).replaceAll(",", ""));
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > MAX_FEE) {
    return { ok: false, error: `${label}는 0원 이상의 정수로 입력해 주세요.` };
  }
  return { ok: true, value: amount };
}
