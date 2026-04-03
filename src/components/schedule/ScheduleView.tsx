"use client";

import { useState } from "react";
import Link from "next/link";
import type { MeetingWithCounts } from "@/lib/types";

const DAYS_EN = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_KO = ["일", "월", "화", "수", "목", "금", "토"];
const MONTH_NAMES_KO = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

// ── 모임 상세 카드 ──────────────────────────────────────────────
function MeetingDetailCard({
  meeting,
  today,
}: {
  meeting: MeetingWithCounts;
  today: string;
}) {
  const [, month, day] = meeting.date.split("-");
  const isClosed = !meeting.isOpen;
  const isPast = meeting.date < today;
  const dateObj = new Date(meeting.date + "T00:00:00");
  const dayName = DAY_KO[dateObj.getDay()];

  return (
    <div className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-sm border border-outline-variant/10">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest mb-1">날짜</p>
            <p className="text-lg font-bold font-headline">
              {parseInt(month, 10)}월 {parseInt(day, 10)}일 ({dayName})
            </p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold text-on-surface-variant/40 uppercase tracking-widest mb-1">참가자</p>
            <p className="text-lg font-bold text-primary">{meeting.approvedCount}명</p>
          </div>
        </div>

        <div className="space-y-2 mb-5">
          <div className="flex items-center gap-2 text-sm text-on-surface-variant">
            <span className="material-symbols-outlined text-base">schedule</span>
            <span>{meeting.startTime} – {meeting.endTime}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-on-surface-variant">
            <span className="material-symbols-outlined text-base">location_on</span>
            <span>{meeting.location}</span>
          </div>
          {meeting.description && (
            <div className="flex items-start gap-2 text-sm text-on-surface-variant">
              <span className="material-symbols-outlined text-base mt-0.5">info</span>
              <span className="line-clamp-2">{meeting.description}</span>
            </div>
          )}
        </div>

        {isClosed || isPast ? (
          <div className="w-full py-4 bg-surface-container-low text-on-surface-variant/50 font-extrabold font-headline rounded-xl flex items-center justify-center gap-2 text-sm">
            {isClosed ? "모집 마감" : "지난 모임"}
          </div>
        ) : (
          <Link
            href={`/meeting/${meeting.id}`}
            className="w-full py-4 bg-primary hover:bg-primary/90 text-on-primary font-extrabold font-headline rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm"
          >
            🏄 모임 참가
            <span className="material-symbols-outlined">arrow_forward</span>
          </Link>
        )}
      </div>
    </div>
  );
}

