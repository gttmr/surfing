import { Dialog } from "@/components/ui/Dialog";
import type { AdjustmentDeleteTarget } from "./admin-meeting-settlement-types";

export function AdjustmentDeleteDialog({
  target,
  submitting,
  onClose,
  onConfirm,
}: {
  readonly target: AdjustmentDeleteTarget;
  readonly submitting: boolean;
  readonly onClose: () => void;
  readonly onConfirm: (target: NonNullable<AdjustmentDeleteTarget>) => void;
}) {
  return (
    <Dialog
      closeLabel="청구 조정 삭제 창 닫기"
      description={target ? `${target.participantName} · ${target.label}` : undefined}
      onClose={onClose}
      open={Boolean(target)}
      title="청구 조정을 삭제할까요?"
    >
      {target ? (
        <>
          <p className="brand-text-muted text-sm">이 조정을 삭제하면 해당 참가자의 청구 금액이 다시 계산됩니다.</p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <button type="button" onClick={onClose} className="brand-button-secondary rounded-2xl px-4 py-3 text-sm font-bold">
              돌아가기
            </button>
            <button
              type="button"
              onClick={() => onConfirm(target)}
              disabled={submitting}
              className="brand-button-danger-solid rounded-2xl px-4 py-3 text-sm font-bold disabled:cursor-not-allowed"
            >
              {submitting ? "삭제 중..." : "청구 조정 삭제"}
            </button>
          </div>
        </>
      ) : null}
    </Dialog>
  );
}
