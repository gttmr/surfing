"use client";

import { useMemo } from "react";
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
} from "@/lib/landing-types";
import EmbeddedMeetingDetail from "./EmbeddedMeetingDetail";
import {
  AlertCenterModal,
  type AlertItem,
  type CalendarCell,
  CalendarSection,
  LandingHeader,
  MeetingTabs,
} from "./landing-page-sections";
import { useLandingState } from "./useLandingState";
const DAY_KO = ["일", "월", "화", "수", "목", "금", "토"];
const MONTH_NAMES_KO = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];
function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatWon(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function buildTossTransferUrl(account: SettlementAccount, amount?: number) {
  const accountNumber = account.accountNumber.replace(/[^\d-]/g, "");
  if (!account.bankName || !accountNumber) return null;

  const params = new URLSearchParams({
    bank: account.bankName,
    accountNo: accountNumber,
  });
  if (amount && amount > 0) {
    params.set("amount", String(amount));
  }

  return `supertoss://send?${params.toString()}`;
}

function buildCalendarCells(year: number, month: number) {
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


function meetingTypeClass(meetingType: string) {
  return "brand-chip-soft";
}

function Icon({
  name,
  className = "",
}: {
  name: string;
  className?: string;
}) {
  return (
    <span aria-hidden className={`material-symbols-outlined leading-none ${className}`}>
      {name}
    </span>
  );
}

function MeetingAction({
  meeting,
  loggedIn,
  today,
}: {
  meeting: MeetingWithCounts;
  loggedIn: boolean;
  today: string;
}) {
  const isPast = meeting.date < today;
  const isClosed = !meeting.isOpen;

  if (isPast || isClosed) {
    return (
      <div className="brand-panel flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-4 font-headline text-base font-extrabold brand-text-subtle">
        {isPast ? "지난 모임" : "모집 마감"}
      </div>
    );
  }

  if (!loggedIn) {
    const returnTo = `/?date=${meeting.date}`;
    return (
      <a
        className="brand-button-primary flex w-full items-center justify-center gap-2 rounded-2xl px-4 py-4 font-headline text-base font-extrabold transition-all active:scale-[0.99]"
        href={`/api/auth/kakao?returnTo=${encodeURIComponent(returnTo)}`}
      >
        로그인 후 참가하기
        <Icon className="text-[20px]" name="login" />
      </a>
    );
  }

  return (
    <div className="brand-highlight-panel rounded-2xl px-4 py-3 text-center text-sm font-semibold">
      아래 상세 영역에서 바로 신청할 수 있습니다.
    </div>
  );
}

function MeetingCard({
  meeting,
  loggedIn,
  today,
}: {
  meeting: MeetingWithCounts;
  loggedIn: boolean;
  today: string;
}) {
  const dateObj = new Date(`${meeting.date}T00:00:00`);
  const dayName = DAY_KO[dateObj.getDay()];
  const [, month, day] = meeting.date.split("-");

  return (
    <article className="brand-card-soft overflow-hidden rounded-2xl">
      <div className="p-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <p className="brand-text-subtle mb-1 text-[10px] font-bold uppercase tracking-[0.32em]">날짜</p>
            <p className="font-headline text-[1.35rem] font-bold tracking-[-0.04em]">
              {parseInt(month, 10)}월 {parseInt(day, 10)}일 ({dayName})
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${meetingTypeClass(meeting.meetingType)}`}>
              {meeting.meetingType}
            </span>
            <span className="brand-chip-dark rounded-full px-2.5 py-1 text-[10px] font-bold">
              참가자 {meeting.approvedCount}명
            </span>
          </div>
        </div>

        <div className="mb-6 space-y-2.5">
          <div className="brand-text-muted flex items-center gap-2 text-sm">
            <Icon className="text-[18px]" name="schedule" />
            <span>{meeting.startTime} - {meeting.endTime}</span>
          </div>
          <div className="brand-text-muted flex items-center gap-2 text-sm">
            <Icon className="text-[18px]" name="location_on" />
            <span>{meeting.location}</span>
          </div>
          {meeting.description ? (
            <div className="brand-text-muted flex items-start gap-2 text-sm">
              <Icon className="mt-0.5 text-[18px]" name="info" />
              <span className="line-clamp-3">{meeting.description}</span>
            </div>
          ) : null}
        </div>

        <MeetingAction loggedIn={loggedIn} meeting={meeting} today={today} />
      </div>
    </article>
  );
}

export default function SurfClubLandingPage({
  meetings,
  user,
  isAdmin,
  pinnedNotice,
  participantOptionPricingGuide,
  initialMeetingDetailsById,
  initialSignupDataByMeetingId,
  initialPendingSettlements,
  initialSettlementAccount,
  dbUnavailable = false,
  initialSelectedDate = null,
}: {
  meetings: MeetingWithCounts[];
  user: HomeUser | null;
  isAdmin: boolean;
  pinnedNotice: NoticeItem | null;
  participantOptionPricingGuide: string;
  initialMeetingDetailsById: Record<number, DetailedMeeting>;
  initialSignupDataByMeetingId: Record<number, SignupInitialData>;
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
  } = useLandingState({
    meetings,
    user,
    initialPendingSettlements,
    initialSettlementAccount,
    initialSelectedDate,
  });

  const hasPinnedNotice = Boolean(pinnedNotice);
  const hasPendingSettlement = pendingSettlements.length > 0;
  const hasAlertCenter = hasPinnedNotice || hasPendingSettlement;

  async function markSettlementConfirmed(meetingId: number, keepalive = false) {
    try {
      const res = await fetch("/api/settlement/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId }),
        keepalive,
      });
      if (!res.ok) return false;
      setPendingSettlements((prev) => prev.filter((item) => item.meeting.id !== meetingId));
      return true;
    } catch {
      return false;
    }
  }

  async function copySettlementAccount(meetingId: number) {
    if (!settlementAccount?.accountNumber) return;
    try {
      await navigator.clipboard.writeText(settlementAccount.accountNumber);
      await markSettlementConfirmed(meetingId);
    } catch {
      // no-op
    }
  }

  function openTossTransfer(meetingId: number, amount?: number) {
    if (!settlementAccount) return;
    const tossUrl = buildTossTransferUrl(settlementAccount, amount);
    if (!tossUrl) return;
    void markSettlementConfirmed(meetingId, true);
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
  const selectedParticipantCount = selectedMeetings.reduce((sum, meeting) => sum + meeting.approvedCount, 0);
  const selectedParticipantBadge = String(Math.min(selectedParticipantCount, 99));
  const calendarCells = buildCalendarCells(year, month);
  const canCreateIrregularMeeting = Boolean(user && selectedDate && selectedDate >= today && selectedMeetings.length === 0 && !dbUnavailable);
  const alertItems = useMemo<AlertItem[]>(() => {
    const items: AlertItem[] = [];

    if (pinnedNotice) {
      const key = `notice:${pinnedNotice.updatedAt}`;
      items.push({
        key,
        type: "notice",
        title: pinnedNotice.title,
        subtitle: "공지사항",
        unread: !readAlertKeys.includes(key),
        notice: pinnedNotice,
      });
    }

    for (const settlement of pendingSettlements) {
      const key = `settlement:${settlement.meeting.id}:${settlement.group.totalFee}:${settlement.group.items.length}`;
      items.push({
        key,
        type: "settlement",
        title: `${settlement.meeting.date} 정산 안내`,
        subtitle: `총 ${formatWon(settlement.group.totalFee)}`,
        unread: !readAlertKeys.includes(key),
        settlement,
      });
    }

    return items;
  }, [pendingSettlements, pinnedNotice, readAlertKeys]);
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
    if (item.unread) {
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
      />

      <main className="mx-auto flex w-full max-w-[390px] flex-col gap-6 px-4 pb-12 pt-24">
        <CalendarSection
          year={year}
          month={month}
          monthLabel={MONTH_NAMES_KO[month]}
          calendarCells={calendarCells}
          selectedDate={selectedDate}
          today={today}
          meetingsByDate={meetingsByDate}
          onMoveMonth={moveMonth}
          onSelectDate={setSelectedDate}
        />

        {selectedDate && user && hasSelectedMeetings && !dbUnavailable ? (
          <MeetingTabs activeTab={activeMeetingTab} participantBadge={selectedParticipantBadge} onChange={setActiveMeetingTab} />
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
                    initialSignupData={initialSignupDataByMeetingId[meeting.id]}
                    key={meeting.id}
                    meetingId={meeting.id}
                    onMeetingSummaryChange={handleMeetingSummaryChange}
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
