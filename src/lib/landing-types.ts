import type { MeetingWithCounts } from "@/lib/types";

export type HomeUser = {
  kakaoId: string;
  nickname: string;
  profileImage?: string;
};

export type NoticeItem = {
  title: string;
  body: string;
  updatedAt: string;
};

export type SettlementSummary = {
  meeting: {
    id: number;
    date: string;
    startTime: string;
    endTime: string;
    location: string;
    settlementOpen: boolean;
  };
  group: {
    totalFee: number;
    items: {
      participantId: number;
      participantName: string;
      memberType: "REGULAR" | "COMPANION";
      baseFee: number;
      lessonFee: number;
      rentalFee: number;
      totalFee: number;
      adjustments: { id: number; label: string; amount: number }[];
    }[];
  };
};

export type SettlementAccount = {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
};

export type MeetingParticipantItem = {
  id: number;
  name: string;
  note: string | null;
  hasLesson: boolean;
  hasBus: boolean;
  hasRental: boolean;
  status: string;
  kakaoId: string;
  companionId: number | null;
  waitlistPosition?: number | null;
  profileImage?: string | null;
};

export type DetailedMeeting = MeetingWithCounts & {
  participantsList: MeetingParticipantItem[];
};

export type CompanionItem = {
  id: number;
  name: string;
};

export type SignedUpCompanionData = {
  participantId: number;
  hasLesson: boolean;
  hasBus: boolean;
  hasRental: boolean;
};

export type MyParticipantData = {
  id: number;
  status: string;
  waitlistPosition: number | null;
  note: string;
  hasLesson: boolean;
  hasBus: boolean;
  hasRental: boolean;
};

export type LinkedCompanionStatus = {
  linked: boolean;
  ownerApplied?: boolean;
  companion?: {
    id: number;
    name: string;
    owner: {
      name: string | null;
      kakaoId: string;
    };
  };
  participant?: {
    id: number;
    status: string;
    hasLesson: boolean;
    hasBus: boolean;
    hasRental: boolean;
  } | null;
};

export type SignupInitialData = {
  userProfile: {
    memberType: string;
    name: string | null;
  } | null;
  participantOptionPricingGuide: string;
  companions: CompanionItem[];
  myParticipant: MyParticipantData | null;
  signedUpCompanionData: Record<number, SignedUpCompanionData>;
  linkedStatus: LinkedCompanionStatus | null;
};

export type AdminSettlementRecipientSummary = {
  recipientKakaoId: string;
  recipientName: string;
  recipientType: "self" | "linked_companion" | "owner";
  totalFee: number;
  itemCount: number;
  confirmed: boolean;
  confirmedAt: string | null;
};

export type AdminSettlementStatusSummary = {
  meeting: {
    id: number;
    settlementOpen: boolean;
  };
  summary: {
    totalRecipientCount: number;
    confirmedCount: number;
    unconfirmedCount: number;
  };
  recipients: AdminSettlementRecipientSummary[];
};
