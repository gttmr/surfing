"use client";

import { useState, useEffect, use } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Toast, useToast } from "@/components/ui/Toast";
import type { ParticipantStatus } from "@/lib/types";

const DAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

interface Participant {
  id: number;
  name: string;
  kakaoId: string;
  kakaoNickname: string;
  note: string | null;
  hasLesson: boolean;
  hasBus: boolean;
  hasRental: boolean;
  status: ParticipantStatus;
  waitlistPosition: number | null;
  isPenalized: boolean;
  cancelledAt: string | null;
  submittedAt: string;
  companionId: number | null;
}

interface Meeting {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  description: string | null;
  isOpen: boolean;
  meetingType: string;
  participants: Participant[];
  approvedCount: number;
}

type Tab = "approved" | "waitlisted" | "cancelled" | "all";

const TAB_LABELS: Record<Tab, string> = {
  approved: "참가 확정",
  waitlisted: "대기자",
  cancelled: "취소됨",
  all: "전체",
};

// 정회원 아래에 동반인을 그룹핑하여 정렬
function sortWithCompanions(participants: Participant[]): Participant[] {
  const regulars = participants.filter((p) => p.companionId === null);
  const companions = participants.filter((p) => p.companionId !== null);

  const result: Participant[] = [];
  for (const reg of regulars) {
    result.push(reg);
    const myCompanions = companions.filter((c) => c.kakaoId === reg.kakaoId);
    result.push(...myCompanions);
  }
  const placed = new Set(result.map((p) => p.id));
  for (const c of companions) {
    if (!placed.has(c.id)) result.push(c);
  }
  return result;
}

