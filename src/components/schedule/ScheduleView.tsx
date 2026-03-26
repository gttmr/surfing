"use client";

import { useState } from "react";
import Link from "next/link";
import { CapacityBar } from "@/components/ui/CapacityBar";
import type { MeetingWithCounts } from "@/lib/types";

const DAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

export default function ScheduleView({
  meetings,
}: {
  meetings: MeetingWithCounts[];
}) {
  const [view, setView] = useState<"list">("list");

  const today = new Date().toISOString().split("T")[0];
  const upcoming = meetings.filter((meeting) => meeting.date >= today);
  const past = meetings.filter((meeting) => meeting.date < today).reverse();

  function MeetingRow({ meeting }: { meeting: MeetingWithCounts }) {
    const isClosed = !meeting.isOpen;
    const isFull = meeting.approvedCount >= meeting.maxCapacity;
    const isPast = meeting.date < today;
    const date = new Date(meeting.date + "T00:00:00");
    const dayName = DAY_KO[date.getDay()];
    const [, month, day] = meeting.date.split("-");

    return (
      <div className={`bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-4 ${isClosed || isPast ? "opacity-60" : ""}`}>
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
            {isClosed && (
              <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">마감</span>
            )}
          </div>
          <p className="text-xs text-slate-500 truncate">📍 {meeting.location}</p>
          <div className="mt-2">
            <CapacityBar current={meeting.approvedCount} max={meeting.maxCapacity} showLabel={false} />
            <p className="text-xs text-slate-400 mt-0.5">
              정원 {meeting.approvedCount}/{meeting.maxCapacity}명
              {meeting.waitlistedCount > 0 && (
                <span className="ml-1.5 text-amber-600">· 대기 {meeting.waitlistedCount}명</span>
              )}
            </p>
          </div>
        </div>
        {!isPast && !isClosed && (
          <Link
            href={`/meeting/${meeting.id}`}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-colors
              ${isFull ? "bg-blue-400 hover:bg-blue-500" : "bg-blue-600 hover:bg-blue-700"}`}
          >
            {isFull ? "대기 신청" : "신청"}
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {upcoming.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">예정된 모임</h2>
          <div className="space-y-3">
            {upcoming.map((meeting) => <MeetingRow key={meeting.id} meeting={meeting} />)}
          </div>
        </section>
      )}
      {past.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-3">지난 모임</h2>
          <div className="space-y-3">
            {past.map((meeting) => <MeetingRow key={meeting.id} meeting={meeting} />)}
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
