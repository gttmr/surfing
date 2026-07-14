import Link from "next/link";
import { AsyncState } from "@/components/ui/AsyncState";
import { Icon } from "@/components/ui/Icon";
import type { AdminMeetingListItem } from "@/lib/admin-page-data";
import { DAY_KO } from "@/lib/format";

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
  return (
    <Link className="brand-list-item brand-list-item-hover block rounded-2xl p-4 transition-colors" href={`/admin/meetings/${meeting.id}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-[var(--brand-text)]">{meetingDateLabel(meeting.date)}</p>
          <p className="brand-text-muted mt-1 break-keep text-xs">{meeting.startTime}–{meeting.endTime} · {meeting.location}</p>
        </div>
        <Icon className="mt-0.5 shrink-0 text-[20px]" name="chevron_right" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
        <span className="brand-chip-soft rounded-full px-2 py-1 font-semibold">{meeting.meetingType}</span>
        <span className={meeting.isOpen ? "brand-chip-success rounded-full px-2 py-1 font-semibold" : "brand-chip-dimmed rounded-full px-2 py-1 font-semibold"}>{meeting.isOpen ? "신청 중" : "신청 마감"}</span>
        {meeting.createdByKakaoId ? <span className="brand-chip-dark rounded-full px-2 py-1 font-semibold">회원 등록</span> : null}
        <span className="brand-text-subtle ml-auto">확정 {meeting.approvedCount}명</span>
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
    <div className="brand-list-scroll max-h-[52dvh] space-y-2 overflow-y-auto rounded-2xl p-3" role="list">
      {meetings.map((meeting) => <div key={meeting.id} role="listitem"><MeetingRow meeting={meeting} /></div>)}
    </div>
  );
}
