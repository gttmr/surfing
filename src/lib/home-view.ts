import type { MeetingWithCounts } from "@/lib/types";
import { pad } from "@/lib/format";
import type {
  DetailedMeeting,
  LinkedCompanionStatus,
  MeetingParticipantItem,
  SignupInitialData,
} from "@/lib/landing-types";
import { resolveProfileImage } from "@/lib/profile-image";

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

// ── 서버 데이터 조립 헬퍼 ──────────────────────────────────────

type RawParticipant = {
  id: number;
  name: string;
  note: string | null;
  hasLesson: boolean;
  hasBus: boolean;
  hasRental: boolean;
  status: string;
  kakaoId: string;
  companionId: number | null;
  waitlistPosition: number | null;
  user: { profileImage: string | null; customProfileImageUrl: string | null } | null;
};

type RawMeeting = {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string | null;
  isOpen: boolean;
  meetingType: string;
  createdByKakaoId: string | null;
  participants: RawParticipant[];
};

export function buildDetailedMeeting(meeting: RawMeeting): DetailedMeeting {
  const participantsList: MeetingParticipantItem[] = meeting.participants
    .filter((p) => p.status !== "CANCELLED")
    .map((p) => ({
      id: p.id,
      name: p.name,
      note: p.note,
      hasLesson: p.hasLesson,
      hasBus: p.hasBus,
      hasRental: p.hasRental,
      status: p.status,
      kakaoId: p.kakaoId,
      companionId: p.companionId,
      waitlistPosition: p.waitlistPosition,
      profileImage: resolveProfileImage(p.user),
    }));

  return {
    id: meeting.id,
    date: meeting.date,
    startTime: meeting.startTime,
    endTime: meeting.endTime,
    location: meeting.location,
    description: meeting.description,
    isOpen: meeting.isOpen,
    meetingType: meeting.meetingType,
    createdByKakaoId: meeting.createdByKakaoId,
    approvedCount: participantsList.filter((p) => p.status === "APPROVED").length,
    participantsList,
  };
}

type LinkedCompanionRow = {
  id: number;
  name: string;
  ownerKakaoId: string;
  owner: { name: string | null; kakaoId: string };
} | null;

type DbUserShape = {
  memberType: string;
  name: string | null;
};

export function buildSignupInitialData(
  detailedMeeting: DetailedMeeting,
  sessionKakaoId: string,
  dbUser: DbUserShape,
  regularCompanions: { id: number; name: string }[],
  linkedCompanion: LinkedCompanionRow,
  participantOptionPricingGuide: string,
): SignupInitialData {
  const myParticipant = detailedMeeting.participantsList.find(
    (p) => p.kakaoId === sessionKakaoId && p.companionId === null && p.status !== "CANCELLED"
  );

  const signedUpCompanionData = detailedMeeting.participantsList.reduce<
    SignupInitialData["signedUpCompanionData"]
  >((acc, p) => {
    if (p.kakaoId === sessionKakaoId && p.companionId !== null && p.status !== "CANCELLED") {
      acc[p.companionId] = {
        participantId: p.id,
        hasLesson: p.hasLesson,
        hasBus: p.hasBus,
        hasRental: p.hasRental,
      };
    }
    return acc;
  }, {});

  let linkedStatus: LinkedCompanionStatus | null = null;
  if (dbUser.memberType === "COMPANION") {
    if (linkedCompanion) {
      const linkedParticipant = detailedMeeting.participantsList.find(
        (p) => p.companionId === linkedCompanion.id && p.status !== "CANCELLED"
      );
      linkedStatus = {
        linked: true,
        ownerApplied: detailedMeeting.participantsList.some(
          (p) =>
            p.kakaoId === linkedCompanion.ownerKakaoId &&
            p.companionId === null &&
            p.status !== "CANCELLED"
        ),
        companion: {
          id: linkedCompanion.id,
          name: linkedCompanion.name,
          owner: linkedCompanion.owner,
        },
        participant: linkedParticipant
          ? {
              id: linkedParticipant.id,
              status: linkedParticipant.status,
              hasLesson: linkedParticipant.hasLesson,
              hasBus: linkedParticipant.hasBus,
              hasRental: linkedParticipant.hasRental,
            }
          : null,
      };
    } else {
      linkedStatus = { linked: false, ownerApplied: false };
    }
  }

  return {
    userProfile: { memberType: dbUser.memberType, name: dbUser.name },
    participantOptionPricingGuide,
    companions: regularCompanions,
    myParticipant: myParticipant
      ? {
          id: myParticipant.id,
          status: myParticipant.status,
          waitlistPosition: myParticipant.waitlistPosition ?? null,
          note: myParticipant.note ?? "",
          hasLesson: !!myParticipant.hasLesson,
          hasBus: !!myParticipant.hasBus,
          hasRental: !!myParticipant.hasRental,
        }
      : null,
    signedUpCompanionData,
    linkedStatus,
  };
}
