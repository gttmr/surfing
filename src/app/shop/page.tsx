import Link from "next/link";
import { ShopLayout } from "@/components/shop/ShopLayout";
import { ShopMeetingPicker } from "@/components/shop/ShopMeetingPicker";
import { Icon } from "@/components/ui/Icon";
import { getShopDashboardData } from "@/lib/food-ordering-data";
import { formatWon } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function ShopHomePage({
  searchParams,
}: {
  searchParams?: Promise<{ meetingId?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedMeetingId = Number(resolvedSearchParams?.meetingId);
  const data = await getShopDashboardData(Number.isInteger(requestedMeetingId) ? requestedMeetingId : undefined);
  const orders = data.selectedMeetingData;
  const usage = data.selectedUsageData;
  const meetingId = data.selectedMeetingId;
  const remainingOrders = orders?.summary.remainingQuantity ?? 0;
  const missingUsage = usage?.summary.missingCount ?? 0;
  const reviewUsage = usage?.summary.reviewCount ?? 0;
  const confirmedUsage = usage?.summary.confirmedCount ?? 0;
  const usageReviewState = usage?.meeting.actualUsageReview.state ?? "WAITING";
  const usageActionable = usageReviewState === "OPEN";
  const primaryHref = remainingOrders > 0 || usageReviewState === "WAITING"
    ? `/shop/orders?meetingId=${meetingId}`
    : `/shop/usage?meetingId=${meetingId}`;
  const primaryLabel = remainingOrders > 0
    ? `남은 주문 ${remainingOrders}개 처리`
    : usageReviewState === "WAITING"
      ? "모임 전 주문 현황 확인"
      : usageActionable && missingUsage + reviewUsage > 0
        ? `실제 이용 ${missingUsage + reviewUsage}명 확인`
        : usageReviewState === "LOCKED"
          ? "확정된 실제 이용 보기"
          : "실제 이용 확인 완료";
  const usageMenuTitle = usageReviewState === "WAITING" ? "이용 예정 현황" : "실제 이용 확인";
  const usageMenuDetail = usageReviewState === "WAITING"
    ? `이용 예정 ${usage?.summary.approvedCount ?? 0}명 · 모임 종료 후 확인`
    : usageReviewState === "LOCKED"
      ? `확정 ${confirmedUsage}명 · 청구 검토로 잠김`
      : `미제출 ${missingUsage}명 · 확인 필요 ${reviewUsage}명 · 확정 ${confirmedUsage}명`;

  return (
    <ShopLayout>
      <div className="space-y-6">
        <header>
          <p className="brand-text-subtle text-xs font-bold">SHOP HOME</p>
          <h1 className="mt-1 font-headline text-[1.7rem] font-extrabold tracking-[-0.03em] text-brand-text">샵 운영</h1>
          <p className="brand-text-muted mt-1 break-keep text-sm">식음료 주문과 실제 이용 확인을 섞지 않고 각각 처리합니다.</p>
        </header>

        <ShopMeetingPicker meetingInfo={orders?.meeting ?? usage?.meeting ?? null} meetings={data.meetings} selectedMeetingId={meetingId} />

        {meetingId ? (
          <>
            <section className="brand-panel-strong rounded-2xl px-4 py-4">
              <p className="brand-text-subtle text-xs font-bold">지금 할 일</p>
              <h2 className="mt-1 text-lg font-extrabold text-brand-text">{primaryLabel}</h2>
              <Link className="brand-button-primary mt-4 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-extrabold" href={primaryHref}>{primaryLabel}<Icon name="arrow_forward" /></Link>
            </section>

            <section>
              <h2 className="mb-3 px-1 text-base font-extrabold text-brand-text">업무 현황</h2>
              <div className="space-y-2">
                <Link className="brand-list-item brand-list-item-hover flex min-h-20 items-center gap-3 rounded-2xl px-4 py-3" href={`/shop/orders?meetingId=${meetingId}`}>
                  <span className="brand-chip-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"><Icon name="receipt_long" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold text-brand-text">식음료 주문</span><span className="brand-text-subtle mt-1 block text-xs">미처리 {remainingOrders}개 · 주문액 {formatWon(orders?.summary.orderAmount ?? 0)}</span></span>
                  <Icon className="brand-text-subtle" name="chevron_right" />
                </Link>
                <Link className="brand-list-item brand-list-item-hover flex min-h-20 items-center gap-3 rounded-2xl px-4 py-3" href={`/shop/usage?meetingId=${meetingId}`}>
                  <span className="brand-chip-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"><Icon name="checklist" /></span>
                  <span className="min-w-0 flex-1"><span className="block text-sm font-extrabold text-brand-text">{usageMenuTitle}</span><span className="brand-text-subtle mt-1 block text-xs">{usageMenuDetail}</span></span>
                  <Icon className="brand-text-subtle" name="chevron_right" />
                </Link>
              </div>
            </section>

            <section className="brand-admin-section overflow-hidden">
              <div className="brand-admin-section-header px-4 py-3"><h2 className="text-base font-extrabold text-brand-text">기능 메뉴</h2><p className="brand-text-subtle mt-1 text-xs">목적이 정해져 있을 때 바로 이동합니다.</p></div>
              <div className="divide-y divide-brand-divider px-4">
                <Link className="flex min-h-16 items-center gap-3 py-2" href="/shop/menus"><Icon className="text-brand-primary" name="restaurant_menu" /><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-brand-text">메뉴 관리</span><span className="brand-text-subtle mt-0.5 block text-xs">식음료 메뉴·옵션·판매 상태</span></span><Icon className="brand-text-subtle" name="chevron_right" /></Link>
                <Link className="flex min-h-16 items-center gap-3 py-2" href={`/shop/usage?meetingId=${meetingId}#usage-catalog`}><Icon className="text-brand-primary" name="surfing" /><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-brand-text">이용 항목 관리</span><span className="brand-text-subtle mt-0.5 block text-xs">강습·장비 항목과 샵 금액</span></span><Icon className="brand-text-subtle" name="chevron_right" /></Link>
              </div>
            </section>
          </>
        ) : (
          <div className="brand-panel-white rounded-2xl px-4 py-10 text-center" role="status"><Icon className="brand-text-subtle text-[30px]" name="event_busy" /><p className="mt-2 text-sm font-bold text-brand-text">표시할 모임이 없습니다.</p></div>
        )}
      </div>
    </ShopLayout>
  );
}
