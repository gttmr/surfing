"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { MeetingOrdersWorkspace } from "@/components/admin/MeetingOrdersWorkspace";
import { ShopLayout } from "@/components/shop/ShopLayout";
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
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleMeetingChange(nextMeetingId: string) {
    const next = new URLSearchParams(searchParams.toString());
    if (!nextMeetingId) {
      next.delete("meetingId");
    } else {
      next.set("meetingId", nextMeetingId);
    }
    router.replace(`/shop?${next.toString()}`);
  }

  return (
    <ShopLayout>
      <div className="mb-3 space-y-2.5">
        {meetings.length > 0 ? (
          <label className="brand-panel-white block rounded-[1.7rem] px-4 py-3">
            <span className="brand-text-subtle mb-2 block text-[11px] font-semibold uppercase tracking-[0.18em]">
              모임 선택
            </span>
            <select
              value={selectedMeetingId ?? ""}
              onChange={(event) => handleMeetingChange(event.target.value)}
              className="brand-input w-full rounded-2xl px-4 py-3 text-sm outline-none"
            >
              {meetings.map((meeting) => (
                <option key={meeting.id} value={meeting.id}>
                  {meeting.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {initialData ? (
          <div className="px-1">
            <p className="brand-text-subtle text-[11px] font-medium">
              {initialData.meeting.date} {initialData.meeting.startTime}–{initialData.meeting.endTime} · {initialData.meeting.location}
            </p>
          </div>
        ) : null}
      </div>

      {initialData ? (
        <MeetingOrdersWorkspace
          initialData={initialData}
          ordersEndpoint={`/api/shop/meetings/${initialData.meeting.id}/orders`}
          variant="shop"
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
