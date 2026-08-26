import type { AdminSettlementParticipant } from "@/lib/admin-page-data";
import { formatWon } from "@/lib/format";

export function AdminOvernightLodgingPanel({
  participants,
  selectedParticipantIds,
  label,
  amount,
  editable,
  submitting,
  onToggleParticipant,
  onSelectAll,
  onLabelChange,
  onAmountChange,
  onSubmit,
}: {
  readonly participants: readonly AdminSettlementParticipant[];
  readonly selectedParticipantIds: readonly number[];
  readonly label: string;
  readonly amount: string;
  readonly editable: boolean;
  readonly submitting: boolean;
  readonly onToggleParticipant: (participantId: number) => void;
  readonly onSelectAll: () => void;
  readonly onLabelChange: (value: string) => void;
  readonly onAmountChange: (value: string) => void;
  readonly onSubmit: () => void;
}) {
  const selected = new Set(selectedParticipantIds);
  const amountValue = Number(amount);
  const previewTotal = Number.isInteger(amountValue) && amountValue > 0
    ? amountValue * selected.size
    : 0;

  return (
    <section className="brand-admin-section overflow-hidden">
      <div className="brand-admin-section-header px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold text-brand-text">공동 숙박비 반영</h2>
            <p className="brand-text-muted mt-1 break-keep text-xs">신청 때 공동 숙박을 선택한 회원에게 1인 금액을 한 번만 추가합니다.</p>
          </div>
          <span className="brand-chip-accent shrink-0 rounded-full px-2.5 py-1 text-xs font-bold">{participants.length}명</span>
        </div>
      </div>

      {participants.length === 0 ? (
        <div className="px-4 py-5 text-sm brand-text-subtle">공동 숙박을 선택한 참가자가 없습니다.</div>
      ) : !editable ? (
        <div className="px-4 py-4 text-xs font-semibold brand-text-subtle">검토 완료를 취소하면 숙박비를 추가할 수 있습니다.</div>
      ) : (
        <div className="space-y-4 px-4 py-4">
          <div>
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs font-bold text-brand-text">반영할 회원</p>
              <button className="min-h-11 px-2 text-xs font-bold text-brand-primary" onClick={onSelectAll} type="button">
                {selected.size === participants.length ? "전체 해제" : "전체 선택"}
              </button>
            </div>
            <div className="divide-y divide-brand-divider rounded-2xl border border-brand-divider bg-brand-surface-elevated px-3">
              {participants.map((participant) => (
                <label className="flex min-h-12 cursor-pointer items-center gap-3 py-2 text-sm font-semibold text-brand-text" key={participant.id}>
                  <input
                    checked={selected.has(participant.id)}
                    className="h-5 w-5 accent-brand-primary"
                    onChange={() => onToggleParticipant(participant.id)}
                    type="checkbox"
                  />
                  <span className="min-w-0 flex-1 truncate">{participant.name}{participant.companionId ? " (동반)" : ""}</span>
                </label>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-brand-text">항목명</span>
            <input className="brand-input min-h-12 w-full rounded-xl px-3 text-base" maxLength={60} onChange={(event) => onLabelChange(event.target.value)} value={label} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-bold text-brand-text">1인 숙박비</span>
            <input
              className="brand-input min-h-12 w-full rounded-xl px-3 text-base"
              inputMode="numeric"
              onChange={(event) => onAmountChange(event.target.value.replace(/[^0-9]/g, ""))}
              pattern="[0-9]*"
              placeholder="예: 50000"
              value={amount}
            />
          </label>
          <div className="flex items-center justify-between rounded-xl bg-brand-primary-soft px-3 py-3 text-sm">
            <span className="font-semibold text-brand-text">{selected.size}명에게 추가</span>
            <strong className="text-brand-primary">합계 {formatWon(previewTotal)}</strong>
          </div>
          <button
            className="brand-button-primary min-h-12 w-full rounded-xl px-4 text-sm font-extrabold disabled:opacity-50"
            disabled={submitting || selected.size === 0 || !label.trim() || previewTotal === 0}
            onClick={onSubmit}
            type="button"
          >
            {submitting ? "숙박비 반영 중" : "선택 회원에게 숙박비 추가"}
          </button>
          <p className="brand-text-subtle break-keep text-xs">이미 반영한 회원에게 다시 실행하면 금액이 한 번 더 추가됩니다. 잘못 추가한 항목은 회원별 청구에서 삭제할 수 있습니다.</p>
        </div>
      )}
    </section>
  );
}
