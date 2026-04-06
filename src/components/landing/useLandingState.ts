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
  const [activeMeetingTab, setActiveMeetingTab] = useState<"apply" | "status">("apply");
  const [isAlertCenterOpen, setIsAlertCenterOpen] = useState(false);
  const [expandedAlertKey, setExpandedAlertKey] = useState<string | null>(null);
  const [readAlertKeys, setReadAlertKeys] = useState<string[]>([]);
  const [pendingSettlements, setPendingSettlements] = useState<SettlementSummary[]>(initialPendingSettlements);
  const [settlementAccount, setSettlementAccount] = useState<SettlementAccount | null>(initialSettlementAccount);
  const [meetingApprovedCountOverrides, setMeetingApprovedCountOverrides] = useState<Record<number, number>>({});

  const sortedMeetings = useMemo(() => sortMeetings(meetings), [meetings]);

  useEffect(() => {
    const nextView = findInitialView(meetings, today, requestedDate);
    setYear(nextView.year);
    setMonth(nextView.month);
    setSelectedDate(nextView.selectedDate);
  }, [meetings, requestedDate, today]);

  useEffect(() => {
    setActiveMeetingTab("apply");
  }, [selectedDate]);

  useEffect(() => {
    setPendingSettlements(initialPendingSettlements);
    setSettlementAccount(initialSettlementAccount);
  }, [initialPendingSettlements, initialSettlementAccount]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(alertStorageKey(user?.kakaoId));
      const parsed = raw ? JSON.parse(raw) : [];
      setReadAlertKeys(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : []);
    } catch {
      setReadAlertKeys([]);
    }
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

  function handleMeetingSummaryChange(meetingId: number, approvedCount: number) {
    setMeetingApprovedCountOverrides((prev) => (
      prev[meetingId] === approvedCount ? prev : { ...prev, [meetingId]: approvedCount }
    ));
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
  };
}
