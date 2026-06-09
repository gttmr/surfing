"use client";

import { useEffect, useMemo, useState } from "react";
import { ShopLayout } from "@/components/shop/ShopLayout";
import { ShopMeetingPicker } from "@/components/shop/ShopMeetingPicker";
import { ShopSurfUsageWorkspace } from "@/components/shop/ShopSurfUsageWorkspace";
import { formatWon } from "@/lib/format";
import type { AdminMeetingFoodOrdersData, ShopMeetingOption } from "@/lib/food-ordering-data";
import { calculateShopRevenueSummary } from "@/lib/shop-revenue-summary";
import type { ShopMeetingSurfUsageData } from "@/lib/surf-usage-data";

function ShopRevenueSummaryPanel({
  foodData,
  usageData,
}: {
  foodData: AdminMeetingFoodOrdersData;
  usageData: ShopMeetingSurfUsageData | null;
}) {
  const summary = useMemo(
    () =>
      calculateShopRevenueSummary({
        foodOrderAmount: foodData.summary.orderAmount,
        foodCancelledAmount: foodData.summary.cancelledAmount,
        foodOrderedQuantity: foodData.summary.totalOrderedQuantity,
        surfUsageConfirmedAmount: usageData?.summary.confirmedShopAmount ?? 0,
        surfUsageSubmittedAmount: usageData?.summary.submittedShopAmount ?? 0,
        surfUsageReviewCount: usageData?.summary.reviewCount ?? 0,
        surfUsageMissingCount: usageData?.summary.missingCount ?? 0,
        surfUsageConfirmedCount: usageData?.summary.confirmedCount ?? 0,
      }),
    [foodData, usageData]
  );
  const usageStatus = [
    summary.surfUsageReviewCount > 0 ? `검수 ${summary.surfUsageReviewCount}명` : null,
    summary.surfUsageMissingCount > 0 ? `미제출 ${summary.surfUsageMissingCount}명` : null,
    `확정 ${summary.surfUsageConfirmedCount}명`,
  ].filter(Boolean).join(" · ");

  return (
    <section className="brand-panel-white rounded-[1.7rem] p-4 md:p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-stretch">
        <div className="brand-chip-dark min-w-0 rounded-2xl px-4 py-4 md:flex-[1.35]">
          <p className="text-[11px] font-bold uppercase tracking-normal opacity-75">총 이용 금액</p>
          <p className="mt-2 break-keep text-3xl font-extrabold leading-tight md:text-4xl">
            {formatWon(summary.totalAmount)}
          </p>
          <p className="mt-2 text-xs font-semibold opacity-80">음식 주문 + 확정된 샵이용</p>
        </div>

        <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
          <div className="brand-chip-soft rounded-2xl px-4 py-4">
            <p className="text-[11px] font-bold opacity-70">음식 주문</p>
            <p className="mt-1 break-keep text-xl font-extrabold leading-tight">{formatWon(summary.foodAmount)}</p>
            <p className="brand-text-muted mt-2 text-[11px] font-semibold">
              주문 {summary.foodOrderedQuantity}개 · 취소 {formatWon(summary.foodCancelledAmount)}
            </p>
          </div>
          <div className="brand-chip-soft rounded-2xl px-4 py-4">
            <p className="text-[11px] font-bold opacity-70">샵이용</p>
            <p className="mt-1 break-keep text-xl font-extrabold leading-tight">{formatWon(summary.surfUsageAmount)}</p>
            <p className="brand-text-muted mt-2 text-[11px] font-semibold">{usageStatus}</p>
          </div>
        </div>
      </div>
    </section>
  );
}

export function ShopUsagePageClient({
  meetings,
  selectedMeetingId,
  initialData,
  initialUsageData,
}: {
  meetings: ShopMeetingOption[];
  selectedMeetingId: number | null;
  initialData: AdminMeetingFoodOrdersData | null;
  initialUsageData: ShopMeetingSurfUsageData | null;
}) {
  const [foodData, setFoodData] = useState(initialData);
  const [usageData, setUsageData] = useState(initialUsageData);

  useEffect(() => {
    setFoodData(initialData);
  }, [initialData]);

  useEffect(() => {
    setUsageData(initialUsageData);
  }, [initialUsageData]);

  const meetingInfo = foodData?.meeting ?? usageData?.meeting ?? null;

  return (
    <ShopLayout>
      <ShopMeetingPicker
        meetings={meetings}
        selectedMeetingId={selectedMeetingId}
        meetingInfo={meetingInfo}
      />

      {foodData && usageData ? (
        <div className="space-y-8">
          <ShopRevenueSummaryPanel foodData={foodData} usageData={usageData} />

          <section className="space-y-3">
            <div className="px-1">
              <h1 className="text-lg font-extrabold text-[var(--brand-text)]">이용 체크</h1>
              <p className="brand-text-subtle mt-1 text-xs">실제 강습, 장비, 샤워 이용 내역과 샵 청구 금액만 관리합니다.</p>
            </div>
            <ShopSurfUsageWorkspace
              initialData={usageData}
              usageEndpoint={`/api/shop/meetings/${usageData.meeting.id}/usage`}
              catalogEndpoint={`/api/shop/meetings/${usageData.meeting.id}/usage/items`}
              onDataChange={setUsageData}
            />
          </section>
        </div>
      ) : (
        <div className="brand-card-soft rounded-3xl px-5 py-12 text-center">
          <p className="text-sm font-semibold text-[var(--brand-text)]">표시할 모임이 없습니다.</p>
          <p className="brand-text-subtle mt-1 text-xs">모임이 생성되면 여기서 이용 내역을 바로 관리할 수 있습니다.</p>
        </div>
      )}
    </ShopLayout>
  );
}
