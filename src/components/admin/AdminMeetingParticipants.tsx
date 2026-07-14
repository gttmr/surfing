"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/ui/Icon";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Tabs } from "@/components/ui/Tabs";
import type { AdminMeetingParticipant } from "@/lib/admin-page-data";
import type { ParticipantStatus } from "@/lib/types";

export type ParticipantTab = "approved" | "waitlisted" | "cancelled" | "all";
export type ParticipantAction = "approve" | "cancel";

type ParticipantActionRequest = {
  readonly action: ParticipantAction;
  readonly participant: AdminMeetingParticipant;
};

type AdminMeetingParticipantsProps = {
  readonly activeTab: ParticipantTab;
  readonly onChangeTab: (tab: ParticipantTab) => void;
  readonly onRequestAction: (request: ParticipantActionRequest) => void;
  readonly participants: readonly AdminMeetingParticipant[];
};

const STATUS_GROUPS = [
  { status: "APPROVED", tab: "approved", label: "참가 확정" },
  { status: "WAITLISTED", tab: "waitlisted", label: "대기자" },
  { status: "CANCELLED", tab: "cancelled", label: "취소됨" },
] as const satisfies readonly { readonly status: ParticipantStatus; readonly tab: Exclude<ParticipantTab, "all">; readonly label: string }[];

const EMPTY_LABELS = {
  approved: "확정된 참가자가 없습니다",
  waitlisted: "대기 중인 참가자가 없습니다",
  cancelled: "취소된 참가자가 없습니다",
  all: "아직 신청한 참가자가 없습니다",
} as const satisfies Record<ParticipantTab, string>;

function participantStatus(value: string): ParticipantStatus | null {
  if (value === "APPROVED" || value === "WAITLISTED" || value === "CANCELLED") return value;
  return null;
}

function sortWithCompanions(participants: readonly AdminMeetingParticipant[]): AdminMeetingParticipant[] {
  const regulars = participants.filter((participant) => participant.companionId === null);
  const companions = participants.filter((participant) => participant.companionId !== null);
  const result: AdminMeetingParticipant[] = [];
  for (const regular of regulars) {
    result.push(regular);
    result.push(...companions.filter((companion) => companion.kakaoId === regular.kakaoId));
  }
  const placed = new Set(result.map((participant) => participant.id));
  result.push(...companions.filter((participant) => !placed.has(participant.id)));
  return result;
}

