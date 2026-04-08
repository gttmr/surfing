import type { MeetingWithCounts } from "@/lib/types";
import { pad } from "@/lib/format";

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

export type CalendarCell = {
  day: number;
  date: string;
  inCurrentMonth: boolean;
};

export function buildCalendarCells(year: number, month: number): CalendarCell[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const prevLastDay = new Date(year, month, 0);
  const startDow = firstDay.getDay();
  const totalDays = lastDay.getDate();
  const trailingDays = (7 - ((startDow + totalDays) % 7)) % 7;
  const cells: CalendarCell[] = [];

  for (let day = prevLastDay.getDate() - startDow + 1; day <= prevLastDay.getDate(); day += 1) {
    const prevMonthDate = new Date(year, month - 1, day);
    cells.push({
      day,
      date: `${prevMonthDate.getFullYear()}-${pad(prevMonthDate.getMonth() + 1)}-${pad(day)}`,
      inCurrentMonth: false,
    });
  }

  for (let day = 1; day <= totalDays; day += 1) {
    cells.push({
      day,
      date: `${year}-${pad(month + 1)}-${pad(day)}`,
      inCurrentMonth: true,
    });
  }

  for (let day = 1; day <= trailingDays; day += 1) {
    const nextMonthDate = new Date(year, month + 1, day);
    cells.push({
      day,
      date: `${nextMonthDate.getFullYear()}-${pad(nextMonthDate.getMonth() + 1)}-${pad(day)}`,
      inCurrentMonth: false,
    });
  }

  return cells;
}
