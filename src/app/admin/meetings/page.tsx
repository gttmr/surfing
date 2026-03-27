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
        className="block bg-white rounded-xl border border-slate-200 p-4 hover:border-blue-300 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold text-slate-800 text-sm">
              {parseInt(month)}월 {parseInt(day)}일 ({DAY_KO[d.getDay()]})
            </p>
            <p className="text-xs text-slate-500 mt-0.5">
              {m.startTime}–{m.endTime} · {m.location}
            </p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
              m.meetingType === "비정기" ? "bg-orange-100 text-orange-600" : "bg-blue-100 text-blue-600"
            }`}>
              {m.meetingType}
            </span>
            {!m.isOpen && <span className="text-xs bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">마감</span>}
            {m.createdByKakaoId && <span className="text-xs bg-purple-100 text-purple-600 px-1.5 py-0.5 rounded-full">회원등록</span>}
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-2">참가자 {m.approvedCount}명</p>
      </Link>
    );
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-extrabold text-slate-900">모임 관리</h1>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition-colors"
        >
          {showCreate ? "닫기" : "+ 새 모임"}
        </button>
      </div>

      {/* 새 모임 생성 폼 */}
      {showCreate && (
        <form onSubmit={handleCreate} className="bg-white rounded-xl border border-slate-200 p-5 mb-6 space-y-4">
          <h3 className="text-sm font-bold text-slate-700">새 모임 만들기</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">날짜</label>
              <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} required
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">모임 유형</label>
              <select value={newMeetingType} onChange={(e) => setNewMeetingType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-500">
                <option value="정기">정기</option>
                <option value="비정기">비정기</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">시작 시간</label>
              <input type="time" value={newStartTime} onChange={(e) => setNewStartTime(e.target.value)} required
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 mb-1">종료 시간</label>
              <input type="time" value={newEndTime} onChange={(e) => setNewEndTime(e.target.value)} required
                className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">장소</label>
            <input type="text" value={newLocation} onChange={(e) => setNewLocation(e.target.value)} required placeholder="모임 장소"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-500" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 mb-1">설명 (선택)</label>
            <textarea value={newDescription} onChange={(e) => setNewDescription(e.target.value)} placeholder="모임 설명"
              className="w-full px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-500 resize-none" rows={2} />
          </div>
          <button type="submit" disabled={creating}
            className="w-full py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-bold transition-colors">
            {creating ? "생성 중..." : "모임 생성"}
          </button>
        </form>
      )}

      {loading ? (
        <div className="text-center py-16 text-slate-400 text-sm">불러오는 중...</div>
      ) : (
        <>
          <section className="mb-8">
            <h2 className="text-sm font-bold text-slate-700 mb-3">예정된 모임 ({upcoming.length})</h2>
            <div className="space-y-3">
              {upcoming.map((m) => <MeetingRow key={m.id} m={m} />)}
              {upcoming.length === 0 && <p className="text-sm text-slate-400 text-center py-6">예정된 모임이 없습니다</p>}
            </div>
          </section>

          {past.length > 0 && (
            <section>
              <h2 className="text-sm font-bold text-slate-700 mb-3">지난 모임 ({past.length})</h2>
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
