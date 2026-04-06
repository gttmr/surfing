"use client";

import { useCallback, useEffect, useState } from "react";
import { SignupForm } from "@/components/meeting/SignupForm";
import { pickSurfAvatarEmoji } from "@/lib/avatar-emoji";
import type {
  DetailedMeeting,
  HomeUser,
  MeetingParticipantItem,
  SignupInitialData,
} from "@/lib/landing-types";

const DAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

function sortWithCompanions(participants: MeetingParticipantItem[]) {
  const regulars = participants.filter((participant) => participant.companionId === null);
  const companions = participants.filter((participant) => participant.companionId !== null);
  const result: MeetingParticipantItem[] = [];

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

function normalizeMeetingDetail(data: {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string | null;
  isOpen: boolean;
  meetingType: string;
  createdByKakaoId: string | null;
  approvedCount: number;
  participants?: MeetingParticipantItem[];
}): DetailedMeeting {
  return {
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
    participantsList: (data.participants ?? []).filter((participant) => participant.status !== "CANCELLED"),
  };
}

export default function EmbeddedMeetingDetail({
  meetingId,
  activeTab,
  currentUser,
  participantOptionPricingGuide,
  initialMeeting,
  initialSignupData,
  onMeetingSummaryChange,
}: {
  meetingId: number;
  activeTab: "apply" | "status";
  currentUser: HomeUser | null;
  participantOptionPricingGuide: string;
  initialMeeting?: DetailedMeeting;
  initialSignupData?: SignupInitialData;
  onMeetingSummaryChange?: (meetingId: number, approvedCount: number) => void;
}) {
  const [meeting, setMeeting] = useState<DetailedMeeting | null>(initialMeeting ?? null);
  const [loading, setLoading] = useState(!initialMeeting);
  const [error, setError] = useState(false);

  const fetchMeeting = useCallback(async (background = false) => {
    if (!background) {
      setLoading(true);
      setError(false);
    }

    try {
      const res = await fetch(`/api/meetings/${meetingId}`, { cache: "no-store" });
      if (!res.ok) throw new Error("failed to fetch meeting");

      const data = await res.json();
      const nextMeeting = normalizeMeetingDetail(data);
      setMeeting(nextMeeting);
      onMeetingSummaryChange?.(meetingId, nextMeeting.approvedCount);
      setError(false);
      return nextMeeting;
    } catch {
      if (!background) {
        setMeeting(null);
        setError(true);
      }
      return null;
    } finally {
      if (!background) setLoading(false);
    }
  }, [meetingId, onMeetingSummaryChange]);

  useEffect(() => {
    setMeeting(initialMeeting ?? null);
    setLoading(!initialMeeting);
    setError(false);
  }, [meetingId, initialMeeting]);

  useEffect(() => {
    if (!initialMeeting) {
      void fetchMeeting();
    } else {
      onMeetingSummaryChange?.(meetingId, initialMeeting.approvedCount);
    }
  }, [fetchMeeting, initialMeeting, meetingId, onMeetingSummaryChange]);

  useEffect(() => {
    if (activeTab !== "status") return;
    const interval = window.setInterval(() => {
      void fetchMeeting(true);
    }, 8000);

    return () => {
      window.clearInterval(interval);
    };
  }, [activeTab, fetchMeeting]);

  if (loading) {
    return <div className="brand-card-soft min-h-[34rem] animate-pulse rounded-2xl" />;
  }

  if (error || !meeting) {
    return (
      <div className="brand-card-soft rounded-2xl px-5 py-6 text-sm font-medium brand-text-muted">
        모임 상세 정보를 불러오지 못했습니다.
      </div>
    );
  }

  const dateObj = new Date(`${meeting.date}T00:00:00`);
  const dayName = DAY_KO[dateObj.getDay()];
  const [, month, day] = meeting.date.split("-");
  const displayDate = `${parseInt(month, 10)}월 ${parseInt(day, 10)}일 (${dayName})`;
  const participants = sortWithCompanions(meeting.participantsList);
  const optionSummary = {
    bus: participants.filter((participant) => participant.hasBus).length,
    lesson: participants.filter((participant) => participant.hasLesson).length,
    rentalOnly: participants.filter((participant) => participant.hasRental).length,
  };

  function ParticipantAvatar({ participant }: { participant: MeetingParticipantItem }) {
    const fallbackEmoji = pickSurfAvatarEmoji(`${participant.kakaoId}:${participant.companionId ?? participant.id}:${participant.name}`);

    return (
      <div className="brand-avatar-shell flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full text-xs font-extrabold shadow-sm">
        {participant.profileImage ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img alt={participant.name} className="h-full w-full object-cover" referrerPolicy="no-referrer" src={participant.profileImage} />
        ) : (
          <span>{fallbackEmoji}</span>
        )}
      </div>
    );
  }

  return (
    <section className={activeTab === "apply" ? "space-y-2" : ""}>
      {activeTab === "apply" ? (
        <div className="brand-card-soft space-y-4 rounded-2xl p-3.5">
          <div className="border-b border-[var(--brand-divider)] pb-4">
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

          <SignupForm
            currentUser={currentUser}
            initialData={initialSignupData}
            meeting={meeting}
            onMeetingChange={() => fetchMeeting(true)}
            participantOptionPricingGuide={participantOptionPricingGuide}
          />
        </div>
      ) : (
        <div className="space-y-3">
          {participants.length ? (
            <div className="brand-card-soft overflow-hidden rounded-2xl">
              {participants.map((participant) => {
                const isCompanion = participant.companionId !== null;
                const visibleNote = isCompanion && participant.note?.trim().endsWith("의 동반")
                  ? null
                  : participant.note;

                return (
                  <div
                    key={participant.id}
                    className={`brand-list-row flex gap-3 px-4 py-3 last:border-b-0 ${visibleNote ? "items-start" : "items-center"} ${isCompanion ? "pl-10" : ""}`}
                  >
                    <ParticipantAvatar participant={participant} />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <p className="font-semibold text-[var(--brand-text)]">{participant.name}</p>
                        {isCompanion ? <span className="brand-chip-companion rounded px-1.5 py-0.5 text-[10px] font-bold">동반</span> : null}
                        {participant.hasBus ? <span className="brand-chip-soft rounded px-1.5 py-0.5 text-[10px] font-bold">셔틀 버스</span> : null}
                        {participant.hasLesson ? <span className="brand-chip-strong rounded px-1.5 py-0.5 text-[10px] font-bold">강습+장비대여</span> : null}
                        {participant.hasRental ? <span className="brand-chip-dark rounded px-1.5 py-0.5 text-[10px] font-bold">장비 대여만</span> : null}
                      </div>
                      {visibleNote ? <p className="brand-text-muted mt-1 text-sm">{visibleNote}</p> : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="brand-inset-panel rounded-2xl px-4 py-6 text-center text-sm font-medium brand-text-muted">
              아직 참가 신청자가 없습니다.
            </div>
          )}

          {participants.length ? (
            <div className="brand-card-soft rounded-2xl px-4 py-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="brand-panel-white rounded-xl px-3 py-2.5">
                  <p className="brand-text-subtle text-[11px] font-bold">🚌 셔틀 버스</p>
                  <p className="mt-1 text-base font-extrabold text-[var(--brand-text)]">{optionSummary.bus}</p>
                </div>
                <div className="brand-panel-white rounded-xl px-3 py-2.5">
                  <p className="brand-text-subtle text-[11px] font-bold">🏄‍♂️ 강습+장비</p>
                  <p className="mt-1 text-base font-extrabold text-[var(--brand-text)]">{optionSummary.lesson}</p>
                </div>
                <div className="brand-panel-white rounded-xl px-3 py-2.5">
                  <p className="brand-text-subtle text-[11px] font-bold">🩳 장비 대여만</p>
                  <p className="mt-1 text-base font-extrabold text-[var(--brand-text)]">{optionSummary.rentalOnly}</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
