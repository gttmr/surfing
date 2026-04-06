import type { MeetingWithCounts } from "@/lib/types";

export function sortMeetings(meetings: MeetingWithCounts[]) {
  return [...meetings].sort((a, b) => {
    if (a.date === b.date) return a.startTime.localeCompare(b.startTime);
    return a.date.localeCompare(b.date);
  });
}

export function normalizeSelectedDate(date?: string | null) {
  if (!date) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

export function findInitialView(meetings: MeetingWithCounts[], today: string, preferredDate?: string | null) {
  const normalizedPreferredDate = normalizeSelectedDate(preferredDate);
  if (normalizedPreferredDate) {
    const baseDate = new Date(`${normalizedPreferredDate}T00:00:00`);
    return {
      year: baseDate.getFullYear(),
      month: baseDate.getMonth(),
      selectedDate: normalizedPreferredDate,
    };
  }

  const sorted = sortMeetings(meetings);
  const targetMeeting = sorted.find((meeting) => meeting.date >= today) ?? sorted[0];
  const baseDate = targetMeeting ? new Date(`${targetMeeting.date}T00:00:00`) : new Date();

  return {
    year: baseDate.getFullYear(),
    month: baseDate.getMonth(),
    selectedDate: targetMeeting?.date ?? null,
  };
}

export function findDefaultDateForMonth(meetings: MeetingWithCounts[], year: number, month: number, today: string) {
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthMeetings = sortMeetings(meetings).filter((meeting) => meeting.date.startsWith(monthKey));
  if (!monthMeetings.length) return null;

  return monthMeetings.find((meeting) => meeting.date >= today)?.date ?? monthMeetings[0].date;
}
