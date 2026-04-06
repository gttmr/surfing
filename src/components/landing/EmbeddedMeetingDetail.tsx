"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { SignupForm } from "@/components/meeting/SignupForm";
import { pickSurfAvatarEmoji } from "@/lib/avatar-emoji";
import type {
  AdminSettlementStatusSummary,
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
  isAdmin,
  participantOptionPricingGuide,
  initialMeeting,
  initialSettlementStatus,
  initialSignupData,
  onMeetingSummaryChange,
  onSettlementStatusChange,
}: {
  meetingId: number;
  activeTab: "apply" | "status" | "settlement";
  currentUser: HomeUser | null;
  isAdmin: boolean;
  participantOptionPricingGuide: string;
  initialMeeting?: DetailedMeeting;
  initialSettlementStatus?: AdminSettlementStatusSummary;
  initialSignupData?: SignupInitialData;
  onMeetingSummaryChange?: (meetingId: number, approvedCount: number) => void;
  onSettlementStatusChange?: (meetingId: number, status: AdminSettlementStatusSummary) => void;
}) {
  const [meeting, setMeeting] = useState<DetailedMeeting | null>(initialMeeting ?? null);
  const [loading, setLoading] = useState(!initialMeeting);
  const [error, setError] = useState(false);
  const [settlementStatus, setSettlementStatus] = useState<AdminSettlementStatusSummary | null>(initialSettlementStatus ?? null);
  const [loadingSettlementStatus, setLoadingSettlementStatus] = useState(false);
  const [settlementStatusError, setSettlementStatusError] = useState(false);
  const [isDocumentVisible, setIsDocumentVisible] = useState(() => (
    typeof document === "undefined" ? true : document.visibilityState === "visible"
  ));

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

  const fetchSettlementStatus = useCallback(async (background = false) => {
    if (!isAdmin) return null;

    if (!background) {
      setLoadingSettlementStatus(true);
      setSettlementStatusError(false);
    }

    try {
      const res = await fetch(`/api/admin/meetings/${meetingId}/settlement-status`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "failed to fetch settlement status");
      }

      const nextStatus = data as AdminSettlementStatusSummary;
      setSettlementStatus(nextStatus);
      setSettlementStatusError(false);
      onSettlementStatusChange?.(meetingId, nextStatus);
      return nextStatus;
    } catch {
      if (!background) {
        setSettlementStatusError(true);
      }
      return null;
    } finally {
      if (!background) setLoadingSettlementStatus(false);
    }
  }, [isAdmin, meetingId, onSettlementStatusChange]);

  useEffect(() => {
    setMeeting(initialMeeting ?? null);
    setLoading(!initialMeeting);
    setError(false);
  }, [meetingId, initialMeeting]);

  useEffect(() => {
    setSettlementStatus(initialSettlementStatus ?? null);
    setSettlementStatusError(false);
  }, [initialSettlementStatus, meetingId]);

  useEffect(() => {
    if (!initialMeeting) {
      void fetchMeeting();
    } else {
      onMeetingSummaryChange?.(meetingId, initialMeeting.approvedCount);
    }
  }, [fetchMeeting, initialMeeting, meetingId, onMeetingSummaryChange]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const syncVisibility = () => {
      setIsDocumentVisible(document.visibilityState === "visible");
    };
    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    window.addEventListener("focus", syncVisibility);
    window.addEventListener("blur", syncVisibility);

    return () => {
      document.removeEventListener("visibilitychange", syncVisibility);
      window.removeEventListener("focus", syncVisibility);
      window.removeEventListener("blur", syncVisibility);
    };
  }, []);

  useEffect(() => {
    if (activeTab !== "status") return;
    void fetchMeeting(true);
  }, [activeTab, fetchMeeting]);

  useEffect(() => {
    if (!isAdmin || activeTab !== "settlement") return;
    void fetchSettlementStatus(Boolean(settlementStatus));
  }, [activeTab, fetchSettlementStatus, isAdmin, settlementStatus]);

  useEffect(() => {
    if (activeTab !== "status" || !isDocumentVisible) return;
    const interval = window.setInterval(() => {
      void fetchMeeting(true);
    }, 15000);

    return () => {
      window.clearInterval(interval);
    };
  }, [activeTab, fetchMeeting, isDocumentVisible]);

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
  const unconfirmedRecipients = settlementStatus?.recipients.filter((recipient) => !recipient.confirmed) ?? [];
  const confirmedRecipients = settlementStatus?.recipients.filter((recipient) => recipient.confirmed) ?? [];
  const unconfirmedTotalFee = unconfirmedRecipients.reduce((sum, recipient) => sum + recipient.totalFee, 0);
  const confirmedTotalFee = confirmedRecipients.reduce((sum, recipient) => sum + recipient.totalFee, 0);

  function formatWon(value: number) {
    return `${value.toLocaleString("ko-KR")}원`;
  }

  function formatConfirmedAt(value: string | null) {
    if (!value) return "";
    return new Date(value).toLocaleString("ko-KR", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

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

  function SettlementRecipientList({
    title,
    recipients,
    confirmed,
  }: {
    title: string;
    recipients: AdminSettlementStatusSummary["recipients"];
    confirmed: boolean;
  }) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-extrabold text-[var(--brand-text)]">{title}</h4>
          <span className={`${confirmed ? "brand-chip-dark" : "brand-chip-soft"} rounded-full px-2 py-1 text-[10px] font-bold`}>
            {recipients.length}
          </span>
        </div>
        {recipients.length === 0 ? (
          <div className="brand-panel-white rounded-2xl px-4 py-4 text-center text-sm brand-text-subtle">
            대상이 없습니다.
          </div>
        ) : (
          <div className="space-y-2">
            {recipients.map((recipient) => (
              <div key={`${recipient.recipientKakaoId}-${recipient.recipientType}`} className="brand-panel-white rounded-2xl px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-[var(--brand-text)]">{recipient.recipientName}</p>
                    <p className="brand-text-subtle mt-1 text-xs">
                      {recipient.itemCount === 1 ? "1건" : `${recipient.itemCount}건 합산`}
                      {confirmed && recipient.confirmedAt ? ` · ${formatConfirmedAt(recipient.confirmedAt)} 확인` : ""}
                    </p>
                  </div>
                  <span className="text-sm font-extrabold text-[var(--brand-text)]">{formatWon(recipient.totalFee)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <section className={activeTab === "apply" ? "space-y-2" : "space-y-3"}>
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
      ) : activeTab === "status" ? (
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
      ) : (
        <div className="brand-card-soft space-y-4 rounded-2xl p-3.5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-extrabold text-[var(--brand-text)]">정산 현황</h3>
            <Link
              href={`/admin/meetings/${meetingId}/settlement`}
              className="brand-button-primary shrink-0 rounded-full px-3 py-1.5 text-xs font-bold"
            >
              정산 관리
            </Link>
          </div>

          {loadingSettlementStatus && !settlementStatus ? (
            <div className="brand-panel-white rounded-2xl px-4 py-8 text-center text-sm brand-text-subtle">
              정산 현황을 불러오는 중...
            </div>
          ) : settlementStatusError && !settlementStatus ? (
            <div className="brand-panel-white rounded-2xl px-4 py-6 text-center">
              <p className="text-sm font-semibold text-[var(--brand-text)]">정산 현황을 불러오지 못했습니다.</p>
              <button
                type="button"
                onClick={() => { void fetchSettlementStatus(false); }}
                className="brand-button-secondary mt-3 rounded-xl px-4 py-2 text-sm font-bold"
              >
                다시 시도
              </button>
            </div>
          ) : settlementStatus ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="brand-panel-white rounded-2xl px-3 py-3 text-center">
                  <p className="brand-text-subtle text-[11px] font-bold">아직 안 읽음</p>
                  <p className="mt-1 text-sm font-extrabold text-[var(--brand-text)]">{formatWon(unconfirmedTotalFee)}</p>
                </div>
                <div className="brand-panel-white rounded-2xl px-3 py-3 text-center">
                  <p className="brand-text-subtle text-[11px] font-bold">이체 버튼 누름</p>
                  <p className="mt-1 text-sm font-extrabold text-[var(--brand-text)]">{formatWon(confirmedTotalFee)}</p>
                </div>
              </div>

              {!settlementStatus.meeting.settlementOpen ? (
                <div className="brand-panel-white rounded-2xl px-4 py-8 text-center text-sm brand-text-subtle">
                  정산이 아직 열리지 않았습니다. 정산 관리에서 열면 여기서 확인 현황을 볼 수 있습니다.
                </div>
              ) : (
                <div className="space-y-4">
                  <SettlementRecipientList title="미확인" recipients={unconfirmedRecipients} confirmed={false} />
                  <SettlementRecipientList title="확인" recipients={confirmedRecipients} confirmed={true} />
                </div>
              )}
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}
