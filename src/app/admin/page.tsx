import Link from "next/link";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Icon } from "@/components/ui/Icon";
import { getAdminMeetings, type AdminMeetingListItem } from "@/lib/admin-page-data";
import { prisma } from "@/lib/db";
import { DAY_KO } from "@/lib/format";
import type { MeetingWorkflowStage } from "@/lib/meeting-lifecycle";
import { requireAdminPage } from "@/lib/require-admin-page";

export const dynamic = "force-dynamic";

// 돈이 걸린 단계부터 먼저 보여준다. 모집·예정 모임은 날짜순으로 그 뒤에 둔다.
const STAGE_PRIORITY: Record<MeetingWorkflowStage, number> = {
  PAYMENT_CONFIRMATION: 0,
  FINAL_SETTLEMENT: 1,
  BILLING_REVIEW: 2,
  ACTUALS_REVIEW: 3,
  UPCOMING: 4,
  RECRUITING: 4,
  COMPLETED: 9,
};

const BEFORE_MEETING: readonly MeetingWorkflowStage[] = ["RECRUITING", "UPCOMING"];

// 모임 화면에 없는 기능만 모았다. 모임·회원·정산·설정은 아래 메뉴바에 있다.
const SHORTCUTS = [
  { href: "/admin/deposits", icon: "account_balance", label: "입금 대조" },
  { href: "/admin/notices", icon: "campaign", label: "공지" },
  { href: "/admin/pricing", icon: "payments", label: "요금·지원" },
  { href: "/admin/menus", icon: "restaurant_menu", label: "식음료 메뉴" },
] as const;

function shortDate(date: string) {
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}(${DAY_KO[new Date(`${date}T12:00:00`).getDay()]})`;
}

function meetingDateLabel(meeting: AdminMeetingListItem) {
  const lastDay = meeting.overnightGroup?.days.at(-1);
  return lastDay ? `${shortDate(meeting.date)}–${shortDate(lastDay.date)}` : shortDate(meeting.date);
}

function meetingHref(meeting: AdminMeetingListItem) {
  return BEFORE_MEETING.includes(meeting.workflowStage)
    ? `/admin/meetings/${meeting.id}`
    : `/admin/meetings/${meeting.id}/settlement`;
}

function meetingFacts(meeting: AdminMeetingListItem) {
  if (BEFORE_MEETING.includes(meeting.workflowStage)) {
    return `확정 ${meeting.approvedCount}명 · 강습 ${meeting.lessonCount}명 · ${meeting.isOpen ? "신청 중" : "신청 마감"}`;
  }
  if (meeting.workflowStage === "PAYMENT_CONFIRMATION") {
    return `입금 ${meeting.verifiedRecipientCount}/${meeting.recipientCount}명 확인`;
  }
  return `참가 ${meeting.approvedCount}명`;
}

export default async function AdminDashboardPage() {
  await requireAdminPage();
  const [meetings, depositsToReview] = await Promise.all([
    getAdminMeetings(),
    prisma.bankDeposit.count({ where: { status: { in: ["UNMATCHED", "REVIEW"] }, amount: { not: null } } }),
  ]);
  const active = meetings
    .filter((meeting) => meeting.workflowStage !== "COMPLETED")
    .sort((left, right) => (
      STAGE_PRIORITY[left.workflowStage] - STAGE_PRIORITY[right.workflowStage]
      || left.date.localeCompare(right.date)
    ));
  const afterMeeting = active.filter((meeting) => !BEFORE_MEETING.includes(meeting.workflowStage));
  const beforeMeeting = active.filter((meeting) => BEFORE_MEETING.includes(meeting.workflowStage));

  return (
    <AdminLayout>
      <div className="space-y-6">
        <header>
          <p className="brand-text-subtle text-xs font-bold">ADMIN HOME</p>
          <h1 className="mt-1 font-headline text-[1.7rem] font-extrabold tracking-[-0.03em] text-brand-text">오늘의 운영</h1>
        </header>

        {depositsToReview > 0 ? (
          <Link className="brand-highlight-panel flex min-h-14 items-center justify-between gap-3 rounded-2xl px-4 py-3" href="/admin/deposits">
            <span>
              <span className="block text-sm font-extrabold text-brand-text">확인이 필요한 입금 {depositsToReview}건</span>
              <span className="brand-text-muted block text-xs">자동으로 맞추지 못한 입금이 있습니다.</span>
            </span>
            <Icon className="text-[20px] text-brand-primary" name="arrow_forward" />
          </Link>
        ) : null}

        <MeetingSection
          emptyText="정산할 모임이 없습니다."
          meetings={afterMeeting}
          title="정산할 모임"
        />
        <MeetingSection
          emptyText="예정된 모임이 없습니다."
          meetings={beforeMeeting}
          title="다가오는 모임"
        />

        <nav aria-label="바로가기" className="grid grid-cols-4 gap-2">
          {SHORTCUTS.map((item) => (
            <Link className="brand-panel-white flex min-h-20 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-center" href={item.href} key={item.href}>
              <Icon className="text-brand-primary" name={item.icon} />
              <span className="text-[11px] font-bold text-brand-text">{item.label}</span>
            </Link>
          ))}
        </nav>
      </div>
    </AdminLayout>
  );
}

function MeetingSection({
  title,
  meetings,
  emptyText,
}: {
  readonly title: string;
  readonly meetings: readonly AdminMeetingListItem[];
  readonly emptyText: string;
}) {
  return (
    <section className="space-y-2">
      <h2 className="px-1 text-base font-extrabold text-brand-text">{title}</h2>
      {meetings.length === 0 ? (
        <p className="brand-panel-white brand-text-muted rounded-2xl px-4 py-5 text-center text-sm">{emptyText}</p>
      ) : meetings.map((meeting) => (
        <Link className="brand-list-item brand-list-item-hover block rounded-2xl px-4 py-3" href={meetingHref(meeting)} key={meeting.id}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-base font-extrabold text-brand-text">{meetingDateLabel(meeting)}</p>
              <p className="brand-text-muted mt-0.5 truncate text-xs">{meeting.location} · {meetingFacts(meeting)}</p>
            </div>
            <span className="brand-chip-soft shrink-0 rounded-full px-2.5 py-1 text-xs font-bold">{meeting.workflowLabel}</span>
          </div>
          <p className="mt-2 flex min-h-8 items-center justify-between border-t border-brand-divider pt-2 text-sm font-extrabold text-brand-primary">
            {meeting.nextAction}
            <Icon className="text-[18px]" name="arrow_forward" />
          </p>
        </Link>
      ))}
    </section>
  );
}
