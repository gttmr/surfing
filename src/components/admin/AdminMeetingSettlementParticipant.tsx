import type { AdminSettlementParticipant } from "@/lib/admin-page-data";
import { formatWon } from "@/lib/format";
import type {
  AdjustmentDeleteTarget,
  SettlementDraft,
  SettlementDraftChange,
} from "./admin-meeting-settlement-types";

export function AdminMeetingSettlementParticipant({
  participant,
  showAmounts,
  draft,
  submitting,
  onDraftChange,
  onAddAdjustment,
  onRequestDelete,
}: {
  readonly participant: AdminSettlementParticipant;
  readonly showAmounts: boolean;
  readonly draft: SettlementDraft;
  readonly submitting: boolean;
  readonly onDraftChange: SettlementDraftChange;
  readonly onAddAdjustment: (participantId: number) => void;
  readonly onRequestDelete: (target: NonNullable<AdjustmentDeleteTarget>) => void;
}) {
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
              참가 {formatWon(participant.breakdown.baseFee)} · 강습 {formatWon(participant.breakdown.lessonFee)} · 대여 {formatWon(participant.breakdown.rentalFee)}
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

      {participant.foodOrders.length > 0 ? (
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
              <button
                type="button"
                onClick={() => onRequestDelete({ id: adjustment.id, label: adjustment.label, participantName: participant.name })}
                className="brand-button-danger min-h-11 shrink-0 rounded-full px-4 py-2 text-xs font-bold transition-colors"
              >
                삭제
              </button>
            </div>
          ))
        ) : (
          <div className="brand-card-soft rounded-2xl px-4 py-4 text-sm brand-text-subtle">추가/차감 항목이 없습니다.</div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold text-brand-text">조정 항목명</span>
          <input
            aria-label={`${participant.name} 조정 항목명`}
            value={draft.label}
            onChange={(event) => onDraftChange(participant.id, "label", event.target.value)}
            placeholder="예: 현장 할인"
            className="brand-input min-w-0 w-full rounded-2xl px-3 py-3 text-sm outline-none"
            id={`settlement-adjustment-label-${participant.id}`}
          />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-bold text-brand-text">조정 금액</span>
          <input
            aria-label={`${participant.name} 조정 금액`}
            value={draft.amount}
            onChange={(event) => onDraftChange(participant.id, "amount", event.target.value)}
            inputMode="decimal"
            pattern="[+-]?[0-9]*"
            placeholder="예: -5000"
            className="brand-input min-w-0 w-full rounded-2xl px-3 py-3 text-sm outline-none"
            id={`settlement-adjustment-amount-${participant.id}`}
          />
        </label>
        <button
          type="button"
          onClick={() => onAddAdjustment(participant.id)}
          disabled={submitting}
          className="brand-button-primary col-span-2 rounded-2xl px-4 py-3 text-sm font-bold"
        >
          {submitting ? "추가 중..." : "조정 추가"}
        </button>
      </div>
    </div>
  );
}
