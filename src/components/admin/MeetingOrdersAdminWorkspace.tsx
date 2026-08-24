"use client";

import { useMemo, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import type { AdminMeetingFoodOrdersData } from "@/lib/food-ordering-data";
import type { FulfillmentOrderRow } from "@/lib/fulfillment-order-types";
import {
  ADMIN_ORDER_FILTERS,
  groupAdminOrderRows,
  selectAdminOrderGroups,
  type AdminOrderFilter,
  type AdminOrderGroup,
} from "@/lib/admin-fulfillment-presentation";
import { AdminMeetingOrderGroupCard } from "./AdminMeetingOrderGroupCard";
import type { ActionHandler, CancelRequestHandler } from "./meeting-orders-workspace-types";

type CompletionReversalTarget = {
  readonly row: FulfillmentOrderRow;
  readonly label: string;
} | null;

function CompletionReversalDialog({
  target,
  submitting,
  onClose,
  onConfirm,
}: {
  readonly target: CompletionReversalTarget;
  readonly submitting: boolean;
  readonly onClose: () => void;
  readonly onConfirm: (target: NonNullable<CompletionReversalTarget>) => void;
}) {
  return (
    <Dialog
      closeLabel="완료 취소 창 닫기"
      description={target?.label}
      onClose={onClose}
      open={Boolean(target)}
      title="완료 처리를 취소할까요?"
    >
      {target ? (
        <>
          <p className="brand-text-muted text-sm">완료 상태를 되돌리고 다시 처리할 수 있게 합니다.</p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={onClose}
              className="brand-button-secondary rounded-2xl px-4 py-3 text-sm font-bold"
            >
              돌아가기
            </button>
            <button
              type="button"
              onClick={() => onConfirm(target)}
              disabled={submitting}
              className="brand-button-primary rounded-2xl px-4 py-3 text-sm font-bold disabled:cursor-not-allowed"
            >
              {submitting ? "변경 중..." : "완료 취소"}
            </button>
          </div>
        </>
      ) : null}
    </Dialog>
  );
}

function filterLabel(filter: AdminOrderFilter): string {
  if (filter === "actionable") return "처리할 일";
  if (filter === "history") return "완료·취소";
  return "전체 주문";
}

export function MeetingOrdersAdminWorkspace({
  data,
  submittingRows,
  onAction,
  onRequestCancel,
}: {
  readonly data: AdminMeetingFoodOrdersData;
  readonly submittingRows: ReadonlySet<string>;
  readonly onAction: ActionHandler;
  readonly onRequestCancel: CancelRequestHandler;
}) {
  const groups = useMemo(() => groupAdminOrderRows(data.orderRows), [data.orderRows]);
  const [filter, setFilter] = useState<AdminOrderFilter>("actionable");
  const [query, setQuery] = useState("");
  const [expandedOrderId, setExpandedOrderId] = useState<number | null>(() =>
    groupAdminOrderRows(data.orderRows).find((group) => group.status === "actionable")?.orderId ?? null
  );
  const [completionReversalTarget, setCompletionReversalTarget] = useState<CompletionReversalTarget>(null);
  const selection = useMemo(() => ({ filter, query }), [filter, query]);
  const visibleGroups = useMemo(() => selectAdminOrderGroups(groups, selection), [groups, selection]);
  const filterCounts = useMemo(
    () => new Map(ADMIN_ORDER_FILTERS.map((item) => [item, selectAdminOrderGroups(groups, { filter: item, query }).length])),
    [groups, query]
  );

  const visibleExpandedOrderId = visibleGroups.some((group) => group.orderId === expandedOrderId)
    ? expandedOrderId
    : null;

  const tabItems: readonly TabItem<AdminOrderFilter>[] = ADMIN_ORDER_FILTERS.map((item) => ({
    id: item,
    label: (
      <span className="inline-flex items-center gap-1.5">
        <span>{filterLabel(item)}</span>
        <span aria-label={`${filterCounts.get(item) ?? 0}건`} className="text-[11px] opacity-70">
          {filterCounts.get(item) ?? 0}
        </span>
      </span>
    ),
  }));

  function toggleGroup(group: AdminOrderGroup): void {
    setExpandedOrderId((current) => (current === group.orderId ? null : group.orderId));
  }

  return (
    <div className="space-y-5">
      <section className="brand-card-soft rounded-3xl p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-brand-text">제출 단위 주문</h2>
            <p className="brand-text-muted mt-1 text-xs">반복 제출도 주문 번호별로 따로 확인하고 처리합니다.</p>
          </div>
          <span className="brand-chip-soft shrink-0 rounded-full px-2.5 py-1 text-xs font-bold">{visibleGroups.length}건</span>
        </div>

        <label className="relative mt-4 block">
          <span className="sr-only">참가자 또는 메뉴 검색</span>
          <Icon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-brand-text-subtle" name="search" />
          <input
            aria-label="참가자 또는 메뉴 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="참가자 이름 또는 메뉴 검색"
            className="brand-input w-full rounded-2xl py-3 pl-11 pr-4 text-sm outline-none"
            type="search"
          />
        </label>
      </section>

      <Tabs
        label="주문 상태 필터"
        items={tabItems}
        activeId={filter}
        onChange={setFilter}
        className="space-y-4"
        listClassName="overflow-x-auto"
        tabClassName="min-h-11 flex-1 whitespace-nowrap px-2 text-xs font-bold"
        panelClassName="space-y-3"
      >
        {visibleGroups.length === 0 ? (
          <div aria-live="polite" className="brand-panel-white rounded-3xl px-5 py-10 text-center" role="status">
            <p className="text-sm font-bold text-brand-text">
              {query.trim() ? "검색 조건에 맞는 주문이 없습니다." : filter === "actionable" ? "처리할 주문이 없습니다." : "주문 내역이 없습니다."}
            </p>
            <p className="brand-text-subtle mt-1 text-xs">다른 상태 필터나 검색어를 확인해 보세요.</p>
          </div>
        ) : (
          visibleGroups.map((group) => (
            <AdminMeetingOrderGroupCard
              key={group.orderId}
              group={group}
              expanded={visibleExpandedOrderId === group.orderId}
              submittingRows={submittingRows}
              onToggle={() => toggleGroup(group)}
              onAction={onAction}
              onRequestCancel={onRequestCancel}
              onRequestCompletionReversal={setCompletionReversalTarget}
            />
          ))
        )}
      </Tabs>

      <CompletionReversalDialog
        key={completionReversalTarget ? completionReversalTarget.row.rowId : "closed"}
        target={completionReversalTarget}
        submitting={completionReversalTarget ? submittingRows.has(completionReversalTarget.row.rowId) : false}
        onClose={() => setCompletionReversalTarget(null)}
        onConfirm={(target) => {
          void onAction(target.row, "undo_serve");
          setCompletionReversalTarget(null);
        }}
      />
    </div>
  );
}
