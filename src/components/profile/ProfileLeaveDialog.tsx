"use client";

import { Dialog } from "@/components/ui/Dialog";

export function ProfileLeaveDialog({
  open,
  onStay,
  onDiscard,
}: {
  readonly open: boolean;
  readonly onStay: () => void;
  readonly onDiscard: () => void;
}) {
  return (
    <Dialog
      description="저장하지 않은 프로필 변경 내용은 복구할 수 없습니다."
      onClose={onStay}
      open={open}
      title="변경 내용을 버릴까요?"
    >
      <div className="flex gap-3">
        <button
          className="brand-button-secondary min-h-11 flex-1 rounded-2xl px-4 text-sm font-bold"
          onClick={onStay}
          type="button"
        >
          계속 편집
        </button>
        <button
          className="brand-button-danger-solid min-h-11 flex-1 rounded-2xl px-4 text-sm font-bold"
          onClick={onDiscard}
          type="button"
        >
          버리고 이동
        </button>
      </div>
    </Dialog>
  );
}
