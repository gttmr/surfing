"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Toast, useToast } from "@/components/ui/Toast";
import { getTodayInSeoul } from "@/lib/date";
import type { AdminMeetingListItem } from "@/lib/admin-page-data";
import { DAY_KO } from "@/lib/format";

export function AdminMeetingsPageClient({
  initialMeetings,
  initialShowCreate = false,
  initialCreateDate = "",
  initialCreateType = "정기",
}: {
  initialMeetings: AdminMeetingListItem[];
  initialShowCreate?: boolean;
  initialCreateDate?: string;
  initialCreateType?: string;
}) {
  const [meetings, setMeetings] = useState(initialMeetings);
  const [showCreate, setShowCreate] = useState(initialShowCreate);
  const [newDate, setNewDate] = useState(initialCreateDate);
  const [newStartTime, setNewStartTime] = useState("");
  const [newEndTime, setNewEndTime] = useState("");
  const [newLocation, setNewLocation] = useState("");
  const [newMeetingType, setNewMeetingType] = useState(initialCreateType);
  const [newDescription, setNewDescription] = useState("");
  const [creating, setCreating] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  const { upcomingMeetings, pastMeetings } = useMemo(() => {
    const today = getTodayInSeoul();
    return {
      upcomingMeetings: meetings.filter((meeting) => meeting.date >= today),
      pastMeetings: meetings.filter((meeting) => meeting.date < today),
    };
  }, [meetings]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newDate || !newStartTime || !newEndTime || !newLocation) return;
    setCreating(true);

    try {
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

      if (!res.ok) {
        throw new Error("create_failed");
      }

      const meeting = await res.json();
      const createdMeeting: AdminMeetingListItem = {
        id: meeting.id,
        date: meeting.date,
        startTime: meeting.startTime,
        endTime: meeting.endTime,
        location: meeting.location,
        meetingType: meeting.meetingType,
        isOpen: meeting.isOpen,
        approvedCount: 0,
        createdByKakaoId: meeting.createdByKakaoId,
      };

      setMeetings((prev) =>
        [...prev, createdMeeting].sort((a, b) => a.date.localeCompare(b.date))
      );
      addToast("모임이 생성되었습니다", "success");
      setShowCreate(false);
      setNewDate("");
      setNewStartTime("");
      setNewEndTime("");
      setNewLocation("");
      setNewMeetingType(initialCreateType);
      setNewDescription("");
    } catch {
      addToast("모임 생성에 실패했습니다", "error");
    } finally {
      setCreating(false);
    }
  }

  function MeetingRow({ meeting }: { meeting: AdminMeetingListItem }) {
    const date = new Date(`${meeting.date}T00:00:00`);
    const [, month, day] = meeting.date.split("-");

    return (
      <Link
        href={`/admin/meetings/${meeting.id}`}
        className="brand-list-item brand-list-item-hover block rounded-2xl p-4 transition-colors"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--brand-text)]">
              {parseInt(month, 10)}월 {parseInt(day, 10)}일 ({DAY_KO[date.getDay()]})
            </p>
            <p className="brand-text-muted mt-0.5 text-xs">
              {meeting.startTime}–{meeting.endTime} · {meeting.location}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <span className="brand-chip-soft rounded-full px-1.5 py-0.5 text-xs font-semibold">
              {meeting.meetingType}
            </span>
            {!meeting.isOpen ? (
              <span className="brand-chip-dimmed rounded-full px-1.5 py-0.5 text-xs">마감</span>
            ) : null}
            {meeting.createdByKakaoId ? (
              <span className="brand-chip-dark rounded-full px-1.5 py-0.5 text-xs">회원등록</span>
            ) : null}
          </div>
        </div>
        <p className="brand-text-subtle mt-2 text-xs">참가자 {meeting.approvedCount}명</p>
      </Link>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <div className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="brand-text-subtle text-xs font-semibold uppercase tracking-[0.12em]">
                Admin Workspace
              </p>
              <h1 className="font-headline text-[1.7rem] font-extrabold tracking-[-0.03em] text-[var(--brand-text)]">
                모임 관리
              </h1>
              <p className="brand-text-muted mt-1 text-sm">
                일정 생성과 참가 상태 확인을 같은 흐름 안에서 처리합니다.
              </p>
            </div>
            <button
              onClick={() => setShowCreate((prev) => !prev)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                showCreate ? "brand-button-secondary" : "brand-button-primary"
              }`}
            >
              {showCreate ? "닫기" : "+ 새 모임"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2 text-xs font-semibold">
            <span className="brand-admin-stat rounded-full px-3 py-1.5">전체 {meetings.length}</span>
            <span className="brand-admin-stat rounded-full px-3 py-1.5">예정 {upcomingMeetings.length}</span>
            <span className="brand-admin-stat rounded-full px-3 py-1.5">지난 모임 {pastMeetings.length}</span>
          </div>
        </div>

        {showCreate ? (
          <section className="brand-admin-section overflow-hidden">
            <div className="brand-admin-section-header px-5 py-4">
              <h2 className="text-base font-bold text-[var(--brand-text)]">새 모임 만들기</h2>
              <p className="brand-text-subtle mt-1 text-xs">
                일정, 시간, 장소를 입력하면 바로 목록에 반영됩니다.
              </p>
            </div>
            <form onSubmit={handleCreate} className="space-y-4 px-5 py-5">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="brand-text-muted mb-1 block text-xs font-semibold">날짜</label>
                  <input
                    type="date"
                    value={newDate}
                    onChange={(e) => setNewDate(e.target.value)}
                    required
                    className="brand-input w-full rounded-xl px-3 py-2 text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="brand-text-muted mb-1 block text-xs font-semibold">모임 유형</label>
                  <select
                    value={newMeetingType}
                    onChange={(e) => setNewMeetingType(e.target.value)}
                    className="brand-input w-full rounded-xl px-3 py-2 text-sm outline-none"
                  >
                    <option value="정기">정기</option>
                    <option value="비정기">비정기</option>
                  </select>
                </div>
                <div>
                  <label className="brand-text-muted mb-1 block text-xs font-semibold">시작 시간</label>
                  <input
                    type="time"
                    value={newStartTime}
                    onChange={(e) => setNewStartTime(e.target.value)}
                    required
                    className="brand-input w-full rounded-xl px-3 py-2 text-sm outline-none"
                  />
                </div>
                <div>
                  <label className="brand-text-muted mb-1 block text-xs font-semibold">종료 시간</label>
                  <input
                    type="time"
                    value={newEndTime}
                    onChange={(e) => setNewEndTime(e.target.value)}
                    required
                    className="brand-input w-full rounded-xl px-3 py-2 text-sm outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="brand-text-muted mb-1 block text-xs font-semibold">장소</label>
                <input
                  type="text"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  required
                  placeholder="모임 장소"
                  className="brand-input w-full rounded-xl px-3 py-2 text-sm outline-none"
                />
              </div>
              <div>
                <label className="brand-text-muted mb-1 block text-xs font-semibold">설명 (선택)</label>
                <textarea
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="모임 설명"
                  className="brand-input w-full resize-none rounded-xl px-3 py-2 text-sm outline-none"
                  rows={2}
                />
              </div>
              <button
                type="submit"
                disabled={creating}
                className="brand-button-primary w-full rounded-2xl py-2.5 text-sm font-bold transition-colors"
              >
                {creating ? "생성 중..." : "모임 생성"}
              </button>
            </form>
          </section>
        ) : null}

        <section className="brand-admin-section overflow-hidden">
          <div className="brand-admin-section-header flex items-center justify-between gap-3 px-5 py-4">
            <div>
              <h2 className="text-base font-bold text-[var(--brand-text)]">예정된 모임</h2>
              <p className="brand-text-subtle mt-1 text-xs">
                가장 가까운 일정부터 확인하고 세부 관리 화면으로 이동합니다.
              </p>
            </div>
            <span className="brand-text-subtle text-xs">{upcomingMeetings.length}개</span>
          </div>
          {upcomingMeetings.length === 0 ? (
            <div className="brand-admin-empty px-4 py-10 text-sm">예정된 모임이 없습니다.</div>
          ) : (
            <div className="space-y-3 px-5 py-5">
              {upcomingMeetings.map((meeting) => (
                <MeetingRow key={meeting.id} meeting={meeting} />
              ))}
            </div>
          )}
        </section>

        {pastMeetings.length > 0 ? (
          <section className="brand-admin-section overflow-hidden">
            <div className="brand-admin-section-header flex items-center justify-between gap-3 px-5 py-4">
              <div>
                <h2 className="text-base font-bold text-[var(--brand-text)]">지난 모임</h2>
                <p className="brand-text-subtle mt-1 text-xs">지난 일정도 같은 구조에서 기록을 확인합니다.</p>
              </div>
              <span className="brand-text-subtle text-xs">{pastMeetings.length}개</span>
            </div>
            <div className="space-y-3 px-5 py-5 opacity-70">
              {pastMeetings.map((meeting) => (
                <MeetingRow key={meeting.id} meeting={meeting} />
              ))}
            </div>
          </section>
        ) : null}
      </div>

      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => removeToast(toast.id)} />
      ))}
    </AdminLayout>
  );
}
