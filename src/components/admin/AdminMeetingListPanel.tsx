import Link from "next/link";
import { AsyncState } from "@/components/ui/AsyncState";
import { Icon } from "@/components/ui/Icon";
import type { AdminMeetingListItem } from "@/lib/admin-page-data";
import { DAY_KO } from "@/lib/format";
import { getOvernightMeetingSpan } from "@/lib/meeting-group";

export type MeetingListView = "upcoming" | "past";

type MeetingListPanelProps = {
  readonly meetings: readonly AdminMeetingListItem[];
  readonly query: string;
  readonly view: MeetingListView;
  readonly onCreate: () => void;
};

function meetingDateLabel(dateValue: string): string {
  const date = new Date(`${dateValue}T00:00:00`);
  const [, month, day] = dateValue.split("-");
  return `${Number(month)}월 ${Number(day)}일 (${DAY_KO[date.getDay()]})`;
}

function MeetingRow({ meeting }: { readonly meeting: AdminMeetingListItem }) {
  const dateLabel = meetingDateLabel(meeting.date);
  const overnightSpan = meeting.overnightGroup ? getOvernightMeetingSpan(meeting.overnightGroup) : null;
  const dateRangeLabel = overnightSpan ? `${dateLabel}–${meetingDateLabel(overnightSpan.endDate)}` : dateLabel;
  const scheduleLabel = overnightSpan
    ? `${overnightSpan.startTime} 시작 · ${overnightSpan.endTime} 종료 · ${overnightSpan.location}`
    : `${meeting.startTime}–${meeting.endTime} · ${meeting.location}`;

  return (
    <Link
      aria-label={`${dateRangeLabel} ${meeting.location} 모임 운영`}
      className="brand-list-item brand-list-item-hover block rounded-2xl px-4 py-4 transition-colors"
      href={`/admin/meetings/${meeting.id}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-brand-text">{dateRangeLabel}</p>
          <p className="brand-text-muted mt-1 break-keep text-xs">{scheduleLabel}</p>
        </div>
        <span className="brand-chip-soft inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-bold">{meeting.workflowLabel}</span>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="brand-chip-soft rounded-full px-2 py-1 font-semibold">{meeting.meetingType}</span>
        {meeting.overnightGroup ? <span className="brand-chip-dark rounded-full px-2 py-1 font-semibold">1박 2일</span> : null}
        <span className={meeting.isOpen ? "brand-chip-success rounded-full px-2 py-1 font-semibold" : "brand-chip-dimmed rounded-full px-2 py-1 font-semibold"}>{meeting.isOpen ? "신청 중" : "신청 마감"}</span>
        {meeting.createdByKakaoId ? <span className="brand-chip-dark rounded-full px-2 py-1 font-semibold">회원 등록</span> : null}
        <span className="brand-text-subtle ml-auto">확정 {meeting.approvedCount}명</span>
      </div>
      <div className="mt-3 flex min-h-11 items-center justify-between gap-3 border-t border-brand-divider pt-3">
        <span className="brand-text-muted text-xs font-semibold">다음 할 일</span>
        <span className="inline-flex items-center gap-1 text-sm font-extrabold text-brand-primary">
          {meeting.nextAction}
          <Icon className="text-[18px]" name="arrow_forward" />
        </span>
      </div>
    </Link>
  );
}

export function AdminMeetingListPanel({ meetings, query, view, onCreate }: MeetingListPanelProps) {
  if (meetings.length === 0) {
    if (query) {
      return <AsyncState kind="empty" title="검색 결과가 없습니다" description={`“${query}”와 일치하는 ${view === "upcoming" ? "예정" : "지난"} 모임이 없습니다.`} />;
    }
    return (
      <AsyncState
        actionLabel={view === "upcoming" ? "새 모임 만들기" : undefined}
        kind="empty"
        onAction={view === "upcoming" ? onCreate : undefined}
        title={view === "upcoming" ? "예정된 모임이 없습니다" : "지난 모임이 없습니다"}
        description={view === "upcoming" ? "새 일정을 만들면 이 목록에 바로 표시됩니다." : "종료된 일정은 이곳에 모아 표시됩니다."}
      />
    );
  }

  return (
    <div className="space-y-2" role="list">
      {meetings.map((meeting) => <div key={meeting.id} role="listitem"><MeetingRow meeting={meeting} /></div>)}
    </div>
  );
}
