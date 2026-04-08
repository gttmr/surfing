"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Toast, useToast } from "@/components/ui/Toast";
import type { AdminMeetingDetail, AdminMeetingParticipant } from "@/lib/admin-page-data";
import type { ParticipantStatus } from "@/lib/types";
import { DAY_KO } from "@/lib/format";

type Tab = "approved" | "waitlisted" | "cancelled" | "all";

const TAB_LABELS: Record<Tab, string> = {
  approved: "참가 확정",
  waitlisted: "대기자",
  cancelled: "취소됨",
  all: "전체",
};

function sortWithCompanions(participants: AdminMeetingParticipant[]) {
  const regulars = participants.filter((participant) => participant.companionId === null);
  const companions = participants.filter((participant) => participant.companionId !== null);

  const result: AdminMeetingParticipant[] = [];
  for (const regular of regulars) {
    result.push(regular);
    result.push(...companions.filter((companion) => companion.kakaoId === regular.kakaoId));
  }
  const placed = new Set(result.map((participant) => participant.id));
  for (const companion of companions) {
    if (!placed.has(companion.id)) result.push(companion);
  }
  return result;
}

function KakaoBadge({ nickname }: { nickname: string }) {
  return (
    <span className="brand-chip-accent inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-xs">
      <svg viewBox="0 0 24 24" className="h-3 w-3" fill="currentColor">
        <path d="M12 3C6.477 3 2 6.477 2 10.857c0 2.713 1.584 5.1 3.988 6.577L5 21l4.29-2.287C10.145 18.9 11.058 19 12 19c5.523 0 10-3.477 10-7.143C22 6.477 17.523 3 12 3z" />
      </svg>
      {nickname}
    </span>
  );
}