function KakaoBadge({ nickname }: { nickname: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-xs bg-[#FEE500]/30 text-[#3C1E1E] px-1.5 py-0.5 rounded-full">
      <svg viewBox="0 0 24 24" className="w-3 h-3" fill="currentColor">
        <path d="M12 3C6.477 3 2 6.477 2 10.857c0 2.713 1.584 5.1 3.988 6.577L5 21l4.29-2.287C10.145 18.9 11.058 19 12 19c5.523 0 10-3.477 10-7.143C22 6.477 17.523 3 12 3z" />
      </svg>
      {nickname}
    </span>
  );
}

export default function AdminMeetingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("approved");
  const [loading, setLoading] = useState(true);
  const { toasts, addToast, removeToast } = useToast();
  const router = useRouter();

  async function handleDelete() {
    if (!confirm("이 일정을 삭제하시겠습니까?")) return;

    const res = await fetch(`/api/meetings/${meeting?.id}`, { method: "DELETE" });

    if (res.ok) {
      addToast("삭제되었습니다", "success");
      setTimeout(() => router.push("/admin/meetings"), 500);
    } else {
      addToast("삭제에 실패했습니다", "error");
    }
  }

  async function load() {
    const res = await fetch(`/api/meetings/${id}`);
    const data = await res.json();
    setMeeting(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, [id]);

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
      load();
    } else {
      addToast("오류가 발생했습니다", "error");
    }
  }

  async function handleToggleOpen() {
    await fetch(`/api/meetings/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isOpen: !meeting?.isOpen }),
    });
    load();
  }

  if (loading || !meeting) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center py-16 text-slate-400">불러오는 중...</div>
      </AdminLayout>
    );
  }

  const d = new Date(meeting.date + "T00:00:00");
  const [, month, day] = meeting.date.split("-");
  const displayDate = `${parseInt(month)}월 ${parseInt(day)}일 (${DAY_KO[d.getDay()]})`;

  const filteredParticipants = meeting.participants.filter((p) => {
    if (activeTab === "all") return true;
    return p.status.toLowerCase() === activeTab;
  });

  const counts: Record<Tab, number> = {
    approved: meeting.participants.filter((p) => p.status === "APPROVED").length,
    waitlisted: meeting.participants.filter((p) => p.status === "WAITLISTED").length,
    cancelled: meeting.participants.filter((p) => p.status === "CANCELLED").length,
    all: meeting.participants.length,
  };

  return (
    <AdminLayout>
      {/* 상단 정보 */}
      <div className="flex items-start gap-3 mb-4">
        <Link href="/admin/meetings" className="text-slate-400 hover:text-slate-600 text-xl mt-0.5">&larr;</Link>
        <div className="flex-1">
          <h1 className="text-xl font-extrabold text-slate-900">{displayDate}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {meeting.startTime}–{meeting.endTime} · {meeting.location}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleToggleOpen}
            className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors
              ${meeting.isOpen
                ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                : "bg-green-100 text-green-700 hover:bg-green-200"
              }`}
          >
            {meeting.isOpen ? "신청 마감하기" : "신청 열기"}
          </button>
          <button
            onClick={handleDelete}
            className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-600 hover:bg-red-100 transition-colors border border-red-100"
          >
            삭제
          </button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-2">
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
          meeting.meetingType === "비정기" ? "bg-orange-100 text-orange-600" : "bg-blue-100 text-blue-600"
        }`}>
          {meeting.meetingType}
        </span>
        <span className="text-sm text-slate-500">참가자 {meeting.approvedCount}명</span>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-4 overflow-x-auto">
        {(["approved", "waitlisted", "cancelled", "all"] as Tab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors
              ${activeTab === tab ? "bg-white shadow-sm text-slate-900" : "text-slate-500 hover:text-slate-700"}`}
          >
            {TAB_LABELS[tab]} {counts[tab] > 0 && `(${counts[tab]})`}
          </button>
        ))}
      </div>

      {/* 신청자 목록 */}
      <div className="space-y-3">
        {filteredParticipants.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-10">해당 상태의 신청자가 없습니다</p>
        ) : (
          sortWithCompanions(filteredParticipants).map((p) => {
            const isCompanion = p.companionId !== null;
            return (
            <div key={p.id} className={`bg-white rounded-xl border border-slate-200 p-4 ${isCompanion ? "ml-6 border-l-2 border-l-orange-300" : ""}`}>
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-slate-900">{p.name}</span>
                    {isCompanion && (
                      <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-bold">동반</span>
                    )}
                    <StatusBadge status={p.status} waitlistPosition={p.waitlistPosition} size="sm" />
                    {p.isPenalized && (
                      <span className="text-[10px] bg-red-100 text-red-600 px-1.5 py-0.5 rounded font-bold">패널티</span>
                    )}
                    {p.hasLesson && (
                      <span className="text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded font-bold">강습+장비대여</span>
                    )}
                    {p.hasBus && (
                      <span className="text-[10px] bg-emerald-100 text-emerald-600 px-1.5 py-0.5 rounded font-bold">셔틀 버스</span>
                    )}
                    {p.hasRental && (
                      <span className="text-[10px] bg-sky-100 text-sky-700 px-1.5 py-0.5 rounded font-bold">장비 대여만</span>
                    )}
                  </div>
                  <KakaoBadge nickname={p.kakaoNickname} />
                  {p.note && (
                    <p className="text-xs text-slate-500 mt-1 bg-slate-50 rounded px-2 py-1">{p.note}</p>
                  )}
                  <p className="text-xs text-slate-400 mt-1">
                    {new Date(p.submittedAt).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    {p.cancelledAt && (
                      <span className="text-red-400 ml-2">
                        취소: {new Date(p.cancelledAt).toLocaleString("ko-KR", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    )}
                  </p>
                </div>
                {/* 액션 버튼 */}
                <div className="flex flex-col gap-1.5 shrink-0">
                  {p.status !== "APPROVED" && p.status !== "CANCELLED" && (
                    <button
                      onClick={() => handleAction(p.id, "approve")}
                      className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition-colors"
                    >
                      확정
                    </button>
                  )}
                  {p.status !== "CANCELLED" && (
                    <button
                      onClick={() => handleAction(p.id, "cancel")}
                      className="px-3 py-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50 text-xs font-semibold transition-colors"
                    >
                      취소
                    </button>
                  )}
                  {p.status === "CANCELLED" && (
                    <button
                      onClick={() => handleAction(p.id, "approve")}
                      className="px-3 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-xs font-semibold transition-colors"
                    >
                      복구
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
          })
        )}
      </div>

      {/* 토스트 */}
      {toasts.map((t) => (
        <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
      ))}
    </AdminLayout>
  );
}