function ParticipantCard({ participant, onRequestAction }: { readonly participant: AdminMeetingParticipant; readonly onRequestAction: (request: ParticipantActionRequest) => void }) {
  const status = participantStatus(participant.status);
  const companion = participant.companionId !== null;
  return (
    <article className={`brand-card-soft rounded-2xl p-4 ${companion ? "ml-5 border-l-2 border-l-[var(--brand-primary-border-strong)]" : ""}`}>
      <details>
        <summary className="brand-touch-target flex cursor-pointer list-none items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-2">
              <span className="w-full text-balance font-extrabold text-[var(--brand-text)]">{participant.name}</span>
              {companion ? <span className="brand-chip-companion rounded px-1.5 py-0.5 text-[10px] font-bold">동반</span> : null}
              {status ? <StatusBadge size="sm" status={status} waitlistPosition={participant.waitlistPosition} /> : <span className="brand-chip-dimmed rounded px-2 py-0.5 text-xs">상태 확인 필요</span>}
            </span>
            <span className="brand-text-subtle mt-1 block text-xs">세부 정보 펼치기</span>
          </span>
          <Icon className="brand-text-subtle mt-1 shrink-0 text-[20px]" name="expand_more" />
        </summary>
        <div className="brand-inset-panel mt-3 space-y-2 rounded-xl p-3 text-xs">
          <p><span className="brand-text-subtle">카카오 닉네임</span><span className="ml-2 font-semibold text-[var(--brand-text)]">{participant.kakaoNickname}</span></p>
          <div className="flex flex-wrap gap-1.5">
            {participant.hasBus ? <span className="brand-chip-soft rounded px-2 py-1 font-bold">셔틀 버스</span> : null}
            {participant.hasLesson ? <span className="brand-chip-dark rounded px-2 py-1 font-bold">강습·장비</span> : null}
            {participant.hasRental ? <span className="brand-chip-strong rounded px-2 py-1 font-bold">장비 대여</span> : null}
            {participant.isPenalized ? <span className="brand-chip-danger rounded px-2 py-1 font-bold">패널티</span> : null}
            {!participant.hasBus && !participant.hasLesson && !participant.hasRental && !participant.isPenalized ? <span className="brand-text-subtle">추가 옵션 없음</span> : null}
          </div>
          {participant.note ? <p className="break-keep leading-5 text-[var(--brand-text)]">{participant.note}</p> : null}
          <p className="brand-text-subtle">신청 {new Date(participant.submittedAt).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
          {participant.cancelledAt ? <p className="brand-text-subtle">취소 {new Date(participant.cancelledAt).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p> : null}
        </div>
      </details>
      <div className="mt-3 flex justify-end gap-2">
        {participant.status === "WAITLISTED" ? <button aria-label={`${participant.name} 참가 확정`} className="brand-button-confirm rounded-xl px-3 py-2 text-xs font-bold" onClick={() => onRequestAction({ action: "approve", participant })} type="button">참가 확정</button> : null}
        {participant.status !== "CANCELLED" ? <button aria-label={`${participant.name} 참가 취소`} className="brand-button-danger rounded-xl px-3 py-2 text-xs font-bold" onClick={() => onRequestAction({ action: "cancel", participant })} type="button">참가 취소</button> : null}
        {participant.status === "CANCELLED" ? <button aria-label={`${participant.name} 참가 복구`} className="brand-button-confirm rounded-xl px-3 py-2 text-xs font-bold" onClick={() => onRequestAction({ action: "approve", participant })} type="button">참가 복구</button> : null}
      </div>
    </article>
  );
}

export function AdminMeetingParticipants({ activeTab, onChangeTab, onRequestAction, participants }: AdminMeetingParticipantsProps) {
  const [query, setQuery] = useState("");
  const counts = useMemo(() => ({
    approved: participants.filter((participant) => participant.status === "APPROVED").length,
    waitlisted: participants.filter((participant) => participant.status === "WAITLISTED").length,
    cancelled: participants.filter((participant) => participant.status === "CANCELLED").length,
    all: participants.length,
  }), [participants]);
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
  const activeStatus = STATUS_GROUPS.find((group) => group.tab === activeTab)?.status;
  const tabParticipants = participants.filter((participant) => !activeStatus || participant.status === activeStatus);
  const visibleParticipants = sortWithCompanions(tabParticipants.filter((participant) => {
    if (!normalizedQuery) return true;
    return [participant.name, participant.kakaoNickname, participant.note ?? ""]
      .some((value) => value.toLocaleLowerCase("ko-KR").includes(normalizedQuery));
  }));
  const groups = activeTab === "all" ? STATUS_GROUPS : STATUS_GROUPS.filter((group) => group.tab === activeTab);

  return (
    <section className="brand-admin-section overflow-hidden">
      <div className="px-4 pt-4">
        <Tabs
          activeId={activeTab}
          items={[...STATUS_GROUPS.map((group) => ({ id: group.tab, label: `${group.label} ${counts[group.tab]}` })), { id: "all", label: `전체 ${counts.all}` }]}
          label="참가자 상태"
          listClassName="gap-4 overflow-x-auto"
          onChange={onChangeTab}
          panelClassName="pb-4 pt-4"
          tabClassName="shrink-0 whitespace-nowrap px-1 pb-3 text-sm font-extrabold"
        >
          <label className="relative mb-4 block">
            <span className="sr-only">참가자 검색</span>
            <Icon className="brand-text-subtle pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px]" name="search" />
            <input aria-label="참가자 검색" className="brand-input w-full rounded-xl py-2.5 pl-10 pr-10 text-sm" onChange={(event) => setQuery(event.target.value)} placeholder="이름, 카카오 닉네임, 메모 검색" type="search" value={query} />
            {query ? <button aria-label="참가자 검색 지우기" className="brand-text-subtle absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full" onClick={() => setQuery("")} type="button"><Icon className="text-[18px]" name="close" /></button> : null}
          </label>
          {visibleParticipants.length === 0 ? (
            <div className="brand-admin-empty py-8" role="status">
              <Icon className="mx-auto text-[30px]" name={normalizedQuery ? "search_off" : "group_off"} />
              <p className="mt-2 text-sm font-bold">{normalizedQuery ? "검색 결과가 없습니다" : EMPTY_LABELS[activeTab]}</p>
              <p className="mt-1 text-xs">{normalizedQuery ? `“${query.trim()}”와 일치하는 참가자가 없습니다.` : "다른 상태 탭도 확인해 보세요."}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {groups.map((group) => {
                const groupedParticipants = visibleParticipants.filter((participant) => participant.status === group.status);
                if (groupedParticipants.length === 0) return null;
                return (
                  <details className="brand-panel rounded-2xl p-3" key={group.status} open>
                    <summary className="brand-touch-target flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-extrabold">
                      <span>{group.label} <span className="brand-text-subtle ml-1 text-xs">{groupedParticipants.length}명</span></span>
                      <Icon className="brand-text-subtle text-[20px]" name="expand_more" />
                    </summary>
                    <div className="mt-3 space-y-2">{groupedParticipants.map((participant) => <ParticipantCard key={participant.id} onRequestAction={onRequestAction} participant={participant} />)}</div>
                  </details>
                );
              })}
            </div>
          )}
        </Tabs>
      </div>
    </section>
  );
}
