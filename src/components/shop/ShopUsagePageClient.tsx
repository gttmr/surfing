"use client";

import { useEffect, useState } from "react";
import { ShopLayout } from "@/components/shop/ShopLayout";
import { ShopMeetingPicker } from "@/components/shop/ShopMeetingPicker";
import { ShopSurfUsageWorkspace } from "@/components/shop/ShopSurfUsageWorkspace";
import { ShopUsageCatalogSection } from "@/components/shop/ShopUsageCatalogSection";
import { Icon } from "@/components/ui/Icon";
import { formatWon } from "@/lib/format";
import type { AdminMeetingFoodOrdersData, ShopMeetingOption } from "@/lib/food-ordering-data";
import type { ShopMeetingSurfUsageData } from "@/lib/surf-usage-data";

function ShopUsagePayableSummary({ usageData }: { usageData: ShopMeetingSurfUsageData }) {
  const summary = usageData.summary;
  const usageStatus = [
    summary.reviewCount > 0 ? `확인 필요 ${summary.reviewCount}명` : null,
    summary.missingCount > 0 ? `미제출 ${summary.missingCount}명` : null,
    `확정 ${summary.confirmedCount}명`,
  ].filter(Boolean).join(" · ");

  return (
    <section className="border-y border-brand-divider py-4">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="brand-text-subtle text-xs font-bold">확정된 실제 이용</p>
          <p className="mt-1 text-sm font-semibold text-brand-text">샵 청구 예정액</p>
        </div>
        <p className="text-2xl font-extrabold text-brand-text">{formatWon(summary.confirmedShopAmount)}</p>
      </div>
      <p className="brand-text-muted mt-2 text-xs">{usageStatus} · 제출 금액 {formatWon(summary.submittedShopAmount)}</p>
    </section>
  );
}

function PlannedUsageOverview({ usageData }: { usageData: ShopMeetingSurfUsageData }) {
  return (
    <section className="space-y-4">
      <div className="brand-panel-strong rounded-2xl px-4 py-4" role="status">
        <div className="flex items-start gap-3">
          <span className="brand-chip-soft flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"><Icon name="schedule" /></span>
          <div className="min-w-0">
            <p className="text-sm font-extrabold text-brand-text">모임 종료 후 실제 이용 확인이 열립니다</p>
            <p className="brand-text-muted mt-1 break-keep text-xs">지금은 회원이 신청한 이용 예정만 확인할 수 있습니다. 현장에서 달라진 내용은 모임이 끝난 뒤 입력해 주세요.</p>
          </div>
        </div>
      </div>

      <section aria-labelledby="planned-usage-title">
        <div className="mb-3 flex items-end justify-between gap-3 px-1">
          <div>
            <h2 className="text-base font-extrabold text-brand-text" id="planned-usage-title">이용 예정</h2>
            <p className="brand-text-subtle mt-1 text-xs">참가 확정 {usageData.summary.approvedCount}명</p>
          </div>
        </div>
        <div className="divide-y divide-brand-divider rounded-2xl border border-brand-divider bg-brand-surface">
          {usageData.participantRows.map((participant) => (
            <div className="flex min-h-16 items-center justify-between gap-3 px-4 py-3" key={participant.participantId}>
              <span className="min-w-0 text-sm font-extrabold text-brand-text">{participant.participantName}</span>
              <span className="brand-text-muted max-w-[58%] text-right text-xs font-semibold">{participant.requestedOptionLabel}</span>
            </div>
          ))}
          {usageData.participantRows.length === 0 ? <p className="brand-text-subtle px-4 py-6 text-center text-xs">참가 확정 회원이 없습니다.</p> : null}
        </div>
      </section>
    </section>
  );
}

