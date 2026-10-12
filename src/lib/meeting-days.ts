// 모임 하나가 하루 또는 1박 이상의 일정을 가진다. 날마다 달라지는 것(실제 이용, 식음료 지원 한도)은
// 일정 안의 "몇째 날"로 구분한다.

/** 1박 참가비 기본값 = 당일 참가비 + 둘째 날 참가비. 모임 생성 시 미리 채우고 운영진이 고칠 수 있다. */
export const OVERNIGHT_DAY2_FEE_DEFAULT = 25_000;

export type MeetingFeeDefaults = {
  readonly regularDayFee: number;
  readonly companionDayFee: number;
  readonly day2Fee: number;
  readonly lodgingFee: number;
};

export type MeetingSchedule = {
  readonly date: string;
  readonly endDate?: string | null;
};

export type MeetingDay = {
  readonly dayIndex: number;
  readonly date: string;
};

export function addDaysToDate(date: string, amount: number): string {
  const parsed = new Date(`${date}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) return "";
  parsed.setUTCDate(parsed.getUTCDate() + amount);
  return parsed.toISOString().slice(0, 10);
}

export function lastMeetingDate(meeting: MeetingSchedule): string {
  return meeting.endDate && meeting.endDate > meeting.date ? meeting.endDate : meeting.date;
}

export function isOvernightMeeting(meeting: MeetingSchedule): boolean {
  return lastMeetingDate(meeting) !== meeting.date;
}

export function meetingDays(meeting: MeetingSchedule): MeetingDay[] {
  const days: MeetingDay[] = [];
  const last = lastMeetingDate(meeting);
  for (let date = meeting.date, dayIndex = 1; date <= last && dayIndex <= 7; date = addDaysToDate(date, 1), dayIndex += 1) {
    days.push({ dayIndex, date });
  }
  return days;
}

/** 날짜가 일정의 몇째 날인지. 일정 전이면 첫날, 일정 뒤면 마지막 날로 본다. */
export function dayIndexForDate(meeting: MeetingSchedule, date: string): number {
  const days = meetingDays(meeting);
  if (date <= days[0].date) return 1;
  return days.find((day) => day.date === date)?.dayIndex ?? days.length;
}

/** 서울 기준 날짜 (YYYY-MM-DD) */
export function seoulDateOf(instant: Date | string): string {
  const time = typeof instant === "string" ? new Date(instant) : instant;
  return new Date(time.getTime() + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function participantIdentity(kakaoId: string, companionId: number | null): string {
  return `${kakaoId}:${companionId ?? "self"}`;
}
