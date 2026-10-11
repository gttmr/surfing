"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ShopUsageCatalogSection } from "@/components/shop/ShopUsageCatalogSection";
import { ShopUsageParticipantReview } from "@/components/shop/ShopUsageParticipantReview";
import type { ShopUsageActionError } from "@/components/shop/ShopUsageParticipantRow";
import { Dialog } from "@/components/ui/Dialog";
import { Toast, useToast } from "@/components/ui/Toast";
import type { ShopMeetingSurfUsageData } from "@/lib/surf-usage-data";
import {
  buildShopUsageDrafts,
  getDirtyShopUsageParticipantIds,
  selectShopUsageParticipants,
  SHOP_USAGE_ACTION_COPY,
  type ShopUsageDrafts,
  type ShopUsageFilter,
  type ShopUsageLockedParticipant,
  type ShopUsageParticipantAction,
  type ShopUsagePendingViewChange,
} from "./shop-usage-review";
import { isShopMeetingSurfUsageData, shopUsageErrorMessage } from "./shop-usage-response";

export function ShopSurfUsageWorkspace({
  catalogEndpoint,
  initialData,
  onDataChange,
  usageEndpoint,
}: {
  readonly catalogEndpoint: string;
  readonly initialData: ShopMeetingSurfUsageData;
  readonly onDataChange?: (nextData: ShopMeetingSurfUsageData) => void;
  readonly usageEndpoint: string;
}) {
  const [data, setData] = useState(initialData);
  const [savedDrafts, setSavedDrafts] = useState<ShopUsageDrafts>(() => buildShopUsageDrafts(initialData));
  const [drafts, setDrafts] = useState<ShopUsageDrafts>(() => buildShopUsageDrafts(initialData));
  const [filter, setFilter] = useState<ShopUsageFilter>("actionable");
  const [query, setQuery] = useState("");
  const [openParticipantId, setOpenParticipantId] = useState<number | null>(null);
  const [lockedParticipant, setLockedParticipant] = useState<ShopUsageLockedParticipant | null>(null);
  const [actionError, setActionError] = useState<ShopUsageActionError | null>(null);
  const [pendingViewChange, setPendingViewChange] = useState<ShopUsagePendingViewChange | null>(null);
  const [fillDialogOpen, setFillDialogOpen] = useState(false);
  const [filling, setFilling] = useState(false);
  const { addToast, removeToast, toasts } = useToast();
  const appliedInitialDataRef = useRef(initialData);
  const currentMeetingId = data.meeting.id;

  useEffect(() => {
    if (appliedInitialDataRef.current === initialData) return;
    appliedInitialDataRef.current = initialData;
    const meetingChanged = initialData.meeting.id !== currentMeetingId;
    const nextDrafts = buildShopUsageDrafts(initialData);
    setData(initialData);
    setSavedDrafts(nextDrafts);
    setDrafts(nextDrafts);
    setLockedParticipant(null);
    setActionError(null);
    setPendingViewChange(null);
    if (meetingChanged) {
      setFilter("actionable");
      setQuery("");
      setOpenParticipantId(null);
      return;
    }
    setOpenParticipantId((current) => current !== null
      && initialData.participantRows.some((participant) => participant.participantId === current)
      ? current
      : null);
  }, [currentMeetingId, initialData]);

  const activeItems = useMemo(() => data.usageItems.filter((item) => item.isActive), [data.usageItems]);
  const activeItemIds = useMemo(() => activeItems.map((item) => item.id), [activeItems]);
  const dirtyParticipantIds = useMemo(() => getDirtyShopUsageParticipantIds(
    data.participantRows,
    activeItemIds,
    savedDrafts,
    drafts,
  ), [activeItemIds, data.participantRows, drafts, savedDrafts]);
  const visibleParticipants = useMemo(() => selectShopUsageParticipants(
    data.participantRows,
    { filter, query },
  ), [data.participantRows, filter, query]);

  function commitServerData(nextData: ShopMeetingSurfUsageData, preserveDirtyDrafts: boolean) {
    appliedInitialDataRef.current = nextData;
    const nextSavedDrafts = buildShopUsageDrafts(nextData);
    setData(nextData);
    setSavedDrafts(nextSavedDrafts);
    setDrafts((currentDrafts) => {
      if (!preserveDirtyDrafts) return nextSavedDrafts;
      const retainedDrafts: ShopUsageDrafts = { ...nextSavedDrafts };
      for (const participantId of dirtyParticipantIds) {
        retainedDrafts[participantId] = {
          ...(nextSavedDrafts[participantId] ?? {}),
          ...(currentDrafts[participantId] ?? {}),
        };
      }
      return retainedDrafts;
    });
    onDataChange?.(nextData);
  }

  function updateQuantity(participantId: number, usageItemId: number, quantity: number) {
    setDrafts((current) => ({
      ...current,
      [participantId]: {
        ...(current[participantId] ?? {}),
        [usageItemId]: Math.max(0, Math.min(20, quantity)),
      },
    }));
    setActionError((current) => current?.participantId === participantId ? null : current);
  }

  function applyViewChange(change: ShopUsagePendingViewChange) {
    if (change.kind === "query") {
      setQuery(change.value);
      const nextRows = selectShopUsageParticipants(data.participantRows, { filter, query: change.value });
      if (openParticipantId !== null && !nextRows.some((row) => row.participantId === openParticipantId)) {
        setOpenParticipantId(null);
      }
      return;
    }
    if (change.kind === "filter") {
      setFilter(change.value);
      const nextRows = selectShopUsageParticipants(data.participantRows, { filter: change.value, query });
      if (openParticipantId !== null && !nextRows.some((row) => row.participantId === openParticipantId)) {
        setOpenParticipantId(null);
      }
      return;
    }
    setOpenParticipantId(change.value);
    setActionError(null);
  }

  function viewChangeWouldHideDirtyParticipant(change: ShopUsagePendingViewChange): boolean {
    if (dirtyParticipantIds.length === 0) return false;
    if (change.kind === "open") {
      return dirtyParticipantIds.some((participantId) => change.value !== participantId);
    }
    const nextRows = selectShopUsageParticipants(data.participantRows, {
      filter: change.kind === "filter" ? change.value : filter,
      query: change.kind === "query" ? change.value : query,
    });
    return dirtyParticipantIds.some((participantId) => (
      !nextRows.some((row) => row.participantId === participantId)
    ));
  }

  function requestViewChange(change: ShopUsagePendingViewChange) {
    if (viewChangeWouldHideDirtyParticipant(change)) {
      setPendingViewChange(change);
      return;
    }
    applyViewChange(change);
  }

  function discardChanges() {
    setDrafts((current) => {
      const nextDrafts: ShopUsageDrafts = { ...current };
      for (const participantId of dirtyParticipantIds) {
        nextDrafts[participantId] = { ...(savedDrafts[participantId] ?? {}) };
      }
      return nextDrafts;
    });
    setActionError(null);
    if (pendingViewChange) applyViewChange(pendingViewChange);
    setPendingViewChange(null);
  }

  async function mutateParticipant(participantId: number, action: ShopUsageParticipantAction) {
    setLockedParticipant({ participantId, action });
    setActionError(null);
    try {
      const body = action === "save"
        ? {
            participantId,
            action,
            items: activeItems.map((item) => ({
              usageItemId: item.id,
              quantity: drafts[participantId]?.[item.id] ?? 0,
            })),
          }
        : { participantId, action };
      const response = await fetch(usageEndpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload: unknown = await response.json();
      if (!response.ok || !isShopMeetingSurfUsageData(payload)) {
        const message = shopUsageErrorMessage(payload, SHOP_USAGE_ACTION_COPY[action].failure);
        setActionError({ action, message, participantId });
        return;
      }
      commitServerData(payload, false);
      if (action === "confirm") setOpenParticipantId(null);
      addToast(SHOP_USAGE_ACTION_COPY[action].success, "success");
    } catch (error) {
      const message = error instanceof Error ? error.message : SHOP_USAGE_ACTION_COPY[action].failure;
      setActionError({ action, message, participantId });
    } finally {
      setLockedParticipant(null);
    }
  }

  async function fillFromSignup() {
    setFilling(true);
    try {
      const response = await fetch(usageEndpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "fill-from-signup" }),
      });
      const payload: unknown = await response.json();
      if (!response.ok || !isShopMeetingSurfUsageData(payload)) {
        addToast(shopUsageErrorMessage(payload, "이용 내역을 채우지 못했습니다."), "error");
        return;
      }
      const filled = (payload as { filled?: number }).filled ?? 0;
      commitServerData(payload, true);
      setFilter("confirmed");
      addToast(`${filled}명을 신청 내용대로 채웠습니다. 다르게 이용한 사람만 고쳐 주세요.`, "success");
    } catch {
      addToast("이용 내역을 채우지 못했습니다.", "error");
    } finally {
      setFilling(false);
      setFillDialogOpen(false);
    }
  }

  const canFillFromSignup = data.meeting.actualUsageReview.editable && data.summary.missingCount > 0;
  const allConfirmed = data.summary.approvedCount > 0
    && data.summary.missingCount === 0
    && data.summary.reviewCount === 0;
  const countedItems = data.itemRows.filter((row) => row.confirmedQuantity > 0);

  async function markCountsChecked() {
    setFilling(true);
    try {
      const response = await fetch(usageEndpoint, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "shop-check" }),
      });
      const payload: unknown = await response.json();
      if (!response.ok || !isShopMeetingSurfUsageData(payload)) {
        addToast(shopUsageErrorMessage(payload, "수량 확인을 기록하지 못했습니다."), "error");
        return;
      }
      commitServerData(payload, true);
      addToast("이용 수량을 확인했습니다.", "success");
    } catch {
      addToast("수량 확인을 기록하지 못했습니다.", "error");
    } finally {
      setFilling(false);
    }
  }

  return (
    <section className="space-y-5">
      {canFillFromSignup ? (
        <div className="brand-highlight-panel rounded-2xl p-4">
          <p className="text-sm font-extrabold text-brand-text">미입력 {data.summary.missingCount}명을 신청 내용대로 채울 수 있어요</p>
          <p className="brand-text-muted mt-1 break-keep text-xs leading-5">
            강습 신청 → 강습 패키지, 장비 대여 필요 → 장비대여로 기록하고 확정합니다. 그 뒤 샤워·슈트 등 다르게 이용한 사람만 고치면 됩니다.
          </p>
          <button
            className="brand-button-primary mt-3 min-h-11 w-full rounded-xl text-sm font-bold disabled:opacity-50"
            disabled={filling || dirtyParticipantIds.length > 0}
            onClick={() => setFillDialogOpen(true)}
            type="button"
          >
            신청 내용으로 한 번에 채우기
          </button>
          {dirtyParticipantIds.length > 0 ? (
            <p className="brand-text-subtle mt-2 text-xs">편집 중인 참가자를 저장하거나 취소한 뒤 사용할 수 있습니다.</p>
          ) : null}
        </div>
      ) : null}

      {data.meeting.actualUsageReview.editable && allConfirmed ? (
        <div className={`${data.meeting.shopUsageCheckedAt ? "brand-panel-white" : "brand-highlight-panel"} rounded-2xl p-4`}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-extrabold text-brand-text">샵 수량 확인</p>
            {data.meeting.shopUsageCheckedAt ? <span className="brand-chip-success rounded-full px-2.5 py-1 text-xs font-bold">확인 완료</span> : null}
          </div>
          <ul className="mt-3 divide-y divide-brand-divider">
            {countedItems.length > 0 ? countedItems.map((row) => (
              <li className="flex min-h-11 items-center justify-between text-sm" key={row.usageItemId}>
                <span className="font-bold text-brand-text">{row.name}</span>
                <span className="text-lg font-extrabold tabular-nums text-brand-text">{row.confirmedQuantity}</span>
              </li>
            )) : <li className="brand-text-muted py-2 text-sm">이용한 항목이 없습니다.</li>}
          </ul>
          <p className="brand-text-muted mt-2 text-xs">샵 청구 합계 {data.summary.confirmedShopAmount.toLocaleString("ko-KR")}원</p>
          {data.meeting.shopUsageCheckedAt ? (
            <p className="brand-text-subtle mt-2 text-xs">이용 내역이 바뀌면 다시 확인해야 합니다.</p>
          ) : (
            <button
              className="brand-button-primary mt-3 min-h-11 w-full rounded-xl text-sm font-bold disabled:opacity-50"
              disabled={filling || dirtyParticipantIds.length > 0}
              onClick={() => void markCountsChecked()}
              type="button"
            >
              수량 맞음
            </button>
          )}
        </div>
      ) : null}

      <ShopUsageParticipantReview
        actionError={actionError}
        dirtyParticipantIds={dirtyParticipantIds}
        drafts={drafts}
        filter={filter}
        itemRows={data.itemRows}
        items={activeItems}
        lockedParticipant={lockedParticipant}
        onConfirm={(participantId) => void mutateParticipant(participantId, "confirm")}
        onFilterChange={(nextFilter) => requestViewChange({ kind: "filter", value: nextFilter })}
        onOpenChange={(participantId) => requestViewChange({
          kind: "open",
          value: openParticipantId === participantId ? null : participantId,
        })}
        onQuantityChange={updateQuantity}
        onQueryChange={(nextQuery) => requestViewChange({ kind: "query", value: nextQuery })}
        onReset={() => {
          setQuery("");
          setFilter("actionable");
          setOpenParticipantId(null);
        }}
        onSave={(participantId) => void mutateParticipant(participantId, "save")}
        openParticipantId={openParticipantId}
        participants={data.participantRows}
        query={query}
        summary={data.summary}
        visibleParticipants={visibleParticipants}
      />

      <ShopUsageCatalogSection
        catalogEndpoint={catalogEndpoint}
        data={data}
        onDataChange={(nextData) => commitServerData(nextData, true)}
      />

      <Dialog
        closeLabel="계속 편집으로 돌아가기"
        description="저장하지 않은 수량을 버려야 선택한 목록으로 이동할 수 있습니다."
        onClose={() => setPendingViewChange(null)}
        open={pendingViewChange !== null}
        title="변경 내용을 버릴까요?"
      >
        <div className="grid grid-cols-2 gap-2">
          <button className="brand-button-secondary rounded-2xl px-3 py-3 text-sm font-bold" onClick={() => setPendingViewChange(null)} type="button">
            계속 편집
          </button>
          <button className="brand-button-danger-solid rounded-2xl px-3 py-3 text-sm font-bold" onClick={discardChanges} type="button">
            변경 버리기
          </button>
        </div>
      </Dialog>

      <Dialog
        description={`아직 입력하지 않은 ${data.summary.missingCount}명을 신청 내용대로 기록하고 확정합니다. 이미 입력한 참가자와 불참자는 바뀌지 않습니다.`}
        onClose={() => { if (!filling) setFillDialogOpen(false); }}
        open={fillDialogOpen}
        title="신청 내용으로 채울까요?"
      >
        <div className="grid grid-cols-2 gap-2">
          <button className="brand-button-secondary rounded-2xl px-3 py-3 text-sm font-bold" disabled={filling} onClick={() => setFillDialogOpen(false)} type="button">
            돌아가기
          </button>
          <button className="brand-button-primary rounded-2xl px-3 py-3 text-sm font-bold" disabled={filling} onClick={() => void fillFromSignup()} type="button">
            {filling ? "채우는 중" : "채우기"}
          </button>
        </div>
      </Dialog>

      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} onClose={() => removeToast(toast.id)} type={toast.type} />
      ))}
    </section>
  );
}
