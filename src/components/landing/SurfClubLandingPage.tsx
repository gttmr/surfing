"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { MeetingWithCounts } from "@/lib/types";
import { pickSurfAvatarEmoji } from "@/lib/avatar-emoji";
import EmbeddedMeetingDetail from "./EmbeddedMeetingDetail";

type HomeUser = {
  kakaoId: string;
  nickname: string;
  profileImage?: string;
};

type NoticeItem = {
  title: string;
  body: string;
  updatedAt: string;
};

type SettlementSummary = {
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

type SettlementAccount = {
  bankName: string;
  accountNumber: string;
  accountHolder: string;
};

type CalendarCell = {
  day: number;
  date: string;
  inCurrentMonth: boolean;
};

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_KO = ["일", "월", "화", "수", "목", "금", "토"];
const MONTH_NAMES_KO = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

function todayInSeoul() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Seoul" }).format(new Date());
}

function sortMeetings(meetings: MeetingWithCounts[]) {
  return [...meetings].sort((a, b) => {
    if (a.date === b.date) return a.startTime.localeCompare(b.startTime);
    return a.date.localeCompare(b.date);
  });
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function formatWon(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
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

function normalizeSelectedDate(date?: string | null) {
  if (!date) return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : null;
}

function findInitialView(meetings: MeetingWithCounts[], today: string, preferredDate?: string | null) {
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

function findDefaultDateForMonth(meetings: MeetingWithCounts[], year: number, month: number, today: string) {
  const monthKey = `${year}-${pad(month + 1)}`;
  const monthMeetings = sortMeetings(meetings).filter((meeting) => meeting.date.startsWith(monthKey));
  if (!monthMeetings.length) return null;

  return monthMeetings.find((meeting) => meeting.date >= today)?.date ?? monthMeetings[0].date;
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

function ProfileButton({ user }: { user: HomeUser }) {
  const hasImage = !!user.profileImage;
  const fallbackEmoji = pickSurfAvatarEmoji(user.kakaoId ?? user.nickname);

  return (
    <Link href="/profile" className="flex items-center">
      <span className="sr-only">프로필</span>
      <div className="brand-avatar-shell flex h-10 w-10 items-center justify-center overflow-hidden rounded-full shadow-sm">
        {hasImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={user.nickname} className="h-full w-full object-cover" referrerPolicy="no-referrer" src={user.profileImage} />
        ) : (
          <span className="text-sm font-extrabold">{fallbackEmoji}</span>
        )}
      </div>
    </Link>
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
  dbUnavailable = false,
  initialSelectedDate = null,
}: {
  meetings: MeetingWithCounts[];
  user: HomeUser | null;
  isAdmin: boolean;
  pinnedNotice: NoticeItem | null;
  dbUnavailable?: boolean;
  initialSelectedDate?: string | null;
}) {
  const today = todayInSeoul();
  const requestedDate = normalizeSelectedDate(initialSelectedDate);
  const initialView = findInitialView(meetings, today, requestedDate);
  const [year, setYear] = useState(initialView.year);
  const [month, setMonth] = useState(initialView.month);
  const [selectedDate, setSelectedDate] = useState<string | null>(initialView.selectedDate);
  const [activeMeetingTab, setActiveMeetingTab] = useState<"apply" | "status">("apply");
  const [isNoticeOpen, setIsNoticeOpen] = useState(false);
  const [pendingSettlements, setPendingSettlements] = useState<SettlementSummary[]>([]);
  const [settlementAccount, setSettlementAccount] = useState<SettlementAccount | null>(null);
  const [confirmingMeetingId, setConfirmingMeetingId] = useState<number | null>(null);
  const sortedMeetings = sortMeetings(meetings);

  const hasPinnedNotice = Boolean(pinnedNotice);
  const hasPendingSettlement = pendingSettlements.length > 0;
  const hasPopupTrigger = hasPinnedNotice || hasPendingSettlement;

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
    let cancelled = false;

    async function loadPendingSettlements() {
      if (!user) {
        setPendingSettlements([]);
        return;
      }

      try {
        const res = await fetch("/api/settlement/current");
        const data = await res.json();
        if (cancelled) return;
        const nextPending = Array.isArray(data?.pending) ? data.pending : [];
        setPendingSettlements(nextPending);
        setSettlementAccount(data?.settlementAccount ?? null);
        if (nextPending.length > 0) {
          setIsNoticeOpen(true);
        }
      } catch {
        if (!cancelled) {
          setPendingSettlements([]);
          setSettlementAccount(null);
        }
      }
    }

    loadPendingSettlements();
    return () => {
      cancelled = true;
    };
  }, [user]);

  async function handleConfirmSettlement(meetingId: number) {
    setConfirmingMeetingId(meetingId);
    try {
      const res = await fetch("/api/settlement/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId }),
      });
      if (!res.ok) {
        return;
      }

      setPendingSettlements((prev) => {
        const next = prev.filter((item) => item.meeting.id !== meetingId);
        if (!next.length) {
          setIsNoticeOpen(false);
        }
        return next;
      });
    } finally {
      setConfirmingMeetingId(null);
    }
  }

  async function copySettlementAccount() {
    if (!settlementAccount?.accountNumber) return;
    try {
      await navigator.clipboard.writeText(settlementAccount.accountNumber);
    } catch {
      // no-op
    }
  }

  const meetingsByDate = sortedMeetings.reduce<Record<string, MeetingWithCounts[]>>((acc, meeting) => {
    if (!acc[meeting.date]) acc[meeting.date] = [];
    acc[meeting.date].push(meeting);
    return acc;
  }, {});

  const monthKey = `${year}-${pad(month + 1)}`;
  const monthMeetings = sortedMeetings.filter((meeting) => meeting.date.startsWith(monthKey));
  const selectedMeetings = selectedDate ? (meetingsByDate[selectedDate] ?? []) : monthMeetings;
  const hasSelectedMeetings = selectedMeetings.length > 0;
  const selectedParticipantCount = selectedMeetings.reduce((sum, meeting) => sum + meeting.approvedCount, 0);
  const selectedParticipantBadge = String(Math.min(selectedParticipantCount, 99));
  const calendarCells = buildCalendarCells(year, month);
  const canCreateIrregularMeeting = Boolean(user && selectedDate && selectedDate >= today && selectedMeetings.length === 0 && !dbUnavailable);

  function moveMonth(direction: -1 | 1) {
    const nextDate = new Date(year, month + direction, 1);
    const nextYear = nextDate.getFullYear();
    const nextMonth = nextDate.getMonth();
    setYear(nextYear);
    setMonth(nextMonth);
    setSelectedDate(findDefaultDateForMonth(meetings, nextYear, nextMonth, today));
  }

  return (
    <div className="min-h-screen bg-[var(--brand-page)] text-[var(--brand-text)]">
      <header className="brand-header-surface fixed inset-x-0 top-0 z-50">
        <div className="mx-auto flex h-16 w-full max-w-[390px] items-center justify-between px-4">
          <div className="flex h-12 items-center">
            <Image alt="Surfing club logo" className="h-auto w-[64px]" height={64} priority src="/logo.png" width={64} />
          </div>
          <div className="flex items-center gap-2">
            {hasPopupTrigger ? (
              <button
                aria-label="공지사항 열기"
                className="brand-link flex h-8 w-8 items-center justify-center rounded-full transition-opacity hover:opacity-70"
                onClick={() => setIsNoticeOpen(true)}
                type="button"
              >
                <Icon className="text-[16px]" name="notifications" />
              </button>
            ) : null}
            {user ? <ProfileButton user={user} /> : null}
          </div>
        </div>
      </header>

      {hasPopupTrigger && isNoticeOpen ? (
        <div className="fixed inset-0 z-[60] bg-[rgba(0,29,110,0.24)] px-4 py-6" onClick={() => setIsNoticeOpen(false)}>
          <div
            className="brand-card-soft mx-auto mt-20 w-full max-w-[390px] rounded-3xl p-5 shadow-[0_20px_48px_rgba(0,29,110,0.22)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="brand-chip-strong flex h-10 w-10 items-center justify-center rounded-full">
                  <Icon className="text-[20px]" name="notifications" />
                </div>
                <p className="text-sm font-extrabold text-[var(--brand-text)]">{hasPendingSettlement ? "정산 확인" : "공지사항"}</p>
              </div>
              <button
                aria-label="공지사항 닫기"
                className="brand-button-secondary flex h-9 w-9 items-center justify-center rounded-full"
                onClick={() => setIsNoticeOpen(false)}
                type="button"
              >
                <Icon className="text-[18px]" name="close" />
              </button>
            </div>

            {hasPendingSettlement ? (
              <div className="space-y-3">
                {pendingSettlements.map((settlement) => (
                  <div key={settlement.meeting.id} className="brand-panel-white rounded-2xl p-4">
                    <div className="mb-3 flex items-start justify-between gap-3">
                      <div>
                        <p className="text-base font-bold text-[var(--brand-text)]">{settlement.meeting.date}</p>
                        <p className="brand-text-muted mt-1 text-sm">
                          {settlement.meeting.startTime}–{settlement.meeting.endTime} · {settlement.meeting.location}
                        </p>
                      </div>
                      <span className="brand-chip-dark rounded-full px-2 py-1 text-xs font-bold">
                        총 {formatWon(settlement.group.totalFee)}
                      </span>
                    </div>

                    <div className="space-y-2">
                      {settlement.group.items.map((item) => (
                        <div key={item.participantId} className="brand-list-item rounded-2xl p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-bold text-[var(--brand-text)]">
                                {item.participantName}
                                {item.memberType === "COMPANION" ? " (동반)" : ""}
                              </p>
                              <div className="brand-text-subtle mt-1 space-y-1 text-xs">
                                <p>참가 {formatWon(item.baseFee)} · 강습 {formatWon(item.lessonFee)} · 대여 {formatWon(item.rentalFee)}</p>
                                {item.adjustments.map((adjustment) => (
                                  <p key={adjustment.id}>
                                    {adjustment.label} {adjustment.amount >= 0 ? "+" : ""}{formatWon(adjustment.amount)}
                                  </p>
                                ))}
                              </div>
                            </div>
                            <span className="text-sm font-extrabold text-[var(--brand-text)]">{formatWon(item.totalFee)}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {settlementAccount?.accountNumber ? (
                      <div className="mt-3 rounded-2xl bg-[var(--brand-primary-soft)] px-4 py-3">
                        <p className="text-xs font-bold text-[var(--brand-primary-text)]">입금 계좌</p>
                        <p className="mt-1 text-sm font-extrabold text-[var(--brand-primary-text)]">
                          {settlementAccount.bankName} {settlementAccount.accountNumber}
                        </p>
                        {settlementAccount.accountHolder ? (
                          <p className="mt-1 text-xs text-[var(--brand-primary-text)] opacity-80">
                            예금주 {settlementAccount.accountHolder}
                          </p>
                        ) : null}
                        <button
                          className="brand-button-secondary mt-3 rounded-xl px-3 py-2 text-xs font-bold"
                          onClick={copySettlementAccount}
                          type="button"
                        >
                          계좌번호 복사
                        </button>
                      </div>
                    ) : null}

                    <div className="mt-4 flex justify-end">
                      <button
                        className="brand-button-primary rounded-2xl px-5 py-3 text-sm font-bold"
                        disabled={confirmingMeetingId === settlement.meeting.id}
                        onClick={() => handleConfirmSettlement(settlement.meeting.id)}
                        type="button"
                      >
                        {confirmingMeetingId === settlement.meeting.id ? "확인 중..." : "정산 확인 완료"}
                      </button>
                    </div>
                  </div>
                ))}

                {hasPinnedNotice ? (
                  <div className="brand-panel-white rounded-2xl px-4 py-4">
                    <p className="text-sm font-bold text-[var(--brand-text)]">{pinnedNotice!.title}</p>
                    <p className="brand-text-muted mt-2 whitespace-pre-line text-sm leading-6">{pinnedNotice!.body}</p>
                  </div>
                ) : null}

                <div className="flex justify-end">
                  <button
                    className="brand-button-secondary rounded-2xl px-5 py-3 text-sm font-bold"
                    onClick={() => setIsNoticeOpen(false)}
                    type="button"
                  >
                    나중에 보기
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="brand-panel-white rounded-2xl px-4 py-4">
                  <p className="text-base font-bold text-[var(--brand-text)]">{pinnedNotice!.title}</p>
                  <p className="brand-text-muted mt-2 whitespace-pre-line text-sm leading-6">{pinnedNotice!.body}</p>
                </div>

                <div className="mt-4 flex justify-end">
                  <button
                    className="brand-button-primary rounded-2xl px-5 py-3 text-sm font-bold"
                    onClick={() => setIsNoticeOpen(false)}
                    type="button"
                  >
                    닫기
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}

      <main className="mx-auto flex w-full max-w-[390px] flex-col gap-6 px-4 pb-12 pt-24">
        <section>
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h1 className="font-headline text-[2.25rem] font-extrabold leading-none tracking-[-0.06em]">
                {MONTH_NAMES_KO[month]}
              </h1>
              <p className="brand-text-subtle mt-1 text-xs font-semibold">{year}</p>
            </div>
            <div className="flex gap-2">
              <button
                aria-label="이전 달"
                className="brand-panel flex h-10 w-10 items-center justify-center rounded-xl transition-transform active:scale-95"
                onClick={() => moveMonth(-1)}
                type="button"
              >
                <Icon className="text-[18px]" name="chevron_left" />
              </button>
              <button
                aria-label="다음 달"
                className="brand-panel flex h-10 w-10 items-center justify-center rounded-xl transition-transform active:scale-95"
                onClick={() => moveMonth(1)}
                type="button"
              >
                <Icon className="text-[18px]" name="chevron_right" />
              </button>
            </div>
          </div>

          <div className="brand-card-soft overflow-visible rounded-xl p-5">
            <div className="grid grid-cols-7 gap-y-4 text-center">
              {DAY_LABELS.map((day, index) => (
                <div
                  key={day + index}
                  className="text-[10px] font-bold uppercase tracking-[0.32em]"
                  style={{ color: index === 0 ? "#ef4444" : index === 6 ? "#2563eb" : "var(--brand-text-subtle)" }}
                >
                  {day}
                </div>
              ))}

              {calendarCells.map((cell) => {
                const isSelected = cell.date === selectedDate;
                const isToday = cell.date === today;
                const dayMeetings = meetingsByDate[cell.date] ?? [];
                const hasMeeting = dayMeetings.length > 0;
                const dateObj = new Date(`${cell.date}T00:00:00`);
                const dow = dateObj.getDay();

                return (
                  <button
                    key={cell.date}
                    className="relative flex min-h-10 flex-col items-center justify-center"
                    onClick={() => setSelectedDate(cell.date === selectedDate ? null : cell.date)}
                    type="button"
                  >
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors ${
                        isSelected
                          ? "bg-[var(--brand-primary)] font-bold text-[var(--brand-primary-foreground)]"
                          : isToday
                            ? "bg-[var(--brand-primary-soft-strong)] font-bold text-[var(--brand-primary-text)]"
                            : cell.inCurrentMonth
                              ? dow === 0
                                ? "text-red-500"
                                : dow === 6
                                  ? "text-blue-500"
                                  : "text-[var(--brand-text)]"
                              : "text-[var(--brand-text-subtle)]"
                      }`}
                    >
                      {cell.day}
                    </div>
                    {hasMeeting ? (
                      <div className={`absolute -bottom-1 h-1.5 w-1.5 rounded-full ${isSelected ? "bg-[var(--brand-primary-text)]" : "bg-[var(--brand-primary-border-strong)]"}`} />
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {selectedDate && user && hasSelectedMeetings && !dbUnavailable ? (
          <section>
            <div className="brand-tab-bar flex items-end">
              <button
                className={`flex-1 border-b-2 px-0 pb-3 text-base font-extrabold transition-colors ${
                  activeMeetingTab === "apply"
                    ? "brand-tab-underline-active"
                    : "brand-tab-underline-inactive"
                }`}
                onClick={() => setActiveMeetingTab("apply")}
                type="button"
              >
                참가하기
              </button>
              <button
                className={`flex flex-1 items-center justify-center gap-2 border-b-2 px-0 pb-3 text-base font-extrabold transition-colors ${
                  activeMeetingTab === "status"
                    ? "brand-tab-underline-active"
                    : "brand-tab-underline-inactive"
                }`}
                onClick={() => setActiveMeetingTab("status")}
                type="button"
              >
                신청 현황
                <span className="brand-chip-dark flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold">
                  {selectedParticipantBadge}
                </span>
              </button>
            </div>
          </section>
        ) : null}

        {selectedDate && (dbUnavailable || hasSelectedMeetings) ? (
          <section id="meeting-details">
            {!user || !hasSelectedMeetings || dbUnavailable ? (
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
                    key={meeting.id}
                    meetingId={meeting.id}
                  />
                ))}
              </div>
            ) : selectedMeetings.length > 0 ? (
              <div className="space-y-3">
                {selectedMeetings.map((meeting) => (
                  <MeetingCard key={meeting.id} loggedIn={!!user} meeting={meeting} today={today} />
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
