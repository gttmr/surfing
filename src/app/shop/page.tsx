import { ShopDashboardPageClient } from "@/components/shop/ShopDashboardPageClient";
import { getShopDashboardData } from "@/lib/food-ordering-data";
import { getPendingShopCountChecks } from "@/lib/shop-count-checks";

export const dynamic = "force-dynamic";

// 샵 운영자는 주문판으로 바로 들어온다. 장비 수량 확인이 남은 모임은 주문판 위에 띄운다.
export default async function ShopHomePage({
  searchParams,
}: {
  searchParams?: Promise<{ meetingId?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedMeetingId = Number(resolvedSearchParams?.meetingId);
  const [data, pendingCountChecks] = await Promise.all([
    getShopDashboardData(Number.isInteger(requestedMeetingId) ? requestedMeetingId : undefined),
    getPendingShopCountChecks(),
  ]);

  return (
    <ShopDashboardPageClient
      initialData={data.selectedMeetingData}
      meetings={data.meetings}
      pendingCountChecks={pendingCountChecks}
      selectedMeetingId={data.selectedMeetingId}
    />
  );
}
