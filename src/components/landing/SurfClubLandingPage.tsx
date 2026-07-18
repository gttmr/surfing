"use client";

import { useEffect, useMemo, useState } from "react";
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
  UserNotificationItem,
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
  initialUserNotifications,
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
  initialUserNotifications: UserNotificationItem[];
  dbUnavailable?: boolean;
  initialSelectedDate?: string | null;
}) {
  const [userNotifications, setUserNotifications] = useState(initialUserNotifications);
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
  const hasUserNotifications = userNotifications.length > 0;
  const hasAlertCenter = hasNotices || hasPendingSettlement || hasUserNotifications;

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
  const selectedMeeting = selectedMeetings[0];
  const selectedMeetingDateLabel = selectedMeeting
    ? new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short" }).format(new Date(`${selectedMeeting.date}T12:00:00`))
    : "";
  const selectedSignup = selectedMeeting ? initialSignupDataByMeetingId[selectedMeeting.id] : null;
  const selectedParticipation = selectedSignup?.myParticipant;
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
  const selectedSettlementBadge = isAdmin ? String(Math.min(selectedSettlementPendingCount, 99)) : undefined;
  const calendarCells = buildCalendarCells(year, month);
  const canCreateMeetingOnSelectedDate = Boolean(
    user && selectedDate && selectedDate >= today && selectedMeetings.length === 0 && !dbUnavailable
  );
  const canCreateRegularMeeting = Boolean(isAdmin && canCreateMeetingOnSelectedDate);
  const canCreateIrregularMeeting = Boolean(canCreateMeetingOnSelectedDate);
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

    for (const notification of userNotifications) {
      const key = `notification:${notification.id}:${notification.createdAt}`;
      items.push({
        key,
        type: "order_cancelled",
        title: notification.title,
        subtitle: "주문 취소",
        unread: !notification.readAt,
        notification,
      });
    }

    return items;
  }, [notices, pendingSettlements, readAlertKeys, settlementProgressMeetingIds, userNotifications]);
  const hasUnreadAlerts = alertItems.some((item) => item.unread);

  function moveMonth(direction: -1 | 1) {
    const nextDate = new Date(year, month + direction, 1);
    const nextYear = nextDate.getFullYear();
    const nextMonth = nextDate.getMonth();
    setYear(nextYear);
    setMonth(nextMonth);
    setSelectedDate(findDefaultDateForMonth(meetings, nextYear, nextMonth, today));
  }

  function selectCalendarDate(date: string) {
    const next = new Date(`${date}T12:00:00`);
    setYear(next.getFullYear());
    setMonth(next.getMonth());
    setSelectedDate(date);
  }

  function handleOpenAlertCenter() {
    setIsAlertCenterOpen(true);
  }

  function handleToggleAlertItem(item: AlertItem) {
    setExpandedAlertKey((prev) => (prev === item.key ? null : item.key));
    if (item.type === "notice" && item.unread) {
      persistReadAlertKeys([...readAlertKeys, item.key]);
    }
    if (item.type === "order_cancelled" && item.unread) {
      const readAt = new Date().toISOString();
      setUserNotifications((prev) =>
        prev.map((notification) =>
          notification.id === item.notification.id ? { ...notification, readAt } : notification
        )
      );
      fetch(`/api/notifications/${item.notification.id}/read`, {
        method: "PATCH",
      }).catch(() => {});
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

      <main className="mx-auto flex w-full max-w-[430px] flex-col gap-6 px-4 pb-12 pt-24">
        <CalendarSection
          year={year}
          monthLabel={MONTH_NAMES_KO[month]}
          calendarCells={calendarCells}
          selectedDate={selectedDate}
          today={today}
          meetingsByDate={meetingsByDate}
          onMoveMonth={moveMonth}
          onSelectDate={selectCalendarDate}
        />

        {selectedDate && selectedMeeting && !dbUnavailable ? (
          <section aria-labelledby="selected-meeting-title" className="brand-card rounded-3xl p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="brand-text-subtle text-xs font-bold">선택한 모임</p>
                <h2 className="mt-1 font-headline text-xl font-extrabold tracking-[-0.04em]" id="selected-meeting-title">
                  {selectedMeetingDateLabel}
                </h2>
                <p className="brand-text-muted mt-2 text-sm leading-6">
                  {selectedMeeting.startTime}–{selectedMeeting.endTime} · {selectedMeeting.location}
                </p>
              </div>
              <span className="brand-chip-dark shrink-0 rounded-full px-3 py-1.5 text-xs font-bold">{selectedMeeting.meetingType}</span>
            </div>
            <div className="brand-panel-white mt-4 flex items-center justify-between gap-3 rounded-2xl px-4 py-3">
              <div className="min-w-0">
                <p className="brand-text-subtle text-xs font-semibold">지금 할 일</p>
                <p className="mt-1 text-sm font-extrabold text-[var(--brand-text)]">
                  {!user
                    ? "로그인하고 참가 여부 확인"
                    : !selectedParticipation
                      ? "참가 신청하기"
                      : selectedParticipation.status === "WAITLISTED"
                        ? `대기 ${selectedParticipation.waitlistPosition ?? ""}번 확인`
                        : "신청 내용 확인·변경"}
                </p>
              </div>
              {user ? (
                <Link className="brand-button-secondary shrink-0 rounded-xl px-3 py-2 text-sm font-bold" href="/settlement">
                  내 정산
                </Link>
              ) : null}
            </div>
          </section>
        ) : null}

        {selectedDate && user && hasSelectedMeetings && !dbUnavailable ? (
          <MeetingTabs
            activeTab={activeMeetingTab}
            participantBadge={selectedParticipantBadge}
            settlementBadge={selectedSettlementBadge}
            settlementLabel={isAdmin ? "정산 현황" : "내 정산"}
            showSettlementTab
            onChange={setActiveMeetingTab}
          >
            <section id="meeting-details">
              {activeMeetingTab === "settlement" && !isAdmin ? (
                <div className="brand-card-soft rounded-2xl p-5">
                  <div className="flex items-start gap-3">
                    <span className="brand-chip-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"><Icon name="payments" /></span>
                    <div>
                      <h3 className="text-base font-extrabold text-[var(--brand-text)]">내 정산 확인</h3>
                      <p className="brand-text-muted mt-1 text-sm leading-6">내 참가비와 연결된 동반인의 정산 내역을 한곳에서 확인합니다.</p>
                    </div>
                  </div>
                  <Link className="brand-button-primary mt-4 flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-bold" href="/settlement">
                    내 정산으로 이동
                  </Link>
                </div>
              ) : (
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
              )}
            </section>
          </MeetingTabs>
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

        {dbUnavailable ? (
          <section id="meeting-details">
            <div className="mb-3">
              <h2 className="font-headline text-[1.35rem] font-bold tracking-[-0.04em]">모임상세</h2>
            </div>
            <div className="brand-alert-info rounded-2xl px-5 py-6 text-center">
              <p className="text-sm font-bold">일정 정보를 불러오지 못했습니다.</p>
              <p className="brand-text-muted mt-1 text-xs">연결을 확인한 뒤 다시 시도해 주세요.</p>
              <button className="brand-button-secondary mt-4 rounded-xl px-4 py-2 text-sm font-bold" onClick={() => window.location.reload()} type="button">
                다시 시도
              </button>
            </div>
          </section>
        ) : null}

        {selectedDate && !hasSelectedMeetings && !dbUnavailable ? (
          <section className="brand-card-soft rounded-3xl px-5 py-7 text-center" role="status">
            <span className="brand-chip-soft mx-auto flex h-12 w-12 items-center justify-center rounded-2xl"><Icon name="event_busy" /></span>
            <h2 className="mt-3 text-base font-extrabold">이 날짜에는 모임이 없습니다.</h2>
            <p className="brand-text-muted mt-1 text-sm">다른 날짜를 선택하거나 새 비정기 모임을 만들어 보세요.</p>
          </section>
        ) : null}

        {canCreateMeetingOnSelectedDate ? (
          <section>
            <div className="grid gap-3">
              {canCreateRegularMeeting ? (
                <Link
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--brand-primary)] bg-[var(--brand-primary)] px-4 py-4 font-headline text-base font-extrabold text-[var(--brand-primary-foreground)] transition-colors hover:bg-[var(--brand-primary-hover)]"
                  href={`/admin/meetings?create=1&date=${encodeURIComponent(selectedDate!)}&type=${encodeURIComponent("정기")}`}
                >
                  정기 모임 생성
                  <Icon className="text-[20px]" name="add_circle" />
                </Link>
              ) : null}

              {canCreateIrregularMeeting ? (
                <Link
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--brand-primary-border)] bg-[var(--brand-primary-soft)] px-4 py-4 font-headline text-base font-extrabold text-[var(--brand-primary-text)] transition-colors hover:bg-[var(--brand-surface)]"
                  href={`/meeting/create?date=${encodeURIComponent(selectedDate!)}`}
                >
                  비정기 모임 생성
                  <Icon className="text-[20px]" name="add_circle" />
                </Link>
              ) : null}
            </div>
          </section>
        ) : null}
      </main>
    </div>
  );
}
