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
