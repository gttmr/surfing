"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { MeetingWithCounts } from "@/lib/types";
import {
  findDefaultDateForMonth,
} from "@/lib/home-view";
import type {
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
  PendingBillingAlert,
} from "./landing-page-sections";
import { useLandingState } from "./useLandingState";
import { formatWon, MONTH_NAMES_KO, pad } from "@/lib/format";
import { Icon } from "@/components/ui/Icon";
import { buildCalendarCells } from "@/lib/home-view";
import { MemberDock } from "@/components/ui/MobileShell";
import { getOvernightMeetingSpan } from "@/lib/meeting-group";

const MEETING_DATE_FORMATTER = new Intl.DateTimeFormat("ko-KR", {
  month: "long",
  day: "numeric",
  weekday: "short",
});

function getSettlementAlertStatus(settlement: SettlementSummary) {
  if (settlement.paymentStatus === "VERIFIED" || settlement.paymentStatus === "NO_PAYMENT_REQUIRED") return "completed";
  if (settlement.paymentStatus === "REPORTED") return "in_progress";
  return "pending";
}

function isActionableSettlement(settlement: SettlementSummary) {
  return settlement.paymentStatus === "PAYMENT_REQUIRED" || settlement.paymentStatus === "REPORTED";
}

export default function SurfClubLandingPage({
  meetings,
  user,
  isAdmin,
  notices,
  participantOptionPricingGuide,
  initialMeetingDetailsById,
  initialSignupDataByMeetingId,
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
    pendingSettlements,
    meetingApprovedCountOverrides,
    meetingParticipantCountOverrides,
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
  } = useLandingState({
    meetings,
    user,
    initialPendingSettlements,
    initialSettlementAccount,
    initialSelectedDate,
  });

  // 청구는 홈 렌더링을 막지 않되, 앱 복귀 시 운영진 확인 결과를 바로 반영한다.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let controller: AbortController | null = null;

    async function refreshPendingSettlements() {
      controller?.abort();
      controller = new AbortController();

      try {
        const response = await fetch("/api/settlement/current", {
          cache: "no-store",
          signal: controller.signal,
        });
        const data = response.ok ? await response.json() : null;
        if (cancelled || !data) return;
        setPendingSettlements(data.pending ?? []);
      } catch {
        // 이전 청구 상태를 유지하고 다음 새로고침에서 다시 확인한다.
      }
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        void refreshPendingSettlements();
      }
    }

    void refreshPendingSettlements();
    const refreshTimer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void refreshPendingSettlements();
      }
    }, 15_000);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      cancelled = true;
      controller?.abort();
      window.clearInterval(refreshTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [user, setPendingSettlements]);

  const actionableSettlements = useMemo(
    () => pendingSettlements.filter(isActionableSettlement),
    [pendingSettlements]
  );
  const hasNotices = notices.length > 0;
  const hasPendingSettlement = actionableSettlements.length > 0;
  const hasUserNotifications = userNotifications.length > 0;
  const hasAlertCenter = hasNotices || hasPendingSettlement || hasUserNotifications;

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
  const meetingsById = new Map(sortedMeetings.map((meeting) => [meeting.id, meeting]));
  const selectedSourceMeetings = selectedDate ? (meetingsByDate[selectedDate] ?? []) : monthMeetings;
  const selectedMeetings = selectedSourceMeetings.reduce<MeetingWithCounts[]>((result, meeting) => {
    const canonicalMeeting = meeting.overnightGroup?.days[0]?.id
      ? meetingsById.get(meeting.overnightGroup.days[0].id) ?? meeting
      : meeting;
    if (!result.some((item) => item.id === canonicalMeeting.id)) result.push(canonicalMeeting);
    return result;
  }, []);
  const hasSelectedMeetings = selectedMeetings.length > 0;
  const selectedMeeting = selectedMeetings[0];
  const selectedOvernightSpan = selectedMeeting?.overnightGroup
    ? getOvernightMeetingSpan(selectedMeeting.overnightGroup)
    : null;
  const selectedMeetingDateLabel = selectedMeeting
    ? selectedOvernightSpan
      ? [selectedOvernightSpan.startDate, selectedOvernightSpan.endDate]
          .map((date) => MEETING_DATE_FORMATTER.format(new Date(`${date}T12:00:00`)))
          .join("–")
      : MEETING_DATE_FORMATTER.format(new Date(`${selectedMeeting.date}T12:00:00`))
    : "";
  const selectedMeetingDescription = selectedMeeting?.overnightGroup
    ? (() => {
        const dailyDescriptions = selectedMeeting.overnightGroup.days.map((day) => ({
          dayIndex: day.dayIndex,
          description: initialMeetingDetailsById[day.id]?.description?.trim() ?? "",
        }));
        const descriptions = dailyDescriptions.map((day) => day.description).filter(Boolean);
        if (descriptions.length === 0) return "운영진이 등록한 추가 안내가 없습니다.";
        if (descriptions.length === dailyDescriptions.length && new Set(descriptions).size === 1) return descriptions[0];
        return dailyDescriptions
          .map((day) => `${day.dayIndex}일차${day.description ? `\n${day.description}` : " · 추가 안내 없음"}`)
          .join("\n\n");
      })()
    : selectedMeeting?.description || "운영진이 등록한 추가 안내가 없습니다.";
  const selectedSignup = selectedMeeting ? initialSignupDataByMeetingId[selectedMeeting.id] : null;
  const selectedParticipation = selectedSignup?.myParticipant;
  const loginReturnTo = selectedDate ? `/?date=${selectedDate}` : "/";
  const selectedParticipantCount = selectedMeetings.reduce(
    (sum, meeting) => sum + (meetingParticipantCountOverrides[meeting.id] ?? meeting.approvedCount),
    0
  );
  const selectedParticipantBadge = String(Math.min(selectedParticipantCount, 99));
  const calendarCells = buildCalendarCells(year, month);
  const canCreateMeetingOnSelectedDate = Boolean(
    user && selectedDate && selectedDate >= today && selectedMeetings.length === 0 && !dbUnavailable
  );
  const canCreateRegularMeeting = Boolean(isAdmin && canCreateMeetingOnSelectedDate);
  const canCreateIrregularMeeting = Boolean(canCreateMeetingOnSelectedDate);
  const alertItems = useMemo<AlertItem[]>(() => {
    const items: AlertItem[] = [];

    for (const settlement of actionableSettlements) {
      const settlementStatus = getSettlementAlertStatus(settlement);
      const key = `settlement:${settlement.meeting.id}:${settlement.group.totalFee}:${settlement.group.items.length}`;
      items.push({
        key,
        type: "settlement",
        title: `${settlement.meeting.date} 청구 내역`,
        subtitle:
          settlementStatus === "completed"
            ? `총 ${formatWon(settlement.group.totalFee)} · 입금 완료`
            : settlementStatus === "in_progress"
              ? `총 ${formatWon(settlement.group.totalFee)} · 입금 확인 중`
              : `총 ${formatWon(settlement.group.totalFee)} · 입금 필요`,
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
  }, [actionableSettlements, notices, readAlertKeys, userNotifications]);
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
    <div className="min-h-screen bg-brand-page text-brand-text">
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
        onClose={() => setIsAlertCenterOpen(false)}
        onToggleItem={handleToggleAlertItem}
      />

      <main className={`mx-auto flex w-full max-w-[430px] flex-col gap-6 px-4 pt-24 ${user ? "pb-28" : "pb-12"}`}>
        <PendingBillingAlert settlements={actionableSettlements} />

        {selectedDate && selectedMeeting && !dbUnavailable ? (
          <section aria-labelledby="selected-meeting-title" className="border-b border-brand-divider pb-5">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="brand-text-subtle text-xs font-bold">선택한 모임</p>
                <h2 className="mt-1 font-headline text-xl font-extrabold tracking-[-0.04em]" id="selected-meeting-title">
                  {selectedMeetingDateLabel}
                </h2>
                {selectedOvernightSpan ? (
                  <p className="brand-text-muted mt-2 text-sm leading-6">
                    {selectedOvernightSpan.startTime} 시작 · {selectedOvernightSpan.endTime} 종료 · {selectedOvernightSpan.location}
                  </p>
                ) : (
                  <p className="brand-text-muted mt-2 text-sm leading-6">
                    {selectedMeeting.startTime}–{selectedMeeting.endTime} · {selectedMeeting.location}
                  </p>
                )}
              </div>
              <span className="brand-chip-dark shrink-0 rounded-full px-3 py-1.5 text-xs font-bold">
                {selectedMeeting.overnightGroup ? `1박 2일 · ${selectedMeeting.meetingType}` : selectedMeeting.meetingType}
              </span>
            </div>
            <div className="mt-4 rounded-2xl bg-brand-primary-soft px-4 py-3">
              <p className="brand-text-subtle text-xs font-semibold">지금 할 일</p>
              <p className="mt-1 text-sm font-extrabold text-brand-text">
                {!user
                  ? "로그인하고 참가 여부 확인"
                  : !selectedParticipation
                    ? "참가 신청하기"
                    : selectedParticipation.status === "WAITLISTED"
                      ? `대기 ${selectedParticipation.waitlistPosition ?? ""}번 확인`
                      : "신청 내용 확인·변경"}
              </p>
            </div>
          </section>
        ) : null}

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

        {selectedDate && user && hasSelectedMeetings && !dbUnavailable ? (
          <MeetingTabs
            activeTab={activeMeetingTab}
            participantBadge={selectedParticipantBadge}
            settlementLabel="모임 안내"
            showSettlementTab
            onChange={setActiveMeetingTab}
          >
            <section id="meeting-details">
              {activeMeetingTab === "settlement" ? (
                <div className="border-y border-brand-divider py-5">
                  <div className="flex items-start gap-3">
                    <span className="brand-chip-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl"><Icon name="info" /></span>
                    <div>
                      <h3 className="text-base font-extrabold text-brand-text">모임 안내</h3>
                      <p className="brand-text-muted mt-1 whitespace-pre-line text-sm leading-6">
                        {selectedMeetingDescription}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {selectedMeetings.map((meeting) => (
                  <EmbeddedMeetingDetail
                    activeTab={activeMeetingTab}
                    currentUser={user}
                    initialMeeting={initialMeetingDetailsById[meeting.id]}
                    initialSignupData={initialSignupDataByMeetingId[meeting.id]}
                    isAdmin={isAdmin}
                    key={meeting.id}
                    meetingId={meeting.id}
                    onMeetingSummaryChange={handleMeetingSummaryChange}
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
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-brand-primary bg-brand-primary px-4 py-4 font-headline text-base font-extrabold text-brand-primary-foreground transition-colors hover:bg-brand-primary-hover"
                  href={`/admin/meetings?create=1&date=${encodeURIComponent(selectedDate!)}&type=${encodeURIComponent("정기")}`}
                >
                  정기 모임 생성
                  <Icon className="text-[20px]" name="add_circle" />
                </Link>
              ) : null}

              {canCreateIrregularMeeting ? (
                <Link
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-brand-primary-border bg-brand-primary-soft px-4 py-4 font-headline text-base font-extrabold text-brand-primary-text transition-colors hover:bg-brand-surface"
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
      {user ? <MemberDock /> : null}
    </div>
  );
}
