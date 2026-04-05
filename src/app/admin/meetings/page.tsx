"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Toast, useToast } from "@/components/ui/Toast";

const DAY_KO = ["일", "월", "화", "수", "목", "금", "토"];

interface MeetingItem {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  meetingType: string;
  isOpen: boolean;
  approvedCount: number;
  createdByKakaoId: string | null;
}

export default function AdminMeetingsPage() {
  const [meetings, setMeetings] = useState<MeetingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  // 새 모임 폼
  const [newDate, setNewDate] = useState("");
  const [newStartTime, setNewStartTime] = useState("");
  const [newEndTime, setNewEndTime] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newMeetingType, setNewMeetingType] = useState("정기");
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);

  async function load() {
    const res = await fetch("/api/meetings");
    const data = await res.json();
    setMeetings(data);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newDate || !newStartTime || !newEndTime || !newLocation) return;
    setCreating(true);

    const res = await fetch("/api/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: newDate,
        startTime: newStartTime,
        endTime: newEndTime,
        location: newLocation,
        meetingType: newMeetingType,
        description: newDescription || null,
      }),
    });

    if (res.ok) {
      addToast("모임이 생성되었습니다", "success");
      setShowCreate(false);
      setNewDate(""); setNewStartTime(""); setNewEndTime(""); setNewLocation(""); setNewMeetingType("정기"); setNewDescription("");
      load();
    } else {
      addToast("모임 생성에 실패했습니다", "error");
    }
    setCreating(false);
  }

  const today = new Date().toISOString().split("T")[0];
  const upcoming = meetings.filter((m) => m.date >= today);
  const past = meetings.filter((m) => m.date < today);

  function MeetingRow({ m }: { m: MeetingItem }) {
    const d = new Date(m.date + "T00:00:00");
    const [, month, day] = m.date.split("-");

    return (
      <Link
        href={`/admin/meetings/${m.id}`}
        className="brand-card-soft brand-list-item-hover block rounded-2xl p-4 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--brand-text)]">
              {parseInt(month)}월 {parseInt(day)}일 ({DAY_KO[d.getDay()]})
            </p>
            <p className="brand-text-muted mt-0.5 text-xs">
              {m.startTime}–{m.endTime} · {m.location}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="brand-chip-soft rounded-full px-1.5 py-0.5 text-xs font-semibold">
              {m.meetingType}
            </span>
            {!m.isOpen && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">마감</span>}
            {m.createdByKakaoId && <span className="brand-chip-dark rounded-full px-1.5 py-0.5 text-xs">회원등록</span>}
          </div>
        </div>
        <p className="brand-text-subtle mt-2 text-xs">참가자 {m.approvedCount}명</p>
      </Link>
    );
  }

  return (
    <AdminLayout>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="font-headline text-[1.7rem] font-extrabold tracking-[-0.03em] text-[var(--brand-text)]">모임 관리</h1>
          <p className="brand-text-muted mt-1 text-sm">일정을 만들고 신청 상태를 관리합니다.</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className={`rounded-full px-4 py-2 text-sm font-bold transition-colors ${showCreate ? "brand-button-secondary" : "brand-button-primary"}`}
        >
          {showCreate ? "닫기" : "+ 새 모임"}
        </button>
      </div>

      {/* 새 모임 생성 폼 */}
      {showCreate && (
        <form onSubmit={handleCreate} className="brand-card-soft mb-6 space-y-4 rounded-3xl p-5">
          <h3 className="text-sm font-extrabold text-[var(--brand-text)]">새 모임 만들기</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="brand-text-muted mb-1 block text-xs font-semibold">날짜</label>
              <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} required
                className="brand-input w-full rounded-xl px-3 py-2 text-sm outline-none" />
            </div>
            <div>
              <label className="brand-text-muted mb-1 block text-xs font-semibold">모임 유형</label>
              <select value={newMeetingType} onChange={(e) => setNewMeetingType(e.target.value)}
                className="brand-input w-full rounded-xl px-3 py-2 text-sm outline-none">
                <option value="정기">정기</option>
                <option value="비정기">비정기</option>
              </select>
            </div>
            <div>
              <label className="brand-text-muted mb-1 block text-xs font-semibold">시작 시간</label>
              <input type="time" value={newStartTime} onChange={(e) => setNewStartTime(e.target.value)} required
                className="brand-input w-full rounded-xl px-3 py-2 text-sm outline-none" />
            </div>
            <div>
              <label className="brand-text-muted mb-1 block text-xs font-semibold">종료 시간</label>
              <input type="time" value={newEndTime} onChange={(e) => setNewEndTime(e.target.value)} required
                className="brand-input w-full rounded-xl px-3 py-2 text-sm outline-none" />
            </div>
          </div>
          <div>
            <label className="brand-text-muted mb-1 block text-xs font-semibold">장소</label>
            <input type="text" value={newLocation} onChange={(e) => setNewLocation(e.target.value)} required placeholder="모임 장소"
              className="brand-input w-full rounded-xl px-3 py-2 text-sm outline-none" />
          </div>
          <div>
            <label className="brand-text-muted mb-1 block text-xs font-semibold">설명 (선택)</label>
            <textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="모임 설명"
              className="brand-input w-full resize-none rounded-xl px-3 py-2 text-sm outline-none" rows={2} />
          </div>
          <button type="submit" disabled={creating}
            className="brand-button-primary w-full rounded-2xl py-2.5 text-sm font-bold transition-colors">
            {creating ? "생성 중..." : "모임 생성"}
          </button>
        </form>
      )}

      {loading ? (
        <div className="brand-text-subtle py-16 text-center text-sm">불러오는 중...</div>
      ) : (
        <>
          <section className="mb-8">
            <h2 className="mb-3 text-sm font-extrabold text-[var(--brand-text)]">예정된 모임 ({upcoming.length})</h2>
            <div className="space-y-3">
              {upcoming.map((m) => <MeetingRow key={m.id} m={m} />)}
              {upcoming.length === 0 && <p className="brand-text-subtle py-6 text-center text-sm">예정된 모임이 없습니다</p>}
            </div>
          </section>

          {past.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-extrabold text-[var(--brand-text)]">지난 모임 ({past.length})</h2>
              <div className="space-y-3 opacity-70">
                {past.map((m) => <MeetingRow key={m.id} m={m} />)}
              </div>
            </section>
          )}
        </>
      )}

      {toasts.map((t) => (
        <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
      ))}
    </AdminLayout>
  );
}
