"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { SignupForm } from "@/components/meeting/SignupForm";
import { Icon } from "@/components/ui/Icon";
import { pickSurfAvatarEmoji } from "@/lib/avatar-emoji";
import type {
  AdminSettlementStatusSummary,
  DetailedMeeting,
  HomeUser,
  MeetingParticipantItem,
  SignupInitialData,
} from "@/lib/landing-types";

import { formatWon } from "@/lib/format";

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
  onMeetingSummaryChange?: (meetingId: number, approvedCount: number, participantCount: number) => void;
  onSettlementStatusChange?: (meetingId: number, status: AdminSettlementStatusSummary) => void;
}) {
  const [meeting, setMeeting] = useState<DetailedMeeting | null>(initialMeeting ?? null);
  const [loading, setLoading] = useState(!initialMeeting);
  const [error, setError] = useState(false);
  const [settlementStatus, setSettlementStatus] = useState<AdminSettlementStatusSummary | null>(initialSettlementStatus ?? null);
  const settlementStatusFetchedRef = useRef(!!initialSettlementStatus);
  const [loadingSettlementStatus, setLoadingSettlementStatus] = useState(false);
  const [settlementStatusError, setSettlementStatusError] = useState(false);
  const [participantQuery, setParticipantQuery] = useState("");
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
      onMeetingSummaryChange?.(meetingId, nextMeeting.approvedCount, nextMeeting.participantsList.length);
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
      onMeetingSummaryChange?.(meetingId, initialMeeting.approvedCount, initialMeeting.participantsList.length);
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
    if (!isAdmin || activeTab !== "settlement") return;
    const isBackground = settlementStatusFetchedRef.current;
    settlementStatusFetchedRef.current = true;
    void fetchSettlementStatus(isBackground);
  }, [activeTab, fetchSettlementStatus, isAdmin]);

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
      <div className="brand-card-soft rounded-2xl px-5 py-6 text-center">
        <p className="text-sm font-bold text-brand-text">모임 정보를 불러오지 못했습니다.</p>
        <p className="brand-text-subtle mt-1 text-xs">연결을 확인한 뒤 다시 시도해 주세요.</p>
        <button className="brand-button-secondary mt-4 rounded-xl px-4 py-2 text-sm font-bold" onClick={() => { void fetchMeeting(); }} type="button">
          다시 시도
        </button>
      </div>
    );
  }

  const participants = sortWithCompanions(meeting.participantsList);
  const normalizedQuery = participantQuery.trim().toLocaleLowerCase("ko-KR");
  const filteredParticipants = normalizedQuery
    ? participants.filter((participant) => `${participant.name} ${participant.note ?? ""}`.toLocaleLowerCase("ko-KR").includes(normalizedQuery))
    : participants;
  const participantGroups = [
    { id: "approved", label: "참가 확정", participants: filteredParticipants.filter((participant) => participant.status === "APPROVED") },
    { id: "waitlisted", label: "대기", participants: filteredParticipants.filter((participant) => participant.status === "WAITLISTED") },
    { id: "other", label: "기타", participants: filteredParticipants.filter((participant) => !["APPROVED", "WAITLISTED"].includes(participant.status)) },
  ].filter((group) => group.participants.length > 0);
  const optionSummary = {
    bus: participants.filter((participant) => participant.hasBus).length,
    lesson: participants.filter((participant) => participant.hasLesson).length,
    rentalOnly: participants.filter((participant) => participant.hasRental).length,
  };
  const pendingRecipients = settlementStatus?.recipients.filter((recipient) => !recipient.completed) ?? [];
  const completedRecipients = settlementStatus?.recipients.filter((recipient) => recipient.completed) ?? [];
  const pendingTotalFee = pendingRecipients.reduce((sum, recipient) => sum + recipient.totalFee, 0);
  const completedTotalFee = completedRecipients.reduce((sum, recipient) => sum + recipient.totalFee, 0);


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
    completed,
  }: {
    title: string;
    recipients: AdminSettlementStatusSummary["recipients"];
    completed: boolean;
  }) {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-extrabold text-brand-text">{title}</h4>
          <span className={`${completed ? "brand-chip-dark" : "brand-chip-soft"} rounded-full px-2 py-1 text-[10px] font-bold`}>
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
                    <p className="text-sm font-bold text-brand-text">{recipient.recipientName}</p>
                    <p className="brand-text-subtle mt-1 text-xs">
                      {recipient.itemCount === 1 ? "1건" : `${recipient.itemCount}건 합산`}
                      {completed && recipient.completedAt ? ` · ${formatConfirmedAt(recipient.completedAt)} 송금완료` : ""}
                    </p>
                  </div>
                  <span className="text-sm font-extrabold text-brand-text">{formatWon(recipient.totalFee)}</span>
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
          <div className="border-b border-brand-divider pb-4">
            <h3 className="font-headline text-base font-extrabold">참가 신청</h3>
            {meeting.description ? (
              <p className="brand-panel-strong mt-2 rounded-xl px-3 py-2 text-sm brand-text-muted">
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
            <>
              <label className="brand-panel-white flex items-center gap-2 rounded-2xl px-3">
                <Icon className="brand-text-subtle text-[20px]" name="search" />
                <span className="sr-only">참가자 검색</span>
                <input
                  className="min-w-0 flex-1 bg-transparent py-3 text-sm outline-none"
                  onChange={(event) => setParticipantQuery(event.target.value)}
                  placeholder="이름 또는 메모로 찾기"
                  type="search"
                  value={participantQuery}
                />
              </label>
              {participantGroups.length ? participantGroups.map((group) => (
                <details className="brand-card-soft overflow-hidden rounded-2xl" key={group.id} open={Boolean(normalizedQuery) || participants.length <= 12}>
                  <summary className="flex cursor-pointer items-center justify-between px-4 py-3 text-sm font-extrabold">
                    <span>{group.label}</span>
                    <span className="brand-chip-soft rounded-full px-2 py-1 text-xs">{group.participants.length}</span>
                  </summary>
                  <div className="border-t border-brand-divider">
                    {group.participants.map((participant) => {
                      const isCompanion = participant.companionId !== null;
                      const visibleNote = isCompanion && participant.note?.trim().endsWith("의 동반") ? null : participant.note;
                      return (
                        <div className={`brand-list-row flex gap-3 px-4 py-3 last:border-b-0 ${visibleNote ? "items-start" : "items-center"} ${isCompanion ? "pl-8" : ""}`} key={participant.id}>
                          <ParticipantAvatar participant={participant} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <p className="font-semibold text-brand-text">{participant.name}</p>
                              {isCompanion ? <span className="brand-chip-companion rounded px-1.5 py-0.5 text-[10px] font-bold">동반</span> : null}
                              {participant.hasBus ? <span className="brand-chip-soft rounded px-1.5 py-0.5 text-[10px] font-bold">셔틀</span> : null}
                              {participant.hasLesson ? <span className="brand-chip-dark rounded px-1.5 py-0.5 text-[10px] font-bold">강습·장비</span> : null}
                              {participant.hasRental ? <span className="brand-chip-strong rounded px-1.5 py-0.5 text-[10px] font-bold">장비 대여</span> : null}
                            </div>
                            {visibleNote ? <p className="brand-text-muted mt-1 text-sm">{visibleNote}</p> : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </details>
              )) : (
                <div className="brand-inset-panel rounded-2xl px-4 py-6 text-center">
                  <p className="text-sm font-bold">검색 결과가 없습니다.</p>
                  <button className="brand-link mt-2 text-sm font-semibold" onClick={() => setParticipantQuery("")} type="button">검색어 지우기</button>
                </div>
              )}
            </>
          ) : (
            <div className="brand-inset-panel rounded-2xl px-4 py-6 text-center text-sm font-medium brand-text-muted">
              아직 참가 신청자가 없습니다.
            </div>
          )}

          {participants.length ? (
            <div className="brand-card-soft rounded-2xl px-4 py-3">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="brand-panel-white rounded-xl px-3 py-2.5">
                  <p className="brand-text-subtle text-[11px] font-bold">셔틀 버스</p>
                  <p className="mt-1 text-base font-extrabold text-brand-text">{optionSummary.bus}</p>
                </div>
                <div className="brand-panel-white rounded-xl px-3 py-2.5">
                  <p className="brand-text-subtle text-[11px] font-bold">강습·장비</p>
                  <p className="mt-1 text-base font-extrabold text-brand-text">{optionSummary.lesson}</p>
                </div>
                <div className="brand-panel-white rounded-xl px-3 py-2.5">
                  <p className="brand-text-subtle text-[11px] font-bold">장비 대여</p>
                  <p className="mt-1 text-base font-extrabold text-brand-text">{optionSummary.rentalOnly}</p>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="brand-card-soft space-y-4 rounded-2xl p-3.5">
          <div className="flex items-start justify-between gap-3">
            <h3 className="text-base font-extrabold text-brand-text">정산 현황</h3>
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
              <p className="text-sm font-semibold text-brand-text">정산 현황을 불러오지 못했습니다.</p>
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
              <div className="grid grid-cols-3 gap-2">
                <div className="brand-panel-white rounded-2xl px-3 py-3 text-center">
                  <p className="brand-text-subtle text-[11px] font-bold">정산 대기</p>
                  <p className="mt-1 text-sm font-extrabold text-brand-text">{formatWon(pendingTotalFee)}</p>
                </div>
                <div className="brand-panel-white rounded-2xl px-3 py-3 text-center">
                  <p className="brand-text-subtle text-[11px] font-bold">송금완료 금액</p>
                  <p className="mt-1 text-sm font-extrabold text-brand-text">{formatWon(completedTotalFee)}</p>
                </div>
                <div className="brand-panel-white rounded-2xl px-3 py-3 text-center">
                  <p className="brand-text-subtle text-[11px] font-bold">송금완료 인원</p>
                  <p className="mt-1 text-sm font-extrabold text-brand-text">{settlementStatus.summary.completedCount}</p>
                </div>
              </div>

              {!settlementStatus.meeting.settlementOpen ? (
                <div className="brand-panel-white rounded-2xl px-4 py-8 text-center text-sm brand-text-subtle">
                  정산이 아직 열리지 않았습니다. 정산 관리에서 열면 여기서 확인 현황을 볼 수 있습니다.
                </div>
              ) : (
                <div className="space-y-4">
                  <SettlementRecipientList title="정산 대기" recipients={pendingRecipients} completed={false} />
                  <SettlementRecipientList title="송금완료" recipients={completedRecipients} completed={true} />
                </div>
              )}
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}
