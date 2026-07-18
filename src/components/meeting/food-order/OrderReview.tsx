import { Icon } from "@/components/ui/Icon";
import { formatWon } from "@/lib/format";
import type { SelectedOrderLine } from "@/lib/participant-order-ui";

type CartSummary = {
  readonly totalQuantity: number;
  readonly subtotal: number;
  readonly supportRemaining: number;
  readonly supportApplied: number;
  readonly billableAmount: number;
};

export function OrderReview({
  participantName,
  editing,
  lines,
  summary,
  message,
}: {
  readonly participantName: string;
  readonly editing: boolean;
  readonly lines: readonly SelectedOrderLine[];
  readonly summary: CartSummary;
  readonly message: string;
}) {
  return (
    <section aria-labelledby="order-review-title" className="space-y-4 pb-5">
      <div className="brand-panel-strong rounded-3xl p-4">
        <div className="flex items-start gap-3">
          <span className="brand-chip-dark flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl">
            <Icon className="text-[21px]" name="fact_check" />
          </span>
          <div>
            <h3 className="text-base font-extrabold text-[var(--brand-text)]" id="order-review-title">
              {editing ? "수정 내용을 확인해 주세요" : "주문 전 마지막 확인"}
            </h3>
            <p className="brand-text-subtle mt-1 text-xs leading-5">
              {participantName} 이름으로 {editing ? "기존 주문 전체를 바꿉니다." : "새 주문을 추가합니다."}
            </p>
          </div>
        </div>
      </div>

      {message ? <div className="brand-alert-error rounded-2xl px-4 py-3 text-sm" role="alert">{message}</div> : null}

      <div className="space-y-2" aria-label="검토할 메뉴">
        {lines.map((line) => (
          <article className="brand-list-item rounded-2xl px-4 py-3" key={line.key}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="break-words text-sm font-bold leading-5 text-[var(--brand-text)]">{line.label}</p>
                <p className="brand-text-subtle mt-1 text-xs">{formatWon(line.price)} × {line.quantity}</p>
              </div>
              <p className="shrink-0 text-sm font-extrabold text-[var(--brand-text)]">{formatWon(line.total)}</p>
            </div>
          </article>
        ))}
      </div>

      <dl className="brand-inset-panel space-y-2 rounded-3xl p-4 text-sm">
        <div className="flex justify-between gap-3"><dt className="brand-text-subtle">메뉴 {summary.totalQuantity}개</dt><dd className="font-bold">{formatWon(summary.subtotal)}</dd></div>
        <div className="flex justify-between gap-3"><dt className="brand-text-subtle">남은 지원 {formatWon(summary.supportRemaining)}</dt><dd className="font-bold text-[var(--brand-success-text)]">{summary.supportApplied > 0 ? `-${formatWon(summary.supportApplied)}` : formatWon(0)}</dd></div>
        <div className="flex justify-between gap-3 border-t border-[var(--brand-divider)] pt-2"><dt className="font-extrabold">청구금액</dt><dd className={`font-extrabold ${summary.billableAmount > 0 ? "text-[var(--brand-danger)]" : "text-[var(--brand-success-text)]"}`}>{summary.billableAmount > 0 ? formatWon(summary.billableAmount) : "없음"}</dd></div>
      </dl>
    </section>
  );
}

export function OrderReviewFooter({
  editing,
  saving,
  onBack,
  onSubmit,
}: {
  readonly editing: boolean;
  readonly saving: boolean;
  readonly onBack: () => void;
  readonly onSubmit: () => void;
}) {
  return (
    <div className="grid grid-cols-[0.8fr_1.2fr] gap-2">
      <button className="brand-button-secondary min-h-11 rounded-2xl px-3 text-sm font-bold" disabled={saving} onClick={onBack} type="button">다시 고르기</button>
      <button className="brand-button-primary min-h-11 rounded-2xl px-3 text-sm font-bold disabled:cursor-not-allowed" disabled={saving} onClick={onSubmit} type="button">
        {saving ? "처리 중..." : editing ? "이 내용으로 수정" : "이 내용으로 주문"}
      </button>
    </div>
  );
}
