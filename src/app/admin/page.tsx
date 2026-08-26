import Link from "next/link";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Icon } from "@/components/ui/Icon";
import { getAdminMeetings, getAdminMembers, getAdminNotices } from "@/lib/admin-page-data";
import { getTodayInSeoul } from "@/lib/date";
import { requireAdminPage } from "@/lib/require-admin-page";

export const dynamic = "force-dynamic";

const FUNCTION_MENU = [
  { href: "/admin/meetings", icon: "groups", label: "모임 관리", description: "일정·참가·참석" },
  { href: "/admin/members", icon: "person_search", label: "회원 관리", description: "회원 정보·권한" },
  { href: "/admin/settlements", icon: "account_balance_wallet", label: "청구·최종 정산", description: "입금·외부 지급" },
  { href: "/admin/notices", icon: "campaign", label: "공지 관리", description: "회원 공지 작성" },
  { href: "/admin/pricing", icon: "payments", label: "요금·지원 정책", description: "참가비·지원액" },
  { href: "/admin/menus", icon: "restaurant_menu", label: "식음료 메뉴", description: "메뉴와 옵션" },
  { href: "/admin/settings", icon: "settings", label: "운영 설정", description: "문구·입금 계좌" },
] as const;

export default async function AdminDashboardPage() {
  await requireAdminPage();
  const [meetings, members, notices] = await Promise.all([
    getAdminMeetings(),
    getAdminMembers(),
    getAdminNotices(),
  ]);
  const today = getTodayInSeoul();
  const needsAction = meetings
    .filter((meeting) => !["RECRUITING", "UPCOMING", "COMPLETED"].includes(meeting.workflowStage))
    .sort((left, right) => right.date.localeCompare(left.date));
  const upcoming = meetings
    .filter((meeting) => meeting.date >= today && meeting.workflowStage !== "COMPLETED")
    .sort((left, right) => left.date.localeCompare(right.date));
  const pinnedNotice = notices.find((notice) => notice.isPinned) ?? notices[0] ?? null;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <header>
          <p className="brand-text-subtle text-xs font-bold">ADMIN HOME</p>
          <h1 className="mt-1 font-headline text-[1.7rem] font-extrabold tracking-[-0.03em] text-brand-text">오늘의 운영</h1>
          <p className="brand-text-muted mt-1 break-keep text-sm">지금 처리할 일은 위에, 전체 기능은 아래 메뉴에 모았습니다.</p>
        </header>

        {needsAction.length > 0 ? (
          <section className="brand-panel-strong overflow-hidden rounded-2xl">
            <div className="px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="brand-text-subtle text-xs font-bold">먼저 처리할 일</p>
                  <h2 className="mt-1 text-lg font-extrabold text-brand-text">{needsAction[0].nextAction}</h2>
                </div>
                <span className="brand-chip-soft shrink-0 rounded-full px-2.5 py-1 text-xs font-bold">{needsAction[0].workflowLabel}</span>
              </div>
              <p className="brand-text-muted mt-2 text-sm">{needsAction[0].date} · {needsAction[0].location}</p>
              <Link className="brand-button-primary mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-extrabold" href={`/admin/meetings/${needsAction[0].id}${["BILLING_REVIEW", "PAYMENT_CONFIRMATION", "FINAL_SETTLEMENT"].includes(needsAction[0].workflowStage) ? "/settlement" : ""}`}>
                {needsAction[0].nextAction}<Icon name="arrow_forward" />
              </Link>
            </div>
            {needsAction.length > 1 ? <Link className="flex min-h-11 items-center justify-between border-t border-brand-divider px-4 text-xs font-bold text-brand-primary" href="/admin/settlements"><span>나머지 처리할 모임 {needsAction.length - 1}건</span><Icon name="chevron_right" /></Link> : null}
          </section>
        ) : upcoming[0] ? (
          <section className="brand-panel-strong rounded-2xl px-4 py-4">
            <p className="brand-text-subtle text-xs font-bold">다음 모임</p>
            <div className="mt-1 flex items-start justify-between gap-3"><div><h2 className="text-lg font-extrabold text-brand-text">{upcoming[0].date}</h2><p className="brand-text-muted mt-1 text-sm">{upcoming[0].location} · 확정 {upcoming[0].approvedCount}명</p></div><span className="brand-chip-soft rounded-full px-2.5 py-1 text-xs font-bold">{upcoming[0].workflowLabel}</span></div>
            <Link className="brand-button-primary mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-extrabold" href={`/admin/meetings/${upcoming[0].id}`}>모임 준비 확인<Icon name="arrow_forward" /></Link>
          </section>
        ) : (
          <section className="brand-panel-white rounded-2xl px-4 py-8 text-center"><Icon className="text-brand-success text-[30px]" name="task_alt" /><p className="mt-2 text-sm font-bold text-brand-text">지금 처리할 운영 업무가 없습니다.</p></section>
        )}

        <section>
          <div className="mb-3 flex items-center justify-between px-1"><h2 className="text-base font-extrabold text-brand-text">운영 현황</h2><span className="brand-text-subtle text-xs">오늘 기준</span></div>
          <dl className="grid grid-cols-3 gap-2">
            <div className="brand-panel-white rounded-2xl px-3 py-3"><dt className="brand-text-subtle text-xs font-bold">예정 모임</dt><dd className="mt-1 text-xl font-extrabold text-brand-text">{upcoming.length}</dd></div>
            <div className="brand-panel-white rounded-2xl px-3 py-3"><dt className="brand-text-subtle text-xs font-bold">처리 필요</dt><dd className="mt-1 text-xl font-extrabold text-brand-text">{needsAction.length}</dd></div>
            <div className="brand-panel-white rounded-2xl px-3 py-3"><dt className="brand-text-subtle text-xs font-bold">회원</dt><dd className="mt-1 text-xl font-extrabold text-brand-text">{members.length}</dd></div>
          </dl>
        </section>

        {pinnedNotice ? (
          <Link className="brand-list-item brand-list-item-hover flex min-h-14 items-center gap-3 rounded-2xl px-4 py-3" href="/admin/notices">
            <Icon className="text-brand-primary" name="campaign" />
            <span className="min-w-0 flex-1"><span className="brand-text-subtle block text-xs font-bold">최근 공지</span><span className="mt-0.5 block truncate text-sm font-bold text-brand-text">{pinnedNotice.title}</span></span>
            <Icon className="brand-text-subtle" name="chevron_right" />
          </Link>
        ) : null}

        <section className="brand-admin-section overflow-hidden">
          <div className="brand-admin-section-header px-4 py-3"><h2 className="text-base font-extrabold text-brand-text">전체 기능</h2><p className="brand-text-subtle mt-1 text-xs">목적이 정해져 있을 때 바로 이동합니다.</p></div>
          <div className="divide-y divide-brand-divider px-4">
            {FUNCTION_MENU.map((item) => (
              <Link className="flex min-h-16 items-center gap-3 py-2" href={item.href} key={item.href}>
                <span className="brand-chip-soft flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"><Icon name={item.icon} /></span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold text-brand-text">{item.label}</span><span className="brand-text-subtle mt-0.5 block text-xs">{item.description}</span></span>
                <Icon className="brand-text-subtle" name="chevron_right" />
              </Link>
            ))}
          </div>
        </section>
      </div>
    </AdminLayout>
  );
}
