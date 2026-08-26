import type { AdminSettlementParticipant } from "@/lib/admin-page-data";
import { formatWon } from "@/lib/format";
import { getSurfUsageLineMemberAmount } from "@/lib/surf-usage-billing";
import type {
  AdjustmentDeleteTarget,
  SettlementDraft,
  SettlementDraftChange,
} from "./admin-meeting-settlement-types";

export function AdminMeetingSettlementParticipant({
  participant,
  showAmounts,
  editable,
  draft,
  submitting,
  onDraftChange,
  onAddAdjustment,
  onRequestDelete,
}: {
  readonly participant: AdminSettlementParticipant;
  readonly showAmounts: boolean;
  readonly editable: boolean;
  readonly draft: SettlementDraft;
  readonly submitting: boolean;
  readonly onDraftChange: SettlementDraftChange;
  readonly onAddAdjustment: (participantId: number) => void;
  readonly onRequestDelete: (target: NonNullable<AdjustmentDeleteTarget>) => void;
}) {
  const amountDescriptionId = `settlement-adjustment-amount-description-${participant.id}`;

  return (
    <div className="pb-1">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-extrabold text-brand-text">
            {participant.name}
            {participant.companionId ? " (동반)" : ""}
          </p>
          {showAmounts ? (
            <p className="brand-text-subtle mt-1 text-xs">
              {participant.dailyBreakdowns
                ? `기본 참가비 1회 ${formatWon(participant.breakdown.baseFee)}${participant.breakdown.lodgingFee > 0 ? ` · 숙박 ${formatWon(participant.breakdown.lodgingFee)}` : ""}`
                : `참가 ${formatWon(participant.breakdown.baseFee)} · 강습 ${formatWon(participant.breakdown.lessonFee)} · 대여 ${formatWon(participant.breakdown.rentalFee)}`}
              {participant.breakdown.surfUsageShopFee > 0
                ? ` · 샵이용 회원청구 ${formatWon(participant.breakdown.surfUsageMemberFee)}`
                : ""}
              {participant.breakdown.foodSubtotal > 0
                ? ` · 식음료 ${formatWon(participant.breakdown.foodSubtotal)} · 지원 -${formatWon(participant.breakdown.foodSupportApplied)}`
                : ""}
            </p>
          ) : (
            <p className="brand-text-subtle mt-1 text-xs">금액 비공개</p>
          )}
          {showAmounts && participant.breakdown.surfUsageShopFee > 0 ? (
            <p className="brand-text-subtle mt-1 text-xs">
              샵 청구 {formatWon(participant.breakdown.surfUsageShopFee)} · 운영 부담 {formatWon(participant.breakdown.surfUsageCoveredFee)}
            </p>
          ) : null}
        </div>
        {showAmounts ? (
          <span className="brand-chip-accent shrink-0 rounded-full px-2.5 py-1 text-xs font-bold">
            {formatWon(participant.breakdown.totalFee)}
          </span>
        ) : null}
      </div>

      {showAmounts && participant.dailyBreakdowns ? (
        <div className="mb-4 grid gap-2">
          {participant.dailyBreakdowns.map((day) => (
            <section className="rounded-2xl border border-brand-divider bg-brand-surface-elevated px-3 py-3" key={day.meetingId}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-extrabold text-brand-text">{day.label} · {day.date}</p>
                  <p className="brand-text-subtle mt-1 text-[11px]">기본 참가비 제외</p>
                </div>
                <strong className="text-sm text-brand-text">{formatWon(day.totalFee)}</strong>
              </div>
              {day.surfUsageLines.length > 0 ? (
                <div className="mt-3 border-t border-brand-divider pt-2">
                  <p className="brand-text-subtle text-[11px] font-bold">실제 이용</p>
                  <div className="mt-1.5 space-y-1.5">
                    {day.surfUsageLines.map((line) => (
                      <div className="flex items-start justify-between gap-3 text-xs" key={line.id}>
                        <span className="min-w-0 text-brand-text">{line.usageItemName} × {line.quantity}</span>
                        <span className="shrink-0 brand-text-muted">회원 {formatWon(getSurfUsageLineMemberAmount(line))} · 샵 {formatWon(line.shopUnitPrice * line.quantity)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="brand-text-subtle mt-3 border-t border-brand-divider pt-2 text-xs">실제 이용 없음</p>
              )}
              <dl className="brand-text-muted mt-2 space-y-1 text-xs">
                {day.foodSubtotal > 0 ? <div className="flex justify-between gap-3"><dt>식음료 · 지원 적용 후</dt><dd>{formatWon(day.foodCharge)}</dd></div> : null}
                {day.adjustmentFee !== 0 ? <div className="flex justify-between gap-3"><dt>추가·차감</dt><dd>{formatWon(day.adjustmentFee)}</dd></div> : null}
              </dl>
            </section>
          ))}
        </div>
      ) : null}

      {participant.foodOrders.length > 0 && !participant.dailyBreakdowns ? (
        <div className="mb-4 space-y-2">
          {participant.foodOrders.map((item) => (
            <div key={item.id} className="brand-panel-white flex items-center justify-between gap-4 rounded-2xl px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-brand-text">
                  {item.optionChoiceLabelSnapshot
                    ? `${item.menuNameSnapshot} · ${item.optionChoiceLabelSnapshot}`
                    : item.menuNameSnapshot}
                </p>
                {showAmounts ? (
                  <p className="brand-text-subtle mt-1 text-xs">
                    {formatWon(item.unitPriceSnapshot)} · 수량 {item.quantity}
                  </p>
                ) : null}
              </div>
              {showAmounts ? (
                <span className="shrink-0 text-sm font-bold text-brand-text">
                  {formatWon(item.unitPriceSnapshot * item.quantity)}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <div className="mb-4 space-y-2">
        {participant.adjustments.length > 0 ? (
          participant.adjustments.map((adjustment) => (
            <div key={adjustment.id} className="brand-card-soft flex items-center justify-between gap-3 rounded-2xl px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-brand-text">{adjustment.label}</p>
                {showAmounts ? (
                  <p className={`text-xs font-bold ${adjustment.amount >= 0 ? "text-brand-companion" : "text-brand-primary-text"}`}>
                    {adjustment.amount >= 0 ? "+" : ""}{formatWon(adjustment.amount)}
                  </p>
                ) : (
                  <p className="brand-text-subtle text-xs">금액 비공개</p>
                )}
              </div>
              {editable ? <button
                type="button"
                onClick={() => onRequestDelete({ id: adjustment.id, label: adjustment.label, participantName: participant.name })}
                className="brand-button-danger min-h-11 shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-colors"
              >
                삭제
              </button> : null}
            </div>
          ))
        ) : (
          <div className="brand-card-soft rounded-2xl px-4 py-4 text-sm brand-text-subtle">추가/차감 항목이 없습니다.</div>
        )}
      </div>

      {editable ? <div className="space-y-3">
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold text-brand-text">조정 항목명</span>
          <input
            aria-label={`${participant.name} 조정 항목명`}
            value={draft.label}
            onChange={(event) => onDraftChange(participant.id, { label: event.target.value })}
            placeholder="예: 현장 할인"
            className="brand-input min-w-0 w-full rounded-2xl px-3 py-3 text-sm outline-none"
            id={`settlement-adjustment-label-${participant.id}`}
          />
        </label>
        <fieldset>
          <legend className="mb-1.5 block text-xs font-bold text-brand-text">금액 반영 방식</legend>
          <div className="grid grid-cols-2 gap-2">
            <button
              aria-pressed={draft.direction === "increase"}
              className={`min-h-11 rounded-xl px-3 text-sm font-bold ${draft.direction === "increase" ? "brand-toggle-active" : "brand-button-secondary"}`}
              onClick={() => onDraftChange(participant.id, { direction: "increase" })}
              type="button"
            >
              청구에 추가 +
            </button>
            <button
              aria-pressed={draft.direction === "deduct"}
              className={`min-h-11 rounded-xl px-3 text-sm font-bold ${draft.direction === "deduct" ? "brand-toggle-active" : "brand-button-secondary"}`}
              onClick={() => onDraftChange(participant.id, { direction: "deduct" })}
              type="button"
            >
              청구에서 차감 −
            </button>
          </div>
        </fieldset>
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold text-brand-text">금액</span>
          <input
            aria-label={`${participant.name} 조정 금액`}
            aria-describedby={amountDescriptionId}
            value={draft.amount}
            onChange={(event) => {
              const rawValue = event.target.value;
              const trimmedValue = rawValue.trimStart();
              onDraftChange(participant.id, {
                amount: rawValue.replace(/[^0-9]/g, ""),
                ...(trimmedValue.startsWith("-") ? { direction: "deduct" as const } : {}),
                ...(trimmedValue.startsWith("+") ? { direction: "increase" as const } : {}),
              });
            }}
            inputMode="numeric"
            pattern="[0-9]*"
            placeholder="예: 5000"
            className="brand-input min-w-0 w-full rounded-2xl px-3 py-3 text-sm outline-none"
            id={`settlement-adjustment-amount-${participant.id}`}
          />
        </label>
        <p className="brand-text-subtle text-xs" id={amountDescriptionId}>
          {draft.direction === "deduct"
            ? "입력한 금액만큼 최종 청구액에서 뺍니다."
            : "입력한 금액만큼 최종 청구액에 더합니다."}
        </p>
        <button
          type="button"
          onClick={() => onAddAdjustment(participant.id)}
          disabled={submitting}
          className="brand-button-primary min-h-12 w-full rounded-2xl px-4 py-3 text-sm font-bold"
        >
          {submitting ? "추가 중..." : "조정 추가"}
        </button>
      </div> : <p className="brand-text-subtle rounded-xl bg-brand-dimmed-surface px-3 py-3 text-xs font-semibold">검토 완료 후에는 금액이 잠깁니다. 수정하려면 먼저 검토 완료를 취소해 주세요.</p>}
    </div>
  );
}
