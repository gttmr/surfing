import { ShopUsageParticipantRow, type ShopUsageActionError } from "@/components/shop/ShopUsageParticipantRow";
import { AsyncState } from "@/components/ui/AsyncState";
import { Icon } from "@/components/ui/Icon";
import type { ShopMeetingSurfUsageData } from "@/lib/surf-usage-data";
import {
  getShopUsageFilterCount,
  SHOP_USAGE_FILTERS,
  type ShopUsageDrafts,
  type ShopUsageFilter,
  type ShopUsageParticipant,
} from "./shop-usage-review";

type UsageItem = ShopMeetingSurfUsageData["usageItems"][number];
type UsageSummary = ShopMeetingSurfUsageData["summary"];
type UsageItemRow = ShopMeetingSurfUsageData["itemRows"][number];

function ProgressSummary({ dirtyCount, summary }: {
  readonly dirtyCount: number;
  readonly summary: UsageSummary;
}) {
  const progress = summary.approvedCount === 0
    ? 0
    : Math.round((summary.confirmedCount / summary.approvedCount) * 100);
  return (
    <aside
      aria-label="이용 확인 진행 요약"
      className="brand-card-soft sticky bottom-[calc(var(--brand-dock-clearance)+var(--brand-safe-bottom)+0.75rem)] z-20 rounded-2xl px-4 py-2.5"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-extrabold text-brand-text">확정 {summary.confirmedCount}/{summary.approvedCount}명</p>
          <p className="brand-text-subtle mt-0.5 text-[11px]">미제출 {summary.missingCount} · 확인 필요 {summary.reviewCount}</p>
        </div>
        <span className={dirtyCount > 0 ? "brand-chip-preparing rounded-full px-2.5 py-1 text-[11px] font-bold" : "brand-chip-success rounded-full px-2.5 py-1 text-[11px] font-bold"}>
          {dirtyCount > 0 ? `저장 안 됨 ${dirtyCount}` : `${progress}% 완료`}
        </span>
      </div>
      <progress aria-label="이용 내역 확정 진행률" className="mt-1.5 h-1 w-full accent-brand-success" max={100} value={progress} />
    </aside>
  );
}

function ItemTotals({ rows }: { readonly rows: readonly UsageItemRow[] }) {
  const usedRows = rows.filter((row) => row.quantity > 0 || row.confirmedQuantity > 0);
  return (
    <details className="brand-panel-white overflow-hidden rounded-2xl">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-extrabold text-brand-text">
        <span>항목별 확정 합계</span>
        <span className="brand-chip-soft rounded-full px-2 py-1 text-[11px]">{usedRows.length}개 항목</span>
      </summary>
      <div className="border-t border-brand-divider">
        {usedRows.length > 0 ? usedRows.map((row) => (
          <div className="grid grid-cols-[minmax(0,1fr)_4rem] gap-2 border-b border-brand-divider px-4 py-3 text-sm last:border-b-0" key={row.usageItemId}>
            <span className="truncate font-semibold text-brand-text">{row.name}</span>
            <span className="text-right font-extrabold text-brand-text">{row.confirmedQuantity}/{row.quantity}</span>
          </div>
        )) : <p className="brand-text-subtle px-4 py-5 text-center text-xs">집계할 이용 내역이 없습니다.</p>}
      </div>
    </details>
  );
}

export function ShopUsageParticipantReview({
  actionError,
  dirtyParticipantIds,
  drafts,
  filter,
  itemRows,
  items,
  lockedParticipant,
  onConfirm,
  onFilterChange,
  onOpenChange,
  onQuantityChange,
  onQueryChange,
  onReset,
  onSave,
  openParticipantId,
  participants,
  query,
  summary,
  visibleParticipants,
}: {
  readonly actionError: ShopUsageActionError | null;
  readonly dirtyParticipantIds: readonly number[];
  readonly drafts: ShopUsageDrafts;
  readonly filter: ShopUsageFilter;
  readonly itemRows: readonly UsageItemRow[];
  readonly items: readonly UsageItem[];
  readonly lockedParticipant: { readonly action: "save" | "confirm"; readonly participantId: number } | null;
  readonly onConfirm: (participantId: number) => void;
  readonly onFilterChange: (filter: ShopUsageFilter) => void;
  readonly onOpenChange: (participantId: number) => void;
  readonly onQuantityChange: (participantId: number, usageItemId: number, quantity: number) => void;
  readonly onQueryChange: (query: string) => void;
  readonly onReset: () => void;
  readonly onSave: (participantId: number) => void;
  readonly openParticipantId: number | null;
  readonly participants: readonly ShopUsageParticipant[];
  readonly query: string;
  readonly summary: UsageSummary;
  readonly visibleParticipants: readonly ShopUsageParticipant[];
}) {
  return (
    <section aria-labelledby="usage-review-title" className="space-y-3">
      <div className="px-1">
        <h1 className="text-base font-extrabold text-brand-text" id="usage-review-title">참가자 이용 확인</h1>
      </div>

      <ProgressSummary dirtyCount={dirtyParticipantIds.length} summary={summary} />

      <label className="relative block">
        <span className="sr-only">참가자 이용 검색</span>
        <Icon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-brand-text-subtle" name="search" />
        <input
          aria-label="참가자 이용 검색"
          className="brand-input w-full rounded-2xl py-3 pl-12 pr-4 text-sm outline-none"
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="이름 또는 신청 내용 검색"
          type="search"
          value={query}
        />
      </label>

      <div aria-label="참가자 이용 상태 필터" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group">
        {SHOP_USAGE_FILTERS.map((item) => (
          <button
            aria-pressed={filter === item.value}
            className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold ${filter === item.value ? "brand-chip-dark" : "brand-button-secondary"}`}
            key={item.value}
            onClick={() => onFilterChange(item.value)}
            type="button"
          >
            {item.label} {getShopUsageFilterCount(participants, item.value)}
          </button>
        ))}
      </div>

      <div className="space-y-2 pb-24">
        {visibleParticipants.map((participant) => (
          <ShopUsageParticipantRow
            actionError={actionError?.participantId === participant.participantId ? actionError : null}
            dirty={dirtyParticipantIds.includes(participant.participantId)}
            items={items}
            key={participant.participantId}
            lockedAction={lockedParticipant?.participantId === participant.participantId ? lockedParticipant.action : null}
            onConfirm={onConfirm}
            onQuantityChange={onQuantityChange}
            onSave={onSave}
            onToggle={onOpenChange}
            open={openParticipantId === participant.participantId}
            participant={participant}
            values={drafts[participant.participantId] ?? {}}
          />
        ))}
        {visibleParticipants.length === 0 ? (
          summary.approvedCount > 0 && summary.confirmedCount === summary.approvedCount && !query ? (
            <div className="brand-alert-success rounded-2xl px-4 py-6 text-center" role="status">
              <Icon className="text-[28px]" name="task_alt" />
              <p className="mt-2 text-sm font-extrabold">모든 실제 이용을 확정했습니다</p>
              <button className="brand-link mt-2 text-xs font-bold" onClick={() => onFilterChange("confirmed")} type="button">확정 내역 보기</button>
            </div>
          ) : (
            <AsyncState
              actionLabel="검색·필터 초기화"
              description="검색어를 지우거나 다른 상태를 선택해 주세요."
              kind="empty"
              onAction={onReset}
              title="조건에 맞는 참가자가 없습니다."
            />
          )
        ) : null}
      </div>

      <ItemTotals rows={itemRows} />
    </section>
  );
}
