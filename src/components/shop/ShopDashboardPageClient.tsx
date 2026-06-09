"use client";

import { useEffect, useState } from "react";
import { MeetingOrdersWorkspace } from "@/components/admin/MeetingOrdersWorkspace";
import { ShopLayout } from "@/components/shop/ShopLayout";
import { ShopMeetingPicker } from "@/components/shop/ShopMeetingPicker";
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
  const [foodData, setFoodData] = useState(initialData);

  useEffect(() => {
    setFoodData(initialData);
  }, [initialData]);

  return (
    <ShopLayout>
      <ShopMeetingPicker
        meetings={meetings}
        selectedMeetingId={selectedMeetingId}
        meetingInfo={foodData?.meeting ?? null}
      />

      {foodData ? (
        <section className="space-y-3">
          <div className="px-1">
            <h1 className="text-lg font-extrabold text-[var(--brand-text)]">음식 주문</h1>
            <p className="brand-text-subtle mt-1 text-xs">참가자 주문을 실시간으로 처리하고 취소를 관리합니다.</p>
          </div>
          <MeetingOrdersWorkspace
            initialData={foodData}
            ordersEndpoint={`/api/shop/meetings/${foodData.meeting.id}/orders`}
            variant="shop"
            onDataChange={setFoodData}
          />
        </section>
      ) : (
        <div className="brand-card-soft rounded-3xl px-5 py-12 text-center">
          <p className="text-sm font-semibold text-[var(--brand-text)]">표시할 모임이 없습니다.</p>
          <p className="brand-text-subtle mt-1 text-xs">모임이 생성되면 여기서 주문 현황을 바로 볼 수 있습니다.</p>
        </div>
      )}
    </ShopLayout>
  );
}
