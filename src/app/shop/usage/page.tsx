import { ShopUsagePageClient } from "@/components/shop/ShopUsagePageClient";
import { getShopDashboardData } from "@/lib/food-ordering-data";

export const dynamic = "force-dynamic";

export default async function ShopUsagePage({
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
    <ShopUsagePageClient
      meetings={data.meetings}
      selectedMeetingId={data.selectedMeetingId}
      initialData={data.selectedMeetingData}
      initialUsageData={data.selectedUsageData}
    />
  );
}
