import { formatWon } from "@/lib/format";

type CartSummary = {
  readonly totalQuantity: number;
  readonly subtotal: number;
  readonly supportApplied: number;
  readonly billableAmount: number;
};

export function OrderCartFooter({
  summary,
  editing,
  disabled,
  onReview,
}: {
  readonly summary: CartSummary;
  readonly editing: boolean;
  readonly disabled: boolean;
  readonly onReview: () => void;
}) {
  return (
    <section aria-label="주문 장바구니 요약">
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p aria-live="polite" className="text-sm font-extrabold text-brand-text">
            {editing ? "수정할 메뉴" : "담은 메뉴"} {summary.totalQuantity}개
          </p>
          <p className="brand-text-subtle mt-1 text-xs">
            합계 {formatWon(summary.subtotal)} · 지원 {summary.supportApplied > 0 ? `-${formatWon(summary.supportApplied)}` : formatWon(0)}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="brand-text-subtle text-[10px] font-bold">청구금액</p>
          <p className={`text-base font-extrabold ${summary.billableAmount > 0 ? "text-brand-danger" : "text-brand-success-text"}`}>
            {summary.billableAmount > 0 ? formatWon(summary.billableAmount) : "없음"}
          </p>
        </div>
      </div>
      <button
        className="brand-button-primary mt-3 min-h-11 w-full rounded-2xl px-4 text-sm font-bold disabled:cursor-not-allowed"
        disabled={disabled || summary.totalQuantity === 0}
        onClick={onReview}
        type="button"
      >
        {editing ? "수정 내용 검토" : "주문 내용 검토"}
      </button>
    </section>
  );
}
