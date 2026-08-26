import Link from "next/link";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Icon } from "@/components/ui/Icon";
import { getAdminMeetings, type AdminMeetingListItem } from "@/lib/admin-page-data";
import { requireAdminPage } from "@/lib/require-admin-page";

export const dynamic = "force-dynamic";

function BillingMeetingRow({ meeting }: { readonly meeting: AdminMeetingListItem }) {
  return (
    <Link className="brand-list-item brand-list-item-hover block rounded-2xl px-4 py-4" href={`/admin/meetings/${meeting.id}/settlement`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-brand-text">{meeting.date} · {meeting.location}</p>
          <p className="brand-text-subtle mt-1 text-xs">{meeting.startTime}–{meeting.endTime} · 확정 {meeting.approvedCount}명</p>
        </div>
        <span className="brand-chip-soft shrink-0 rounded-full px-2.5 py-1 text-xs font-bold">{meeting.workflowLabel}</span>
      </div>
      <div className="mt-3 flex min-h-11 items-center justify-between border-t border-brand-divider pt-3">
        <span className="brand-text-muted text-xs font-semibold">다음 할 일</span>
        <span className="inline-flex items-center gap-1 text-sm font-extrabold text-brand-primary">{meeting.nextAction}<Icon className="text-[18px]" name="arrow_forward" /></span>
      </div>
    </Link>
  );
}

export default async function AdminSettlementsPage() {
  await requireAdminPage();
  const meetings = await getAdminMeetings();
  const inScope = meetings.filter((meeting) => !["RECRUITING", "UPCOMING"].includes(meeting.workflowStage));
  const active = inScope.filter((meeting) => meeting.workflowStage !== "COMPLETED");
  const completed = inScope.filter((meeting) => meeting.workflowStage === "COMPLETED");

  return (
    <AdminLayout>
      <div className="space-y-6">
        <header>
          <p className="brand-text-subtle text-xs font-bold">BILLING &amp; CLOSE</p>
          <h1 className="mt-1 font-headline text-[1.7rem] font-extrabold tracking-[-0.03em] text-brand-text">청구·최종 정산</h1>
          <p className="brand-text-muted mt-1 break-keep text-sm">회원 청구 확인과 샵·식음료 실제 지급 마감을 단계별로 처리합니다.</p>
        </header>

        <section className="space-y-3">
          <div className="flex items-center justify-between px-1"><h2 className="text-base font-extrabold text-brand-text">진행할 모임</h2><span className="brand-text-subtle text-xs">{active.length}건</span></div>
          {active.length > 0 ? active.map((meeting) => <BillingMeetingRow key={meeting.id} meeting={meeting} />) : (
            <div className="brand-panel-white rounded-2xl px-4 py-8 text-center" role="status"><Icon className="text-brand-success text-[30px]" name="task_alt" /><p className="mt-2 text-sm font-bold text-brand-text">지금 처리할 청구가 없습니다.</p></div>
          )}
        </section>

        {completed.length > 0 ? (
          <section className="space-y-3">
            <div className="flex items-center justify-between px-1"><h2 className="text-base font-extrabold text-brand-text">완료 보고서</h2><span className="brand-text-subtle text-xs">{completed.length}건</span></div>
            {completed.map((meeting) => <BillingMeetingRow key={meeting.id} meeting={meeting} />)}
          </section>
        ) : null}
      </div>
    </AdminLayout>
  );
}