function LockedUsageOverview({ usageData }: { usageData: ShopMeetingSurfUsageData }) {
  return (
    <section className="space-y-3" aria-labelledby="locked-usage-title">
      <div className="brand-alert-info rounded-2xl px-4 py-3" role="status">
        <p className="text-sm font-extrabold" id="locked-usage-title">실제 이용 내역이 잠겼습니다</p>
        <p className="mt-1 text-xs">{usageData.meeting.actualUsageReview.reason} 아래 내용은 읽기 전용입니다.</p>
      </div>
      <div className="divide-y divide-brand-divider rounded-2xl border border-brand-divider bg-brand-surface">
        {usageData.participantRows.map((participant) => {
          const actual = participant.entries
            .filter((entry) => entry.quantity > 0)
            .map((entry) => `${entry.usageItemName} ${entry.quantity}`)
            .join(" · ") || "이용 없음";
          return (
            <div className="px-4 py-3" key={participant.participantId}>
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-extrabold text-brand-text">{participant.participantName}</p>
                <p className="text-sm font-extrabold text-brand-text">{formatWon(participant.shopAmount)}</p>
              </div>
              <p className="brand-text-subtle mt-1 text-xs">이용 예정 {participant.requestedOptionLabel}</p>
              <p className="brand-text-muted mt-1 text-xs">실제 이용 {actual}</p>
            </div>
          );
        })}
      </div>
      <details className="brand-panel-white overflow-hidden rounded-2xl" id="usage-catalog">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-extrabold text-brand-text">
          <span>적용된 이용 항목</span>
          <span className="brand-chip-dimmed rounded-full px-2 py-1 text-[11px]">읽기 전용</span>
        </summary>
        <dl className="divide-y divide-brand-divider border-t border-brand-divider">
          {usageData.usageItems.map((item) => (
            <div className="flex items-center justify-between gap-3 px-4 py-3" key={item.id}>
              <dt className="text-sm font-semibold text-brand-text">{item.name}</dt>
              <dd className="text-sm font-extrabold text-brand-text">{formatWon(item.shopPrice)}</dd>
            </div>
          ))}
        </dl>
      </details>
    </section>
  );
}