// ── Stitch 달력 뷰 ──────────────────────────────────────────────
function CalendarView({
  meetings,
  today,
}: {
  meetings: MeetingWithCounts[];
  today: string;
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay();
  const totalDays = lastDay.getDate();

  // 날짜별 모임 인덱스
  const meetingsByDate: Record<string, MeetingWithCounts[]> = {};
  for (const m of meetings) {
    if (!meetingsByDate[m.date]) meetingsByDate[m.date] = [];
    meetingsByDate[m.date].push(m);
  }

  function prevMonth() {
    if (month === 0) { setYear((y) => y - 1); setMonth(11); }
    else setMonth((m) => m - 1);
    setSelectedDate(null);
  }
  function nextMonth() {
    if (month === 11) { setYear((y) => y + 1); setMonth(0); }
    else setMonth((m) => m + 1);
    setSelectedDate(null);
  }

  // 달력 셀 배열 (앞 빈칸 + 날짜들 + 뒤 빈칸)
  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
  const selectedMeetings = selectedDate
    ? (meetingsByDate[selectedDate] ?? [])
    : meetings.filter((m) => m.date.startsWith(monthStr));

  return (
    <div className="space-y-6">
      {/* 월 헤더 */}
      <div className="flex justify-between items-end">
        <h1 className="text-4xl font-extrabold font-headline tracking-tighter leading-none">
          {MONTH_NAMES_KO[month]}
          <span className="text-base font-medium text-on-surface-variant ml-2">{year}</span>
        </h1>
        <div className="flex gap-2">
          <button
            onClick={prevMonth}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface-container-low transition-transform active:scale-90 hover:bg-surface-container-high"
          >
            <span className="material-symbols-outlined text-on-surface-variant">chevron_left</span>
          </button>
          <button
            onClick={nextMonth}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-surface-container-low transition-transform active:scale-90 hover:bg-surface-container-high"
          >
            <span className="material-symbols-outlined text-on-surface-variant">chevron_right</span>
          </button>
        </div>
      </div>

      {/* 달력 그리드 */}
      <div className="bg-surface-container-lowest rounded-xl p-4 shadow-sm">
        <div className="grid grid-cols-7 gap-y-3 text-center">
          {/* 요일 헤더 */}
          {DAYS_EN.map((d, i) => (
            <div
              key={i}
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: i === 0 ? "#ef4444" : i === 6 ? "#3b82f6" : "rgba(75, 71, 50, 0.4)" }}
            >
              {d}
            </div>
          ))}

          {/* 날짜 셀 */}
          {cells.map((day, idx) => {
            if (!day) return <div key={idx} />;

            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const hasMeeting = !!meetingsByDate[dateStr];
            const isToday = dateStr === today;
            const isSelected = dateStr === selectedDate;
            const isPast = dateStr < today;
            const dow = (startDow + day - 1) % 7;

            return (
              <div
                key={idx}
                className="relative flex flex-col items-center cursor-pointer"
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
              >
                <div
                  className={`text-sm py-1 font-medium w-8 h-8 flex items-center justify-center rounded-full transition-colors
                    ${isSelected ? "bg-primary text-on-primary font-bold" :
                      isToday ? "bg-primary-container text-on-primary-fixed font-bold" :
                      isPast ? "opacity-30" :
                      dow === 0 ? "text-red-500" :
                      dow === 6 ? "text-blue-500" : ""}
                  `}
                >
                  {day}
                </div>
                {hasMeeting && (
                  <div
                    className={`absolute -bottom-1 w-1.5 h-1.5 rounded-full ${
                      isSelected ? "bg-on-primary" : "bg-primary"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 모임 상세/목록 */}
      <section>
        <div className="flex items-baseline justify-between mb-4">
          <h2 className="text-xl font-bold font-headline tracking-tight">
            {selectedDate
              ? `${parseInt(selectedDate.split("-")[1], 10)}월 ${parseInt(selectedDate.split("-")[2], 10)}일 모임`
              : "이달의 모임"}
          </h2>
          {selectedDate && (
            <button
              onClick={() => setSelectedDate(null)}
              className="text-xs text-primary font-semibold"
            >
              전체보기
            </button>
          )}
        </div>

        {selectedMeetings.length === 0 ? (
          <div className="text-center py-12 text-on-surface-variant/50">
            <span className="material-symbols-outlined text-4xl mb-2 block">event_busy</span>
            <p className="text-sm">이 {selectedDate ? "날" : "달"}의 모임이 없습니다</p>
          </div>
        ) : (
          <div className="space-y-3">
            {selectedMeetings.map((m) => (
              <MeetingDetailCard key={m.id} meeting={m} today={today} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

// ── 리스트 뷰 (기존 유지) ───────────────────────────────────────
function MeetingRow({ meeting, today }: { meeting: MeetingWithCounts; today: string }) {
  const isClosed = !meeting.isOpen;
  const isPast = meeting.date < today;
  const date = new Date(meeting.date + "T00:00:00");
  const dayName = DAY_KO[date.getDay()];
  const [, month, day] = meeting.date.split("-");

  return (
    <Link
      href={`/meeting/${meeting.id}`}
      className={`block bg-surface-container-lowest rounded-xl border border-outline-variant/10 p-4 hover:border-primary/30 transition-all shadow-sm ${
        isClosed || isPast ? "opacity-60" : ""
      }`}
    >
      <div className="flex items-center gap-4">
        <div className="text-center min-w-[52px]">
          <p className="text-xs text-on-surface-variant/60">{parseInt(month, 10)}월</p>
          <p className="text-2xl font-extrabold font-headline text-on-surface leading-none">{parseInt(day, 10)}</p>
          <p className="text-xs text-on-surface-variant/60">{dayName}요일</p>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm font-semibold text-on-surface">
              {meeting.startTime} – {meeting.endTime}
            </span>
            <span
              className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                meeting.meetingType === "비정기"
                  ? "bg-orange-100 text-orange-600"
                  : "bg-primary-container text-on-primary-container"
              }`}
            >
              {meeting.meetingType}
            </span>
            {isClosed && (
              <span className="text-xs bg-surface-container text-on-surface-variant/60 px-1.5 py-0.5 rounded-full">
                마감
              </span>
            )}
          </div>
          <p className="text-xs text-on-surface-variant truncate">📍 {meeting.location}</p>
          <p className="text-xs text-on-surface-variant/50 mt-1">참가자 {meeting.approvedCount}명</p>
        </div>
        {!isPast && !isClosed && (
          <div className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold text-on-primary bg-primary">
            신청
          </div>
        )}
      </div>
    </Link>
  );
}

function ListView({ meetings, today }: { meetings: MeetingWithCounts[]; today: string }) {
  const upcoming = meetings.filter((m) => m.date >= today);
  const past = meetings.filter((m) => m.date < today).reverse();

  return (
    <div className="space-y-8">
      {upcoming.length > 0 && (
        <section>
          <h2 className="text-xs font-bold text-on-surface-variant/40 uppercase tracking-widest mb-3">예정된 모임</h2>
          <div className="space-y-3">
            {upcoming.map((m) => (
              <MeetingRow key={m.id} meeting={m} today={today} />
            ))}
          </div>
        </section>
      )}
      {past.length > 0 && (
        <section>
          <h2 className="text-xs font-bold text-on-surface-variant/40 uppercase tracking-widest mb-3">지난 모임</h2>
          <div className="space-y-3">
            {past.map((m) => (
              <MeetingRow key={m.id} meeting={m} today={today} />
            ))}
          </div>
        </section>
      )}
      {meetings.length === 0 && (
        <div className="text-center py-16 text-on-surface-variant/40">
          <span className="material-symbols-outlined text-5xl mb-3 block">event</span>
          <p className="font-medium">등록된 일정이 없습니다</p>
        </div>
      )}
    </div>
  );
}

// ── 메인 ScheduleView ───────────────────────────────────────────
export default function ScheduleView({
  meetings,
  isLoggedIn,
  isAdmin,
}: {
  meetings: MeetingWithCounts[];
  isLoggedIn?: boolean;
  isAdmin?: boolean;
}) {
  const [view, setView] = useState<"list" | "calendar">("calendar");
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-6">
      {/* 뷰 전환 탭 */}
      <div className="flex items-center justify-between">
        <div className="flex bg-surface-container-low rounded-xl p-1 gap-1">
          <button
            onClick={() => setView("calendar")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              view === "calendar"
                ? "bg-surface-container-lowest text-on-surface shadow-sm"
                : "text-on-surface-variant/60 hover:text-on-surface-variant"
            }`}
          >
            <span className="material-symbols-outlined text-sm align-middle mr-1">calendar_month</span>
            달력
          </button>
          <button
            onClick={() => setView("list")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
              view === "list"
                ? "bg-surface-container-lowest text-on-surface shadow-sm"
                : "text-on-surface-variant/60 hover:text-on-surface-variant"
            }`}
          >
            <span className="material-symbols-outlined text-sm align-middle mr-1">list</span>
            목록
          </button>
        </div>
      </div>

      {/* 비정기 모임 생성 버튼 (누구나) */}
      {isLoggedIn && (
        <Link
          href="/meeting/create"
          className="w-full py-3 bg-primary-container text-on-primary-container font-bold font-headline rounded-xl border border-primary/20 transition-all hover:bg-primary-container/80 flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">add_circle</span>
          비정기모임 생성하기
        </Link>
      )}

      {/* 뷰 렌더링 */}
      {view === "calendar" ? (
        <CalendarView meetings={meetings} today={today} />
      ) : (
        <ListView meetings={meetings} today={today} />
      )}
    </div>
  );
}
