"use client";

import { useEffect, useMemo, useState } from "react";
import type { MeetingWithCounts } from "@/lib/types";
import { getTodayInSeoul } from "@/lib/date";
import {
  findInitialView,
  normalizeSelectedDate,
  sortMeetings,
} from "@/lib/home-view";
import type {
  AdminSettlementStatusSummary,
  HomeUser,
  SettlementAccount,
  SettlementSummary,
} from "@/lib/landing-types";

const ALERT_STORAGE_PREFIX = "surfing.alert.read.";

function alertStorageKey(kakaoId?: string) {
  return `${ALERT_STORAGE_PREFIX}${kakaoId ?? "guest"}`;
}

export function useLandingState({
  meetings,
  user,
  initialPendingSettlements,
  initialSettlementAccount,
  initialSelectedDate,
}: {
  meetings: MeetingWithCounts[];
  user: HomeUser | null;
  initialPendingSettlements: SettlementSummary[];
  initialSettlementAccount: SettlementAccount | null;
  initialSelectedDate?: string | null;
}) {
  const today = getTodayInSeoul();
  const requestedDate = normalizeSelectedDate(initialSelectedDate);
  const initialView = findInitialView(meetings, today, requestedDate);

  const [year, setYear] = useState(initialView.year);
  const [month, setMonth] = useState(initialView.month);
  const [selectedDate, setSelectedDate] = useState<string | null>(initialView.selectedDate);
  const [activeMeetingTab, setActiveMeetingTab] = useState<"apply" | "status" | "settlement">("apply");
  const [isAlertCenterOpen, setIsAlertCenterOpen] = useState(false);
  const [expandedAlertKey, setExpandedAlertKey] = useState<string | null>(null);
  const [readAlertKeys, setReadAlertKeys] = useState<string[]>([]);
  const [pendingSettlements, setPendingSettlements] = useState<SettlementSummary[]>(initialPendingSettlements);
  const [settlementAccount, setSettlementAccount] = useState<SettlementAccount | null>(initialSettlementAccount);
  const [meetingApprovedCountOverrides, setMeetingApprovedCountOverrides] = useState<Record<number, number>>({});
  const [meetingParticipantCountOverrides, setMeetingParticipantCountOverrides] = useState<Record<number, number>>({});
  const [meetingSettlementStatusOverrides, setMeetingSettlementStatusOverrides] = useState<Record<number, AdminSettlementStatusSummary>>({});

  const sortedMeetings = useMemo(() => sortMeetings(meetings), [meetings]);

  useEffect(() => {
    async function syncViewState() {
      const nextView = findInitialView(meetings, today, requestedDate);
      setYear(nextView.year);
      setMonth(nextView.month);
      setSelectedDate(nextView.selectedDate);
    }

    void syncViewState();
  }, [meetings, requestedDate, today]);

  useEffect(() => {
    async function resetActiveMeetingTab() {
      setActiveMeetingTab("apply");
    }

    void resetActiveMeetingTab();
  }, [selectedDate]);

  useEffect(() => {
    async function syncSettlementState() {
      setPendingSettlements(initialPendingSettlements);
      setSettlementAccount(initialSettlementAccount);
    }

    void syncSettlementState();
  }, [initialPendingSettlements, initialSettlementAccount]);

  useEffect(() => {
    async function syncReadAlertKeys() {
      if (typeof window === "undefined") return;
      try {
        const raw = window.localStorage.getItem(alertStorageKey(user?.kakaoId));
        const parsed = raw ? JSON.parse(raw) : [];
        setReadAlertKeys(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []);
      } catch {
        setReadAlertKeys([]);
      }
    }

    void syncReadAlertKeys();
  }, [user?.kakaoId]);

  function persistReadAlertKeys(nextKeys: string[]) {
    setReadAlertKeys(nextKeys);
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(alertStorageKey(user?.kakaoId), JSON.stringify(nextKeys));
    } catch {
      // no-op
    }
  }

  function handleMeetingSummaryChange(meetingId: number, approvedCount: number, participantCount: number) {
    setMeetingApprovedCountOverrides((prev) => (
      prev[meetingId] === approvedCount ? prev : { ...prev, [meetingId]: approvedCount }
    ));
    setMeetingParticipantCountOverrides((prev) => (
      prev[meetingId] === participantCount ? prev : { ...prev, [meetingId]: participantCount }
    ));
  }

  function handleSettlementStatusChange(meetingId: number, status: AdminSettlementStatusSummary) {
    setMeetingSettlementStatusOverrides((prev) => (
      prev[meetingId]?.summary.pendingCount === status.summary.pendingCount &&
      prev[meetingId]?.summary.completedCount === status.summary.completedCount &&
      prev[meetingId]?.meeting.settlementOpen === status.meeting.settlementOpen
        ? prev
        : { ...prev, [meetingId]: status }
    ));
  }

  function handleSettlementCompletionChange(
    meetingId: number,
    recipientKakaoId: string,
    completed: boolean,
    completedAt: string | null
  ) {
    setMeetingSettlementStatusOverrides((prev) => {
      const current = prev[meetingId];
      if (!current) return prev;

      const recipient = current.recipients.find((item) => item.recipientKakaoId === recipientKakaoId);
      if (!recipient || recipient.completed === completed) return prev;

      const nextRecipients = current.recipients.map((item) =>
        item.recipientKakaoId === recipientKakaoId
          ? { ...item, completed, completedAt }
          : item
      );

      const nextCompletedCount = nextRecipients.filter((item) => item.completed).length;
      const nextPendingCount = nextRecipients.length - nextCompletedCount;

      return {
        ...prev,
        [meetingId]: {
          ...current,
          recipients: nextRecipients,
          summary: {
            ...current.summary,
            completedCount: nextCompletedCount,
            pendingCount: nextPendingCount,
          },
        },
      };
    });
  }

  return {
    today,
    year,
    month,
    selectedDate,
    activeMeetingTab,
    isAlertCenterOpen,
    expandedAlertKey,
    readAlertKeys,
    pendingSettlements,
    settlementAccount,
    meetingApprovedCountOverrides,
    meetingParticipantCountOverrides,
    meetingSettlementStatusOverrides,
    sortedMeetings,
    setYear,
    setMonth,
    setSelectedDate,
    setActiveMeetingTab,
    setIsAlertCenterOpen,
    setExpandedAlertKey,
    setPendingSettlements,
    persistReadAlertKeys,
    handleMeetingSummaryChange,
    handleSettlementStatusChange,
    handleSettlementCompletionChange,
  };
}
