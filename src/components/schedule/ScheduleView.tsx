"use client";

import { useState } from "react";
import Link from "next/link";
import type { MeetingWithCounts } from "@/lib/types";
import { getTodayInSeoul } from "@/lib/date";
import { DAY_KO, MONTH_NAMES_KO } from "@/lib/format";

const DAYS_EN = ["S", "M", "T", "W", "T", "F", "S"];

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
      <div className="p-5">
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
          <div className="w-full py-3.5 bg-surface-container-low text-on-surface-variant/50 font-bold font-headline rounded-xl flex items-center justify-center gap-2 text-sm">
            {isClosed ? "모집 마감" : "지난 모임"}
          </div>
        ) : (
          <Link
            href={`/?date=${encodeURIComponent(meeting.date)}`}
            className="w-full py-3.5 bg-primary hover:bg-primary/90 text-on-primary font-extrabold font-headline rounded-xl transition-all active:scale-[0.98] flex items-center justify-center gap-2 shadow-sm"
          >
            🏄 모임 참가
            <span className="material-symbols-outlined">arrow_forward</span>
          </Link>
        )}
      </div>
    </div>
  );
}

// ── 메인 ScheduleView ───────────────────────────────────────────
export default function ScheduleView({
  meetings,
  isLoggedIn,
}: {
  meetings: MeetingWithCounts[];
  isLoggedIn?: boolean;
  isAdmin?: boolean;
}) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const today = getTodayInSeoul(now);

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

  // 달력 셀 배열
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
          {DAYS_EN.map((d, i) => (
            <div
              key={i}
              className="text-[10px] font-bold uppercase tracking-widest"
              style={{ color: i === 0 ? "#ef4444" : i === 6 ? "#3b82f6" : "rgba(75, 71, 50, 0.4)" }}
            >
              {d}
            </div>
          ))}

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
                  className={`text-sm w-8 h-8 flex items-center justify-center rounded-full transition-colors font-medium
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

      {/* 비정기 모임 생성 버튼 (로그인한 경우) */}
      {isLoggedIn ? (
        <Link
          href="/meeting/create"
          className="w-full py-3 bg-primary-container text-on-primary-container font-bold font-headline rounded-xl border border-primary/20 transition-all hover:bg-primary-container/80 flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">add_circle</span>
          비정기모임 생성하기
        </Link>
      ) : (
        /* 미로그인 시 로그인 유도 배너 */
        <Link
          href="/api/auth/kakao?returnTo=/"
          className="w-full py-3.5 bg-black hover:bg-neutral-800 text-white font-bold font-headline rounded-xl transition-all flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">login</span>
          로그인하고 모임 참가하기
        </Link>
      )}

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