export function ShopUsagePageClient({
  meetings,
  selectedMeetingId,
  initialData,
  initialUsageData,
  initialUsageDataByDay,
}: {
  meetings: ShopMeetingOption[];
  selectedMeetingId: number | null;
  initialData: AdminMeetingFoodOrdersData | null;
  initialUsageData: ShopMeetingSurfUsageData | null;
  initialUsageDataByDay: ShopMeetingSurfUsageData[];
}) {
  const [foodData, setFoodData] = useState(initialData);
  const [usageData, setUsageData] = useState(initialUsageData);
  const [usageDataByDay, setUsageDataByDay] = useState(initialUsageDataByDay);

  useEffect(() => {
    setFoodData(initialData);
  }, [initialData]);

  useEffect(() => {
    setUsageData(initialUsageData);
    setUsageDataByDay(initialUsageDataByDay);
  }, [initialUsageData, initialUsageDataByDay]);

  function handleUsageDataChange(nextData: ShopMeetingSurfUsageData) {
    setUsageData(nextData);
    setUsageDataByDay((current) => current.map((item) => (
      item.meeting.id === nextData.meeting.id ? nextData : item
    )));
  }

  const meetingInfo = foodData?.meeting ?? usageData?.meeting ?? null;
  const reviewState = usageData?.meeting.actualUsageReview.state ?? "WAITING";
  const waiting = reviewState === "WAITING";
  const isOvernight = usageDataByDay.length === 2;
  const combinedSummary = usageDataByDay.reduce((summary, day) => ({
    approvedCount: summary.approvedCount + day.summary.approvedCount,
    missingCount: summary.missingCount + day.summary.missingCount,
    reviewCount: summary.reviewCount + day.summary.reviewCount,
    confirmedCount: summary.confirmedCount + day.summary.confirmedCount,
    confirmedShopAmount: summary.confirmedShopAmount + day.summary.confirmedShopAmount,
  }), { approvedCount: 0, missingCount: 0, reviewCount: 0, confirmedCount: 0, confirmedShopAmount: 0 });

  return (
    <ShopLayout>
      <header className="mb-4">
        <p className="brand-text-subtle text-xs font-bold">{waiting ? "PLANNED USAGE" : "ACTUAL USAGE"}</p>
        <h1 className="mt-1 font-headline text-[1.7rem] font-extrabold tracking-[-0.03em] text-brand-text">{waiting ? "이용 예정 현황" : "실제 이용 확인"}</h1>
        <p className="brand-text-muted mt-1 break-keep text-sm">{waiting ? "회원이 신청한 이용 예정을 확인하고 현장 준비를 합니다." : "회원의 이용 예정과 현장 실제 이용을 비교해 샵 금액을 확정합니다."}</p>
      </header>
      <ShopMeetingPicker
        meetings={meetings}
        selectedMeetingId={selectedMeetingId}
        meetingInfo={meetingInfo}
      />

      {isOvernight ? (
        <section className="mb-5 space-y-3" aria-label="1박2일 실제 이용 현황">
          <div className="brand-panel-strong rounded-2xl px-4 py-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="brand-text-subtle text-xs font-bold">2일 합산 샵 금액</p>
                <p className="mt-1 text-sm font-extrabold text-brand-text">확정 {combinedSummary.confirmedCount}/{combinedSummary.approvedCount}건</p>
              </div>
              <p className="text-xl font-extrabold text-brand-text">{formatWon(combinedSummary.confirmedShopAmount)}</p>
            </div>
            <p className="brand-text-muted mt-2 text-xs">예정과 다른 제출·확인 필요 {combinedSummary.reviewCount}건 · 미제출 {combinedSummary.missingCount}건</p>
          </div>
          <div className="grid grid-cols-2 gap-1 rounded-2xl bg-brand-surface p-1.5" role="tablist" aria-label="확인할 날짜">
            {usageDataByDay.map((day, index) => {
              const [, month, date] = day.meeting.date.split("-");
              const active = usageData?.meeting.id === day.meeting.id;
              return (
                <button
                  aria-selected={active}
                  className={`min-h-12 rounded-xl px-2 py-2 text-xs font-extrabold ${active ? "brand-filter-tab-active" : "brand-text-subtle"}`}
                  key={day.meeting.id}
                  onClick={() => setUsageData(day)}
                  role="tab"
                  type="button"
                >
                  {index + 1}일차 · {Number(month)}.{Number(date)}
                  <span className="mt-0.5 block text-[10px] font-semibold">확인 {day.summary.reviewCount} · 미제출 {day.summary.missingCount}</span>
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {usageData ? (
        <div className="space-y-8">
          {reviewState === "WAITING" ? (
            <>
              <PlannedUsageOverview usageData={usageData} />
              <ShopUsageCatalogSection
                catalogEndpoint={`/api/shop/meetings/${usageData.meeting.id}/usage/items`}
                data={usageData}
                onDataChange={handleUsageDataChange}
              />
            </>
          ) : (
            <>
              <ShopUsagePayableSummary usageData={usageData} />
              {reviewState === "OPEN" ? (
                <ShopSurfUsageWorkspace
                  initialData={usageData}
                  usageEndpoint={`/api/shop/meetings/${usageData.meeting.id}/usage`}
                  catalogEndpoint={`/api/shop/meetings/${usageData.meeting.id}/usage/items`}
                  onDataChange={handleUsageDataChange}
                />
              ) : <LockedUsageOverview usageData={usageData} />}
            </>
          )}
        </div>
      ) : (
        <div className="brand-card-soft rounded-3xl px-5 py-12 text-center">
          <p className="text-sm font-semibold text-brand-text">표시할 모임이 없습니다.</p>
          <p className="brand-text-subtle mt-1 text-xs">모임이 생성되면 여기서 이용 내역을 바로 관리할 수 있습니다.</p>
        </div>
      )}
    </ShopLayout>
  );
}
