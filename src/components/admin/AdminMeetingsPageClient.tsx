"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminMeetingCreateForm } from "@/components/admin/AdminMeetingCreateForm";
import { AdminMeetingListPanel, type MeetingListView } from "@/components/admin/AdminMeetingListPanel";
import { Icon } from "@/components/ui/Icon";
import { Toast, useToast } from "@/components/ui/Toast";
import type { AdminMeetingListItem } from "@/lib/admin-page-data";
import { getTodayInSeoul } from "@/lib/date";

type AdminMeetingsPageClientProps = {
  readonly initialMeetings: readonly AdminMeetingListItem[];
  readonly initialShowCreate?: boolean;
  readonly initialCreateDate?: string;
  readonly initialCreateType?: string;
};

export function AdminMeetingsPageClient({
  initialMeetings,
  initialShowCreate = false,
  initialCreateDate = "",
  initialCreateType = "정기",
}: AdminMeetingsPageClientProps) {
  const [meetings, setMeetings] = useState<AdminMeetingListItem[]>([...initialMeetings]);
  const [creating, setCreating] = useState(initialShowCreate);
  const [view, setView] = useState<MeetingListView>("upcoming");
  const [query, setQuery] = useState("");
  const { toasts, addToast, removeToast } = useToast();
  const router = useRouter();

  const today = getTodayInSeoul();
  const upcomingMeetings = useMemo(
    () => meetings.filter((meeting) => meeting.date >= today).sort((left, right) => left.date.localeCompare(right.date)),
    [meetings, today]
  );
  const pastMeetings = useMemo(
    () => meetings.filter((meeting) => meeting.date < today).sort((left, right) => right.date.localeCompare(left.date)),
    [meetings, today]
  );
  const normalizedQuery = query.trim().toLocaleLowerCase("ko-KR");
  const visibleMeetings = (view === "upcoming" ? upcomingMeetings : pastMeetings).filter((meeting) => {
    if (!normalizedQuery) return true;
    return [meeting.date, meeting.location, meeting.meetingType]
      .some((value) => value.toLocaleLowerCase("ko-KR").includes(normalizedQuery));
  });

  function handleCreated(meeting: AdminMeetingListItem) {
    setMeetings((current) => [...current, meeting]);
    setView(meeting.date >= today ? "upcoming" : "past");
    setQuery("");
    setCreating(false);
    addToast("모임을 생성했습니다", "success");
    router.push(`/admin/meetings/${meeting.id}`);
  }

  return (
    <AdminLayout>
      <div className="space-y-4">
        <header>
          <p className="brand-text-subtle text-xs font-semibold tracking-[0.12em]">ADMIN WORKSPACE</p>
          <div className="mt-1 flex items-start justify-between gap-3">
            <div>
              <h1 className="font-headline text-[1.7rem] font-extrabold tracking-[-0.03em] text-brand-text">모임 관리</h1>
              <p className="brand-text-muted mt-1 break-keep text-sm">일정과 참가 상태를 필요한 화면에서만 관리합니다.</p>
            </div>
            {!creating ? (
              <button className="brand-button-primary flex shrink-0 items-center gap-1 rounded-full px-4 py-2.5 text-sm font-bold" onClick={() => setCreating(true)} type="button">
                <Icon className="text-[18px]" name="add" />
                새 모임
              </button>
            ) : null}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
            <span className="brand-admin-stat rounded-full px-3 py-1.5">전체 {meetings.length}</span>
            <span className="brand-admin-stat rounded-full px-3 py-1.5">예정 {upcomingMeetings.length}</span>
            <span className="brand-admin-stat rounded-full px-3 py-1.5">지난 모임 {pastMeetings.length}</span>
          </div>
        </header>

        {creating ? (
          <AdminMeetingCreateForm initialDate={initialCreateDate} initialType={initialCreateType} onCancel={() => setCreating(false)} onCreated={handleCreated} />
        ) : (
          <section className="brand-admin-section overflow-hidden">
            <div className="brand-admin-section-header space-y-3 px-4 py-4">
              <div className="grid grid-cols-2 gap-1 rounded-2xl bg-brand-surface p-1" aria-label="모임 시기" role="group">
                <button aria-pressed={view === "upcoming"} className={`rounded-xl px-3 py-2.5 text-sm font-bold ${view === "upcoming" ? "brand-filter-tab-active" : "brand-text-subtle"}`} onClick={() => setView("upcoming")} type="button">예정 {upcomingMeetings.length}</button>
                <button aria-pressed={view === "past"} className={`rounded-xl px-3 py-2.5 text-sm font-bold ${view === "past" ? "brand-filter-tab-active" : "brand-text-subtle"}`} onClick={() => setView("past")} type="button">지난 모임 {pastMeetings.length}</button>
              </div>
              <label className="relative block">
                <span className="sr-only">모임 검색</span>
                <Icon className="brand-text-subtle pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[20px]" name="search" />
                <input aria-label="모임 검색" className="brand-input w-full rounded-xl py-2.5 pl-10 pr-10 text-sm" onChange={(event) => setQuery(event.target.value)} placeholder="날짜, 장소, 모임 유형 검색" type="search" value={query} />
                {query ? <button aria-label="모임 검색 지우기" className="brand-text-subtle absolute right-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full" onClick={() => setQuery("")} type="button"><Icon className="text-[18px]" name="close" /></button> : null}
              </label>
            </div>
            <div className="px-4 py-4">
              <AdminMeetingListPanel meetings={visibleMeetings} onCreate={() => setCreating(true)} query={query.trim()} view={view} />
            </div>
          </section>
        )}
      </div>

      {toasts.map((toast) => <Toast key={toast.id} message={toast.message} onClose={() => removeToast(toast.id)} type={toast.type} />)}
    </AdminLayout>
  );
}
