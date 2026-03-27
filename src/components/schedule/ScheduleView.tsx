"use client";

import { useState } from "react";
import Link from "next/link";
import type { MeetingWithCounts } from "@/lib/types";

const DAY_KO = ["일", "월", "화", "수", "목", "금", "토"];
const MONTH_NAMES = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

function MeetingTypeBadge({ type }: { type: string }) {
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
      type === "비정기" ? "bg-orange-100 text-orange-600" : "bg-blue-100 text-blue-600"
    }`}>
      {type}
    </span>
  );
}

function MeetingRow({ meeting, today }: { meeting: MeetingWithCounts; today: string }) {
  const isClosed = !meeting.isOpen;
  const isPast = meeting.date < today;
  const date = new Date(meeting.date + "T00:00:00");
  const dayName = DAY_KO[date.getDay()];
  const [, month, day] = meeting.date.split("-");

  return (
    <Link href={`/meeting/${meeting.id}`} className={`block bg-white rounded-xl border border-slate-200 p-4 hover:border-blue-300 transition-colors ${isClosed || isPast ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-4">
        <div className="text-center min-w-[52px]">
          <p className="text-xs text-slate-500">{parseInt(month, 10)}월</p>
          <p className="text-2xl font-extrabold text-slate-900 leading-none">{parseInt(day, 10)}</p>
          <p className="text-xs text-slate-500">{dayName}요일</p>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="text-sm font-semibold text-slate-800">
              {meeting.startTime} – {meeting.endTime}
            </span>
            <MeetingTypeBadge type={meeting.meetingType} />
            {isClosed && (
              <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">마감</span>
            )}
          </div>
          <p className="text-xs text-slate-500 truncate">📍 {meeting.location}</p>
          <p className="text-xs text-slate-400 mt-1">참가자 {meeting.approvedCount}명</p>
        </div>
        {!isPast && !isClosed && (
          <div className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-blue-600">
            신청
          </div>
        )}
      </div>
    </Link>
  );
}

// 달력 뷰
function CalendarView({ meetings, today }: { meetings: MeetingWithCounts[]; today: string }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay(); // 0=일
  const totalDays = lastDay.getDate();

  // meetings indexed by date string
  const meetingsByDate: Record<string, MeetingWithCounts[]> = {};
  for (const m of meetings) {
    if (!meetingsByDate[m.date]) meetingsByDate[m.date] = [];
    meetingsByDate[m.date].push(m);
  }

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  const cells: (number | null)[] = [
    ...Array(startDow).fill(null),
    ...Array.from({ length: totalDays }, (_, i) => i + 1),
  ];
  // pad to 6 rows
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="space-y-4">
      {/* 월 네비게이션 */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-4 py-3">
        <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">
          ‹
        </button>
        <span className="font-bold text-slate-800">{year}년 {MONTH_NAMES[month]}</span>
        <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-600 transition-colors">
          ›
        </button>
      </div>

      {/* 달력 그리드 */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {/* 요일 헤더 */}
        <div className="grid grid-cols-7 border-b border-slate-100">
          {DAY_KO.map((d, i) => (
            <div key={d} className={`text-center text-xs font-semibold py-2 ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-slate-500"}`}>
              {d}
            </div>
          ))}
        </div>

        {/* 날짜 셀 */}
        <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
          {cells.map((day, idx) => {
            if (!day) {
              return <div key={idx} className="min-h-[52px] bg-slate-50/50" />;
            }
            const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
            const dayMeetings = meetingsByDate[dateStr] ?? [];
            const isToday = dateStr === today;
            const isPast = dateStr < today;
            const dow = (startDow + day - 1) % 7;

            return (
              <div key={idx} className={`min-h-[52px] p-1 ${isPast ? "bg-slate-50/50" : ""}`}>
                <p className={`text-xs font-semibold text-center mb-0.5 w-6 mx-auto rounded-full leading-6 ${
                  isToday ? "bg-blue-600 text-white" :
                  dow === 0 ? "text-red-500" :
                  dow === 6 ? "text-blue-500" :
                  "text-slate-700"
                }`}>
                  {day}
                </p>
                <div className="space-y-0.5">
                  {dayMeetings.map((m) => (
                    <Link key={m.id} href={`/meeting/${m.id}`} className={`block text-[9px] rounded px-1 py-0.5 truncate font-medium leading-tight ${
                      m.meetingType === "비정기" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"
                    }`}>
                      {m.startTime} {m.meetingType}
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 해당 월 모임 목록 */}
      {(() => {
        const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
        const monthMeetings = meetings.filter((m) => m.date.startsWith(monthStr));
        if (monthMeetings.length === 0) return (
          <div className="text-center py-8 text-slate-400 text-sm">이 달의 모임이 없습니다</div>
        );
        return (
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide">이달의 모임</h3>
            {monthMeetings.map((m) => (
              <MeetingRow key={m.id} meeting={m} today={today} />
            ))}
          </div>
        );
      })()}
    </div>
  );
}

// 리스트 뷰
function ListView({ meetings, today }: { meetings: MeetingWithCounts[]; today: string }) {
  const upcoming = meetings.filter((m) => m.date >= today);
  const past = meetings.filter((m) => m.date < today).reverse();

  return (
    <div className="space-y-8">
      {upcoming.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">예정된 모임</h2>
          <div className="space-y-3">
            {upcoming.map((m) => <MeetingRow key={m.id} meeting={m} today={today} />)}
          </div>
        </section>
      )}
      {past.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">지난 모임</h2>
          <div className="space-y-3">
            {past.map((m) => <MeetingRow key={m.id} meeting={m} today={today} />)}
          </div>
        </section>
      )}
      {meetings.length === 0 && (
        <div className="text-center py-16 text-slate-400">
          <p className="text-4xl mb-3">📅</p>
          <p className="font-medium">등록된 일정이 없습니다</p>
        </div>
      )}
    </div>
  );
}

export default function ScheduleView({
  meetings,
  isLoggedIn,
}: {
  meetings: MeetingWithCounts[];
  isLoggedIn?: boolean;
}) {
  const [view, setView] = useState<"list" | "calendar">("list");
  const today = new Date().toISOString().split("T")[0];

  return (
    <div className="space-y-4">
      {/* 뷰 전환 + 비정기 모임 등록 */}
      <div className="flex items-center justify-between">
        <div className="flex bg-slate-100 rounded-lg p-1 gap-1">
          <button
            onClick={() => setView("list")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${view === "list" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            📋 목록
          </button>
          <button
            onClick={() => setView("calendar")}
            className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${view === "calendar" ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            📅 달력
          </button>
        </div>
        {isLoggedIn && (
          <Link
            href="/meeting/create"
            className="px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-600 text-white text-xs font-bold transition-colors"
          >
            + 비정기 모임
          </Link>
        )}
      </div>

      {view === "list" ? (
        <ListView meetings={meetings} today={today} />
      ) : (
        <CalendarView meetings={meetings} today={today} />
      )}
    </div>
  );
}
