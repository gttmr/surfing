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
      <header className="mb-4">
        <p className="brand-text-subtle text-xs font-bold">FOOD ORDERS</p>
        <h1 className="mt-1 font-headline text-[1.7rem] font-extrabold tracking-[-0.03em] text-brand-text">식음료 주문</h1>
        <p className="brand-text-muted mt-1 break-keep text-sm">접수·준비·제공 상태만 이 화면에서 처리합니다.</p>
      </header>
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
          <p className="text-sm font-semibold text-brand-text">표시할 모임이 없습니다.</p>
          <p className="brand-text-subtle mt-1 text-xs">모임이 생성되면 여기서 주문 현황을 바로 볼 수 있습니다.</p>
        </div>
      )}
    </ShopLayout>
  );
}
