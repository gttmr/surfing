"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import type { MeetingWithCounts } from "@/lib/types";
import {
  findDefaultDateForMonth,
} from "@/lib/home-view";
import type {
  AdminSettlementStatusSummary,
  DetailedMeeting,
  HomeUser,
  NoticeItem,
  SettlementAccount,
  SettlementSummary,
  SignupInitialData,
} from "@/lib/landing-types";
import EmbeddedMeetingDetail from "./EmbeddedMeetingDetail";
import {
  AlertCenterModal,
  type AlertItem,
  CalendarSection,
  LandingHeader,
  MeetingTabs,
} from "./landing-page-sections";
import { useLandingState } from "./useLandingState";
import { formatWon, MONTH_NAMES_KO, pad } from "@/lib/format";
import { Icon } from "@/components/ui/Icon";
import { buildCalendarCells } from "@/lib/home-view";
import { buildTossTransferUrl } from "@/lib/toss";

function getSettlementAlertStatus(settlement: SettlementSummary, inProgressMeetingIds: number[]) {
  if (settlement.isCompleted) return "completed";
  if (inProgressMeetingIds.includes(settlement.meeting.id)) return "in_progress";
  return "pending";
}

export default function SurfClubLandingPage({
  meetings,
  user,
  isAdmin,
  notices,
  participantOptionPricingGuide,
  initialMeetingDetailsById,
  initialSignupDataByMeetingId,
  initialSettlementStatusByMeetingId,
  initialPendingSettlements,
  initialSettlementAccount,
  dbUnavailable = false,
  initialSelectedDate = null,
}: {
  meetings: MeetingWithCounts[];
  user: HomeUser | null;
  isAdmin: boolean;
  notices: NoticeItem[];
  participantOptionPricingGuide: string;
  initialMeetingDetailsById: Record<number, DetailedMeeting>;
  initialSignupDataByMeetingId: Record<number, SignupInitialData>;
  initialSettlementStatusByMeetingId: Record<number, AdminSettlementStatusSummary>;
  initialPendingSettlements: SettlementSummary[];
  initialSettlementAccount: SettlementAccount | null;
  dbUnavailable?: boolean;
  initialSelectedDate?: string | null;
}) {
  const {
    today,
    year,
    month,
    selectedDate,
    activeMeetingTab,
    isAlertCenterOpen,
    expandedAlertKey,
    readAlertKeys,
    settlementProgressMeetingIds,
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
    setSettlementAccount,
    persistReadAlertKeys,
    markSettlementInProgress,
    handleMeetingSummaryChange,
    handleSettlementStatusChange,
    handleSettlementCompletionChange,
  } = useLandingState({
    meetings,
    user,
    initialPendingSettlements,
    initialSettlementAccount,
    initialSelectedDate,
  });

  // P1: Settlement data lazy-loaded client-side instead of blocking SSR
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetch("/api/settlement/current")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (cancelled || !data) return;
        setPendingSettlements(data.pending ?? []);
        if (data.settlementAccount) {
          setSettlementAccount(data.settlementAccount);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [user, setPendingSettlements, setSettlementAccount]);

  const hasNotices = notices.length > 0;
  const hasPendingSettlement = pendingSettlements.length > 0;
  const hasAlertCenter = hasNotices || hasPendingSettlement;

  async function markSettlementCompleted(meetingId: number, completed = true, keepalive = false) {
    try {
      const res = await fetch("/api/settlement/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId, completed }),
        keepalive,
      });
      if (!res.ok) return false;
      const completedAt = completed ? new Date().toISOString() : null;
      setPendingSettlements((prev) =>
        prev.map((item) =>
          item.meeting.id === meetingId
            ? {
                ...item,
                isCompleted: completed,
                completedAt,
              }
            : item
        )
      );
      if (user?.kakaoId) {
        handleSettlementCompletionChange(meetingId, user.kakaoId, completed, completedAt);
      }
      return true;
    } catch {
      return false;
    }
  }

  async function copySettlementAccount(meetingId: number) {
    if (!settlementAccount?.accountNumber) return;
    try {
      await navigator.clipboard.writeText(settlementAccount.accountNumber);
      markSettlementInProgress(meetingId);
    } catch {
      // no-op
    }
  }

  function openTossTransfer(meetingId: number, amount?: number) {
    if (!settlementAccount) return;
    const tossUrl = buildTossTransferUrl(settlementAccount, amount);
    if (!tossUrl) return;
    markSettlementInProgress(meetingId);
    window.location.href = tossUrl;
  }

  const meetingsByDate = sortedMeetings.reduce<Record<string, MeetingWithCounts[]>>((acc, meeting) => {
    if (!acc[meeting.date]) acc[meeting.date] = [];
    acc[meeting.date].push({
      ...meeting,
      approvedCount: meetingApprovedCountOverrides[meeting.id] ?? meeting.approvedCount,
    });
    return acc;
  }, {});

  const monthKey = `${year}-${pad(month + 1)}`;
  const monthMeetings = sortedMeetings.filter((meeting) => meeting.date.startsWith(monthKey));
  const selectedMeetings = selectedDate ? (meetingsByDate[selectedDate] ?? []) : monthMeetings;
  const hasSelectedMeetings = selectedMeetings.length > 0;
  const loginReturnTo = selectedDate ? `/?date=${selectedDate}` : "/";
  const selectedParticipantCount = selectedMeetings.reduce(
    (sum, meeting) => sum + (meetingParticipantCountOverrides[meeting.id] ?? meeting.approvedCount),
    0
  );
  const selectedParticipantBadge = String(Math.min(selectedParticipantCount, 99));
  const selectedSettlementPendingCount = isAdmin
    ? selectedMeetings.reduce((sum, meeting) => {
        const status = meetingSettlementStatusOverrides[meeting.id] ?? initialSettlementStatusByMeetingId[meeting.id];
        return sum + (status?.summary.pendingCount ?? 0);
      }, 0)
    : 0;
  const selectedSettlementBadge = String(Math.min(selectedSettlementPendingCount, 99));
  const calendarCells = buildCalendarCells(year, month);
  const canCreateIrregularMeeting = Boolean(user && selectedDate && selectedDate >= today && selectedMeetings.length === 0 && !dbUnavailable);
  const alertItems = useMemo<AlertItem[]>(() => {
    const items: AlertItem[] = [];

    for (const settlement of pendingSettlements) {
      const settlementStatus = getSettlementAlertStatus(settlement, settlementProgressMeetingIds);
      const key = `settlement:${settlement.meeting.id}:${settlement.group.totalFee}:${settlement.group.items.length}`;
      items.push({
        key,
        type: "settlement",
        title: `${settlement.meeting.date} 정산 안내`,
        subtitle:
          settlementStatus === "completed"
            ? `총 ${formatWon(settlement.group.totalFee)} · 송금 완료`
            : settlementStatus === "in_progress"
              ? `총 ${formatWon(settlement.group.totalFee)} · 송금 진행 중`
              : `총 ${formatWon(settlement.group.totalFee)} · 정산 필요`,
        unread: settlementStatus !== "completed",
        settlementStatus,
        settlement,
      });
    }

    for (const notice of notices) {
      const key = `notice:${notice.id}:${notice.updatedAt}`;
      items.push({
        key,
        type: "notice",
        title: notice.title,
        subtitle: notice.isPinned ? "공지사항 · 공지 상단 고정" : "공지사항",
        unread: !readAlertKeys.includes(key),
        notice,
      });
    }

    return items;
  }, [notices, pendingSettlements, readAlertKeys, settlementProgressMeetingIds]);
  const hasUnreadAlerts = alertItems.some((item) => item.unread);

  function moveMonth(direction: -1 | 1) {
    const nextDate = new Date(year, month + direction, 1);
    const nextYear = nextDate.getFullYear();
    const nextMonth = nextDate.getMonth();
    setYear(nextYear);
    setMonth(nextMonth);
    setSelectedDate(findDefaultDateForMonth(meetings, nextYear, nextMonth, today));
  }

  function handleOpenAlertCenter() {
    setIsAlertCenterOpen(true);
  }

  function handleToggleAlertItem(item: AlertItem) {
    setExpandedAlertKey((prev) => (prev === item.key ? null : item.key));
    if (item.type === "notice" && item.unread) {
      persistReadAlertKeys([...readAlertKeys, item.key]);
    }
  }

  return (
    <div className="min-h-screen bg-[var(--brand-page)] text-[var(--brand-text)]">
      <LandingHeader
        user={user}
        hasAlertCenter={hasAlertCenter}
        isAlertCenterOpen={isAlertCenterOpen}
        hasUnreadAlerts={hasUnreadAlerts}
        onOpenAlertCenter={handleOpenAlertCenter}
      />

      <AlertCenterModal
        open={hasAlertCenter && isAlertCenterOpen}
        alertItems={alertItems}
        expandedAlertKey={expandedAlertKey}
        settlementAccount={settlementAccount}
        onClose={() => setIsAlertCenterOpen(false)}
        onToggleItem={handleToggleAlertItem}
        onOpenTossTransfer={openTossTransfer}
        onCopySettlementAccount={(meetingId) => {
          void copySettlementAccount(meetingId);
        }}
        onToggleSettlementCompleted={(meetingId, completed) => {
          void markSettlementCompleted(meetingId, completed);
        }}
      />

      <main className="mx-auto flex w-full max-w-[390px] flex-col gap-6 px-4 pb-12 pt-24">
        <CalendarSection
          year={year}
          monthLabel={MONTH_NAMES_KO[month]}
          calendarCells={calendarCells}
          selectedDate={selectedDate}
          today={today}
          meetingsByDate={meetingsByDate}
          onMoveMonth={moveMonth}
          onSelectDate={setSelectedDate}
        />

        {selectedDate && user && hasSelectedMeetings && !dbUnavailable ? (
          <MeetingTabs
            activeTab={activeMeetingTab}
            participantBadge={selectedParticipantBadge}
            settlementBadge={selectedSettlementBadge}
            showSettlementTab={isAdmin}
            onChange={setActiveMeetingTab}
          />
        ) : null}

        {!user ? (
          <section>
            <a
              className="brand-button-primary flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-4 font-headline text-base font-extrabold transition-all active:scale-[0.99]"
              href={`/api/auth/kakao?returnTo=${encodeURIComponent(loginReturnTo)}`}
            >
              카카오로 로그인
              <Icon className="text-[20px]" name="login" />
            </a>
          </section>
        ) : null}

        {selectedDate && user && (dbUnavailable || hasSelectedMeetings) ? (
          <section id="meeting-details">
            {!hasSelectedMeetings || dbUnavailable ? (
              <div className="mb-3">
              <h2 className="font-headline text-[1.35rem] font-bold tracking-[-0.04em]">모임상세</h2>
              </div>
            ) : null}

            {dbUnavailable ? (
              <div className="brand-alert-info rounded-2xl px-5 py-6 text-sm font-medium">
                현재 데이터베이스 연결을 확인할 수 없어 일정 정보를 불러오지 못했습니다.
              </div>
            ) : user && selectedMeetings.length > 0 ? (
              <div className="space-y-4">
                {selectedMeetings.map((meeting) => (
                  <EmbeddedMeetingDetail
                    activeTab={activeMeetingTab}
                    currentUser={user}
                    initialMeeting={initialMeetingDetailsById[meeting.id]}
                    initialSettlementStatus={initialSettlementStatusByMeetingId[meeting.id]}
                    initialSignupData={initialSignupDataByMeetingId[meeting.id]}
                    isAdmin={isAdmin}
                    key={meeting.id}
                    meetingId={meeting.id}
                    onMeetingSummaryChange={handleMeetingSummaryChange}
                    onSettlementStatusChange={handleSettlementStatusChange}
                    participantOptionPricingGuide={participantOptionPricingGuide}
                  />
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {canCreateIrregularMeeting ? (
          <section>
            <Link
              className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand-primary)] px-4 py-4 font-headline text-base font-extrabold text-[var(--brand-primary-foreground)] shadow-sm transition-all hover:bg-[var(--brand-primary-hover)]"
              href={`/meeting/create?date=${encodeURIComponent(selectedDate!)}`}
            >
              비정기모임 생성하기
              <Icon className="text-[20px]" name="add_circle" />
            </Link>
          </section>
        ) : null}
      </main>
    </div>
  );
}
