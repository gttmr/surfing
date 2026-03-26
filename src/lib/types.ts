export type ParticipantStatus = "APPROVED" | "WAITLISTED" | "CANCELLED";

export interface MeetingWithCounts {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  maxCapacity: number;
  description: string | null;
  isOpen: boolean;
  approvedCount: number;
  waitlistedCount: number;
}

export const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];
