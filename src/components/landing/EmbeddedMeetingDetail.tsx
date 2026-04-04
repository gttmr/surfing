"use client";

import { useEffect, useState } from "react";
import { SignupForm } from "@/components/meeting/SignupForm";
import type { MeetingWithCounts } from "@/lib/types";

type ParticipantItem = {
  id: number;
  name: string;
  note: string | null;
  hasLesson: boolean;
  hasBus: boolean;
  hasRental: boolean;
  status: string;
  kakaoId: string;
  companionId: number | null;
};

type DetailedMeeting = MeetingWithCounts & {
  participantsList: ParticipantItem[];
};

const DAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

function sortWithCompanions(participants: ParticipantItem[]) {
  const regulars = participants.filter((participant) => participant.companionId === null);
  const companions = participants.filter((participant) => participant.companionId !== null);
  const result: ParticipantItem[] = [];

  for (const regular of regulars) {
    result.push(regular);
    result.push(...companions.filter((companion) => companion.kakaoId === regular.kakaoId));
  }

  const placedIds = new Set(result.map((participant) => participant.id));
  for (const companion of companions) {
    if (!placedIds.has(companion.id)) result.push(companion);
  }

  return result;
}

export default function EmbeddedMeetingDetail({
  meetingId,
  activeTab,
}: {
  meetingId: number;
  activeTab: "apply" | "status";
}) {
  const [meeting, setMeeting] = useState<DetailedMeeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function fetchMeeting(background = false) {
      if (!background) {
        setLoading(true);
        setError(false);
      }

      try {
        const res = await fetch(`/api/meetings/${meetingId}`, { cache: "no-store" });
        if (!res.ok) throw new Error("failed to fetch meeting");

        const data = await res.json();
        if (cancelled) return;

        setMeeting({
          id: data.id,
          date: data.date,
          startTime: data.startTime,
          endTime: data.endTime,
          location: data.location,
          description: data.description,
          isOpen: data.isOpen,
          meetingType: data.meetingType,
          createdByKakaoId: data.createdByKakaoId,
          approvedCount: data.approvedCount,
          participantsList: (data.participants ?? []).filter((participant: ParticipantItem) => participant.status !== "CANCELLED"),
        });
        setError(false);
      } catch {
        if (!cancelled && !background) {
          setMeeting(null);
          setError(true);
        }
      } finally {
        if (!cancelled && !background) setLoading(false);
      }
    }

    fetchMeeting();
    const interval = window.setInterval(() => {
      void fetchMeeting(true);
    }, 8000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [meetingId]);

  if (loading) {
    return <div className="h-48 animate-pulse rounded-2xl bg-white shadow-[0_10px_30px_rgba(26,28,28,0.03)] ring-1 ring-[#cdc7aa]/10" />;
  }

  if (error || !meeting) {
    return (
      <div className="rounded-2xl bg-white px-5 py-6 text-sm font-medium text-[#4b4732]/70 shadow-[0_10px_30px_rgba(26,28,28,0.03)] ring-1 ring-[#cdc7aa]/10">
        모임 상세 정보를 불러오지 못했습니다.
      </div>
    );
  }

  const dateObj = new Date(`${meeting.date}T00:00:00`);
  const dayName = DAY_KO[dateObj.getDay()];
  const [, month, day] = meeting.date.split("-");
  const displayDate = `${parseInt(month, 10)}월 ${parseInt(day, 10)}일 (${dayName})`;
  const participants = sortWithCompanions(meeting.participantsList);

  return (
    <section className="space-y-3 rounded-[24px] bg-white p-4 shadow-[0_10px_30px_rgba(26,28,28,0.03)] ring-1 ring-[#cdc7aa]/10">
      {activeTab === "apply" ? (
        <div className="space-y-3">
          <div className="rounded-2xl bg-[#f9f9f9] p-3.5">
            <div className="mb-3">
              <h3 className="font-headline text-[1.2rem] font-extrabold tracking-[-0.03em]">{displayDate}</h3>
            </div>
            <div className="space-y-2 text-sm text-[#4b4732]/80">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">location_on</span>
                <span>{meeting.location}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[18px]">schedule</span>
                <span>{meeting.startTime} - {meeting.endTime}</span>
              </div>
            </div>
            {meeting.description ? (
              <p className="mt-3 rounded-xl bg-white px-3 py-2 text-sm text-[#4b4732]/80 shadow-[inset_0_0_0_1px_rgba(205,199,170,0.15)]">
                {meeting.description}
              </p>
            ) : null}
          </div>

          <div className="rounded-2xl border border-[#ece7d1] bg-white p-3">
            <SignupForm meeting={meeting} />
          </div>
        </div>
      ) : (
        <div>
          {participants.length ? (
            <div className="overflow-hidden rounded-2xl bg-[#f9f9f9] shadow-[inset_0_0_0_1px_rgba(205,199,170,0.15)]">
              {(() => {
                return participants.map((participant, index) => {
                  const isCompanion = participant.companionId !== null;
                  const displayIndex = index + 1;
                  const visibleNote = isCompanion && participant.note?.trim().endsWith("의 동반")
                    ? null
                    : participant.note;

                  return (
                    <div
                      key={participant.id}
                      className={`flex gap-3 border-b border-[var(--brand-primary-border)] px-4 py-3 last:border-b-0 ${visibleNote ? "items-start" : "items-center"} ${isCompanion ? "bg-white/60 pl-9" : ""}`}
                    >
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${isCompanion ? "bg-[#fff1d6] text-[#915b00]" : "bg-white text-[#4b4732]"}`}>
                        {displayIndex}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="font-semibold text-[#1a1c1c]">{participant.name}</p>
                          {isCompanion ? <span className="rounded bg-[#fff1d6] px-1.5 py-0.5 text-[10px] font-bold text-[#915b00]">동반</span> : null}
                          {participant.hasLesson ? <span className="rounded bg-[var(--brand-primary-soft-strong)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--brand-primary-text)]">강습+장비대여</span> : null}
                          {participant.hasBus ? <span className="rounded bg-[var(--brand-primary-soft-accent)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--brand-primary-text-strong)]">셔틀 버스</span> : null}
                          {participant.hasRental ? <span className="rounded bg-[#e8f3ff] px-1.5 py-0.5 text-[10px] font-bold text-[#1d4ed8]">장비 대여만</span> : null}
                        </div>
                        {visibleNote ? <p className="mt-1 text-sm text-[#4b4732]/70">{visibleNote}</p> : null}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          ) : (
            <div className="rounded-2xl bg-[#f9f9f9] px-4 py-6 text-center text-sm font-medium text-[#4b4732]/70 shadow-[inset_0_0_0_1px_rgba(205,199,170,0.15)]">
              아직 참가 신청자가 없습니다.
            </div>
          )}
        </div>
      )}
    </section>
  );
}
