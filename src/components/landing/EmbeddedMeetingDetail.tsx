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
    return <div className="brand-card min-h-[34rem] animate-pulse rounded-2xl" />;
  }

  if (error || !meeting) {
    return (
      <div className="brand-card rounded-2xl px-5 py-6 text-sm font-medium brand-text-muted">
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
    <section className="brand-card min-h-[34rem] space-y-3 rounded-[24px] p-4">
      {activeTab === "apply" ? (
        <div className="space-y-3">
          <div className="brand-inset-panel rounded-2xl p-3.5">
            <div className="mb-3">
              <h3 className="font-headline text-[1.2rem] font-extrabold tracking-[-0.03em]">{displayDate}</h3>
            </div>
            <div className="brand-text-muted space-y-2 text-sm">
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
              <p className="brand-panel-strong mt-3 rounded-xl px-3 py-2 text-sm brand-text-muted">
                {meeting.description}
              </p>
            ) : null}
          </div>

          <div className="brand-card-soft rounded-2xl p-3">
            <SignupForm meeting={meeting} />
          </div>
        </div>
      ) : (
        <div>
          {participants.length ? (
            <div className="brand-inset-panel overflow-hidden rounded-2xl">
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
                      className={`flex gap-3 border-b border-[var(--brand-divider)] px-4 py-3 last:border-b-0 ${visibleNote ? "items-start" : "items-center"} ${isCompanion ? "bg-[var(--brand-surface-elevated)] pl-9" : ""}`}
                    >
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${isCompanion ? "brand-chip-accent" : "brand-chip-dark"}`}>
                        {displayIndex}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="font-semibold text-[var(--brand-text)]">{participant.name}</p>
                          {isCompanion ? <span className="brand-chip-accent rounded px-1.5 py-0.5 text-[10px] font-bold">동반</span> : null}
                          {participant.hasLesson ? <span className="brand-chip-strong rounded px-1.5 py-0.5 text-[10px] font-bold">강습+장비대여</span> : null}
                          {participant.hasBus ? <span className="brand-chip-soft rounded px-1.5 py-0.5 text-[10px] font-bold">셔틀 버스</span> : null}
                          {participant.hasRental ? <span className="brand-chip-dark rounded px-1.5 py-0.5 text-[10px] font-bold">장비 대여만</span> : null}
                        </div>
                        {visibleNote ? <p className="brand-text-muted mt-1 text-sm">{visibleNote}</p> : null}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          ) : (
            <div className="brand-inset-panel rounded-2xl px-4 py-6 text-center text-sm font-medium brand-text-muted">
              아직 참가 신청자가 없습니다.
            </div>
          )}
        </div>
      )}
    </section>
  );
}
