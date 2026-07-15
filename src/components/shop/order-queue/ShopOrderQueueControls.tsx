import { Icon } from "@/components/ui/Icon";
import {
  SHOP_ORDER_FILTERS,
  type ShopOrderFilter,
  type summarizeShopOrderRows,
} from "@/lib/shop-order-queue";

type Summary = ReturnType<typeof summarizeShopOrderRows>;

function updatedLabel(value: number | null): string {
  if (value === null) return "초기 화면";
  return `${new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(value)} 갱신`;
}

function filterCount(value: ShopOrderFilter, summary: Summary, total: number): number {
  if (value === "all") return total;
  return summary[value];
}

export function ShopOrderQueueControls({
  filter,
  lastUpdatedAt,
  notice,
  onDismissNotice,
  onFilterChange,
  onQueryChange,
  onRefresh,
  query,
  refreshError,
  refreshing,
  summary,
  total,
}: {
  readonly filter: ShopOrderFilter;
  readonly lastUpdatedAt: number | null;
  readonly notice: string | null;
  readonly onDismissNotice: () => void;
  readonly onFilterChange: (value: ShopOrderFilter) => void;
  readonly onQueryChange: (value: string) => void;
  readonly onRefresh: () => void;
  readonly query: string;
  readonly refreshError: string | null;
  readonly refreshing: boolean;
  readonly summary: Summary;
  readonly total: number;
}) {
  return (
    <section aria-labelledby="shop-order-queue-title" className="space-y-4">
      <div className="flex items-start justify-between gap-3 px-1">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2 text-[11px] font-bold text-[var(--brand-text-subtle)]">
            <span aria-hidden className={`h-2 w-2 rounded-full ${refreshError ? "bg-[var(--brand-danger)]" : "bg-[var(--brand-success)]"}`} />
            <span>{refreshError ? "동기화 지연" : "5초마다 자동 갱신"}</span>
          </div>
          <h1 className="text-[1.65rem] font-extrabold leading-tight tracking-[-0.04em] text-[var(--brand-text)]" id="shop-order-queue-title">
            실시간 주문 큐
          </h1>
          <p className="brand-text-subtle mt-1 text-xs">오래 들어온 주문부터 차례로 보여드려요.</p>
        </div>
        <button
          aria-label="주문 목록 새로고침"
          className="brand-button-secondary flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
          disabled={refreshing}
          onClick={onRefresh}
          type="button"
        >
          <Icon className="text-[20px]" name={refreshing ? "hourglass_top" : "refresh"} />
        </button>
      </div>

      <div className="brand-highlight-panel overflow-hidden rounded-[1.75rem]">
        <div className="grid grid-cols-[1.3fr_1fr_1fr] divide-x divide-[var(--brand-divider-strong)]">
          <div className="px-4 py-4">
            <p className="text-[11px] font-bold opacity-70">처리할 주문</p>
            <p className="mt-1 text-[1.8rem] font-extrabold leading-none tracking-[-0.04em]">{summary.active}<span className="ml-0.5 text-sm">건</span></p>
          </div>
          <div className="px-3 py-4 text-center">
            <p className="text-[11px] font-bold opacity-70">접수</p>
            <p className="mt-1 text-xl font-extrabold">{summary.received}</p>
          </div>
          <div className="px-3 py-4 text-center">
            <p className="text-[11px] font-bold opacity-70">준비 중</p>
            <p className="mt-1 text-xl font-extrabold">{summary.preparing}</p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <label className="relative block">
          <span className="sr-only">주문 검색</span>
          <Icon className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[20px] text-[var(--brand-text-subtle)]" name="search" />
          <input
            aria-label="주문 검색"
            className="brand-input w-full rounded-2xl py-3 pl-12 pr-4 text-sm outline-none"
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="이름, 메뉴, 상태 검색"
            type="search"
            value={query}
          />
        </label>

        <div aria-label="주문 상태 필터" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1" role="group">
          {SHOP_ORDER_FILTERS.map((item) => {
            const active = filter === item.value;
            return (
              <button
                aria-pressed={active}
                className={`shrink-0 rounded-full px-3.5 py-2 text-xs font-bold ${active ? "brand-chip-dark" : "brand-button-secondary"}`}
                key={item.value}
                onClick={() => onFilterChange(item.value)}
                type="button"
              >
                {item.label} {filterCount(item.value, summary, total)}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex min-h-5 items-center justify-between gap-3 px-1 text-[11px]">
        <span className="brand-text-subtle">{updatedLabel(lastUpdatedAt)}</span>
        {refreshing ? <span className="font-bold text-[var(--brand-primary-text)]" role="status">확인 중…</span> : null}
      </div>

      {refreshError ? (
        <div className="brand-alert-error flex items-center justify-between gap-3 rounded-2xl px-4 py-3" role="alert">
          <div className="min-w-0">
            <p className="text-sm font-bold">최근 주문을 불러오지 못했습니다.</p>
            <p className="mt-0.5 text-xs">기존 목록을 유지하고 있습니다.</p>
          </div>
          <button className="brand-button-danger shrink-0 rounded-xl px-3 py-2 text-xs font-bold" onClick={onRefresh} type="button">다시 시도</button>
        </div>
      ) : null}

      {notice ? (
        <div className="brand-alert-info flex items-start justify-between gap-3 rounded-2xl px-4 py-3" role="status">
          <p className="text-sm font-semibold">{notice}</p>
          <button aria-label="상태 안내 닫기" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full" onClick={onDismissNotice} type="button">
            <Icon className="text-[18px]" name="close" />
          </button>
        </div>
      ) : null}
    </section>
  );
}