export function AdminMeetingDetailPageClient({
  meetingId,
  initialMeeting,
}: {
  meetingId: number;
  initialMeeting: AdminMeetingDetail;
}) {
  const [meeting, setMeeting] = useState(initialMeeting);
  const [activeTab, setActiveTab] = useState<Tab>("approved");
  const [reloading, setReloading] = useState(false);
  const { toasts, addToast, removeToast } = useToast();
  const router = useRouter();

  async function reloadMeeting() {
    setReloading(true);
    try {
      const res = await fetch(`/api/meetings/${meetingId}`);
      if (!res.ok) throw new Error("reload_failed");
      const next = (await res.json()) as AdminMeetingDetail;
      setMeeting(next);
    } finally {
      setReloading(false);
    }
  }

  async function handleDelete() {
    if (!confirm("이 일정을 삭제하시겠습니까?")) return;

    const res = await fetch(`/api/meetings/${meeting.id}`, { method: "DELETE" });

    if (res.ok) {
      addToast("삭제되었습니다", "success");
      setTimeout(() => router.push("/admin/meetings"), 500);
    } else {
      addToast("삭제에 실패했습니다", "error");
    }
  }

  async function handleAction(participantId: number, action: string) {
    const res = await fetch(`/api/participants/${participantId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });

    if (res.ok) {
      const actionLabels: Record<string, string> = {
        approve: "참가 확정되었습니다",
        cancel: "취소되었습니다",
        waitlist: "대기자로 변경되었습니다",
      };
      addToast(actionLabels[action] || "업데이트되었습니다", "success");
      await reloadMeeting();
    } else {
      addToast("오류가 발생했습니다", "error");
    }
  }

  async function handleToggleOpen() {
    const res = await fetch(`/api/meetings/${meetingId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isOpen: !meeting.isOpen }),
    });
    if (!res.ok) {
      addToast("신청 상태를 바꾸지 못했습니다", "error");
      return;
    }
    setMeeting((prev) => ({ ...prev, isOpen: !prev.isOpen }));
  }

  const date = new Date(`${meeting.date}T00:00:00`);
  const [, month, day] = meeting.date.split("-");
  const displayDate = `${parseInt(month, 10)}월 ${parseInt(day, 10)}일 (${DAY_KO[date.getDay()]})`;

  const filteredParticipants = meeting.participants.filter((participant) => {
    if (activeTab === "all") return true;
    return participant.status.toLowerCase() === activeTab;
  });

  const counts: Record<Tab, number> = {
    approved: meeting.participants.filter((participant) => participant.status === "APPROVED").length,
    waitlisted: meeting.participants.filter((participant) => participant.status === "WAITLISTED").length,
    cancelled: meeting.participants.filter((participant) => participant.status === "CANCELLED").length,
    all: meeting.participants.length,
  };

  return (
    <AdminLayout>
      <div className="mb-6 flex items-start gap-3">
        <Link href="/admin/meetings" className="brand-link mt-0.5 text-xl">&larr;</Link>
        <div className="flex-1">
          <h1 className="font-headline text-[1.7rem] font-extrabold tracking-[-0.03em] text-[var(--brand-text)]">{displayDate}</h1>
          <p className="brand-text-muted mt-0.5 text-sm">
            {meeting.startTime}–{meeting.endTime} · {meeting.location}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/admin/meetings/${meetingId}/settlement`}
            className="brand-button-primary shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors"
          >
            정산 관리
          </Link>
          <button
            onClick={handleToggleOpen}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
              meeting.isOpen
                ? "brand-button-secondary"
                : "bg-green-100 text-green-700 hover:bg-green-200"
            }`}
          >
            {meeting.isOpen ? "신청 마감하기" : "신청 열기"}
          </button>
          <button
            onClick={handleDelete}
            className="shrink-0 rounded-full border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-100"
          >
            삭제
          </button>
        </div>
      </div>

      <div className="mb-5 flex items-center gap-2">
        <span className="brand-chip-soft rounded-full px-2 py-0.5 text-xs font-semibold">
          {meeting.meetingType}
        </span>
        <span className="brand-text-muted text-sm">참가자 {meeting.approvedCount}명</span>
        {reloading ? <span className="brand-text-subtle text-xs">갱신 중...</span> : null}
      </div>

      <div className="brand-tab-bar mb-5 flex items-end gap-3 overflow-x-auto">
        {(["approved", "waitlisted", "cancelled", "all"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`border-b-2 px-1 pb-3 text-sm font-extrabold whitespace-nowrap transition-colors ${
              activeTab === tab
                ? "brand-tab-underline-active"
                : "brand-tab-underline-inactive hover:text-[var(--brand-text)]"
            }`}
          >
            <span className="inline-flex items-center gap-1.5">
              <span>{TAB_LABELS[tab]}</span>
              {counts[tab] > 0 ? (
                <span className={`${activeTab === tab ? "brand-chip-dark" : "brand-chip-soft"} rounded-full px-1.5 py-0.5 text-[10px] font-bold`}>
                  {counts[tab]}
                </span>
              ) : null}
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {filteredParticipants.length === 0 ? (
          <p className="brand-text-subtle py-10 text-center text-sm">해당 상태의 신청자가 없습니다</p>
        ) : (
          sortWithCompanions(filteredParticipants).map((participant) => {
            const isCompanion = participant.companionId !== null;
            return (
              <div
                key={participant.id}
                className={`brand-card-soft rounded-xl p-4 ${isCompanion ? "ml-6 border-l-2 border-l-[var(--brand-primary-border-strong)]" : ""}`}
              >
                <div className="mb-2 flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-[var(--brand-text)]">{participant.name}</span>
                      {isCompanion ? (
                        <span className="brand-chip-companion rounded px-1.5 py-0.5 text-[10px] font-bold">동반</span>
                      ) : null}
                      <StatusBadge status={participant.status as ParticipantStatus} waitlistPosition={participant.waitlistPosition} size="sm" />
                      {participant.isPenalized ? (
                        <span className="rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-bold text-red-600">패널티</span>
                      ) : null}
                      {participant.hasBus ? (
                        <span className="brand-chip-soft rounded px-1.5 py-0.5 text-[10px] font-bold">셔틀 버스</span>
                      ) : null}
                      {participant.hasLesson ? (
                        <span className="brand-chip-strong rounded px-1.5 py-0.5 text-[10px] font-bold">강습+장비대여</span>
                      ) : null}
                      {participant.hasRental ? (
                        <span className="brand-chip-dark rounded px-1.5 py-0.5 text-[10px] font-bold">장비 대여만</span>
                      ) : null}
                    </div>
                    <KakaoBadge nickname={participant.kakaoNickname} />
                    {participant.note ? (
                      <p className="brand-panel mt-1 rounded px-2 py-1 text-xs brand-text-muted">{participant.note}</p>
                    ) : null}
                    <p className="brand-text-subtle mt-1 text-xs">
                      {new Date(participant.submittedAt).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      {participant.cancelledAt ? (
                        <span className="ml-2 text-red-400">
                          취소: {new Date(participant.cancelledAt).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </span>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1.5">
                    {participant.status !== "APPROVED" && participant.status !== "CANCELLED" ? (
                      <button
                        onClick={() => handleAction(participant.id, "approve")}
                        className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-green-700"
                      >
                        확정
                      </button>
                    ) : null}
                    {participant.status !== "CANCELLED" ? (
                      <button
                        onClick={() => handleAction(participant.id, "cancel")}
                        className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition-colors hover:bg-red-50"
                      >
                        취소
                      </button>
                    ) : null}
                    {participant.status === "CANCELLED" ? (
                      <button
                        onClick={() => handleAction(participant.id, "approve")}
                        className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-green-700"
                      >
                        복구
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => removeToast(toast.id)} />
      ))}
    </AdminLayout>
  );
}
