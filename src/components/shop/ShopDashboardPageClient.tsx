"use client";

import { ShopLayout } from "@/components/shop/ShopLayout";
import { ShopMeetingPicker } from "@/components/shop/ShopMeetingPicker";
import { ShopOrderQueue } from "@/components/shop/order-queue/ShopOrderQueue";
import type { AdminMeetingFoodOrdersData, ShopMeetingOption } from "@/lib/food-ordering-data";

export function ShopDashboardPageClient({
  meetings,
  selectedMeetingId,
  initialData,
}: {
  meetings: ShopMeetingOption[];
  selectedMeetingId: number | null;
  initialData: AdminMeetingFoodOrdersData | null;
}) {
  return (
    <ShopLayout>
      <ShopMeetingPicker
        meetings={meetings}
        selectedMeetingId={selectedMeetingId}
        meetingInfo={initialData?.meeting ?? null}
      />

      {initialData ? (
        <ShopOrderQueue
          initialData={initialData}
          key={initialData.meeting.id}
          ordersEndpoint={`/api/shop/meetings/${initialData.meeting.id}/orders`}
        />
      ) : (
        <div className="brand-card-soft rounded-3xl px-5 py-12 text-center">
          <p className="text-sm font-semibold text-[var(--brand-text)]">표시할 모임이 없습니다.</p>
          <p className="brand-text-subtle mt-1 text-xs">모임이 생성되면 여기서 주문 현황을 바로 볼 수 있습니다.</p>
        </div>
      )}
    </ShopLayout>
  );
}
