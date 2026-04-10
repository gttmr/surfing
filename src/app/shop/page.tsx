import { ShopDashboardPageClient } from "@/components/shop/ShopDashboardPageClient";
import { getShopDashboardData } from "@/lib/food-ordering-data";

export const dynamic = "force-dynamic";

export default async function ShopPage({
  searchParams,
}: {
  searchParams?: Promise<{ meetingId?: string }>;
}) {
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const requestedMeetingId = Number(resolvedSearchParams?.meetingId);
  const data = await getShopDashboardData(
    Number.isInteger(requestedMeetingId) ? requestedMeetingId : undefined
  );

  return (
    <ShopDashboardPageClient
      meetings={data.meetings}
      selectedMeetingId={data.selectedMeetingId}
      initialData={data.selectedMeetingData}
    />
  );
}
