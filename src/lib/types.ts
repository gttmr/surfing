export type ParticipantStatus = "APPROVED" | "WAITLISTED" | "CANCELLED";

export interface MeetingWithCounts {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string | null;
  isOpen: boolean;
  meetingType: string;
  createdByKakaoId: string | null;
  approvedCount: number;
}

