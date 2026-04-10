"use client";

import Link from "next/link";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { MeetingOrdersWorkspace } from "@/components/admin/MeetingOrdersWorkspace";
import type { AdminMeetingFoodOrdersData } from "@/lib/food-ordering-data";

export function AdminMeetingOrdersPageClient({
  meetingId,
  initialData,
}: {
  meetingId: number;
  initialData: AdminMeetingFoodOrdersData;
}) {
  return (
    <AdminLayout>
      <div className="mb-6 flex items-start gap-3">
        <Link href={`/admin/meetings/${meetingId}`} className="brand-link mt-0.5 text-xl">
          &larr;
        </Link>
        <div className="flex-1">
          <h1 className="font-headline text-[1.7rem] font-extrabold tracking-[-0.03em] text-[var(--brand-text)]">
            주문 관리
          </h1>
          <p className="brand-text-muted mt-0.5 text-sm">
            {initialData.meeting.date} {initialData.meeting.startTime}–{initialData.meeting.endTime} · {initialData.meeting.location}
          </p>
        </div>
        <Link
          href="/admin/menus"
          className="brand-button-secondary shrink-0 rounded-full px-3 py-1.5 text-xs font-bold"
        >
          메뉴 설정
        </Link>
      </div>

      <MeetingOrdersWorkspace
        initialData={initialData}
        ordersEndpoint={`/api/admin/meetings/${meetingId}/orders`}
      />
    </AdminLayout>
  );
}
