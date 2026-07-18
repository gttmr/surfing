import { Dialog } from "@/components/ui/Dialog";
import type { AdjustmentDeleteTarget } from "./admin-meeting-settlement-types";

export function SettlementOpenDialog({
  open,
  submitting,
  onClose,
  onConfirm,
}: {
  readonly open: boolean;
  readonly submitting: boolean;
  readonly onClose: () => void;
  readonly onConfirm: () => void;
}) {
  return (
    <Dialog
      closeLabel="정산 열기 창 닫기"
      onClose={onClose}
      open={open}
      title="정산을 열까요?"
    >
      <p className="brand-text-muted text-sm">
        정산을 열면 참가자와 수신자에게 금액이 표시되고, 기존 확인 기록은 초기화됩니다.
      </p>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <button type="button" onClick={onClose} className="brand-button-secondary rounded-2xl px-4 py-3 text-sm font-bold">
          돌아가기
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={submitting}
          className="brand-button-primary rounded-2xl px-4 py-3 text-sm font-bold disabled:cursor-not-allowed"
        >
          {submitting ? "여는 중..." : "정산 열기"}
        </button>
      </div>
    </Dialog>
  );
}

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
      closeLabel="정산 항목 삭제 창 닫기"
      description={target ? `${target.participantName} · ${target.label}` : undefined}
      onClose={onClose}
      open={Boolean(target)}
      title="정산 항목을 삭제할까요?"
    >
      {target ? (
        <>
          <p className="brand-text-muted text-sm">이 조정 항목을 삭제하면 해당 참가자의 정산 금액이 다시 계산됩니다.</p>
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
              {submitting ? "삭제 중..." : "정산 항목 삭제"}
            </button>
          </div>
        </>
      ) : null}
    </Dialog>
  );
}
