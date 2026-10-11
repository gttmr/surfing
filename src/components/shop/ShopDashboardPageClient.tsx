"use client";

import Link from "next/link";
import { ShopLayout } from "@/components/shop/ShopLayout";
import { ShopMeetingPicker } from "@/components/shop/ShopMeetingPicker";
import { ShopOrderQueue } from "@/components/shop/order-queue/ShopOrderQueue";
import { Icon } from "@/components/ui/Icon";
import type { AdminMeetingFoodOrdersData, ShopMeetingOption } from "@/lib/food-ordering-data";
import { DAY_KO } from "@/lib/format";
import type { PendingShopCountCheck } from "@/lib/shop-count-checks";

function shortDate(date: string) {
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}(${DAY_KO[new Date(`${date}T12:00:00`).getDay()]})`;
}

export function ShopDashboardPageClient({
  meetings,
  selectedMeetingId,
  initialData,
  pendingCountChecks,
}: {
  meetings: ShopMeetingOption[];
  selectedMeetingId: number | null;
  initialData: AdminMeetingFoodOrdersData | null;
  pendingCountChecks: readonly PendingShopCountCheck[];
}) {
  return (
    <ShopLayout>
      {pendingCountChecks.length > 0 ? (
        <div className="mb-4 space-y-2">
          {pendingCountChecks.map((check) => (
            <Link
              className="brand-highlight-panel flex min-h-14 items-center justify-between gap-3 rounded-2xl px-4 py-3"
              href={`/shop/usage?meetingId=${check.meetingId}#count-check`}
              key={check.meetingId}
            >
              <span className="min-w-0">
                <span className="block text-sm font-extrabold text-brand-text">{shortDate(check.date)} 장비 수량 확인</span>
                <span className="brand-text-muted block truncate text-xs">{check.location} · 합계가 맞는지만 봐 주세요</span>
              </span>
              <Icon className="text-[20px] text-brand-primary" name="arrow_forward" />
            </Link>
          ))}
        </div>
      ) : null}

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
