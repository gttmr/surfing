"use client";

import { useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import type { ShopOrderActionOptions, ShopOrderActionTarget } from "./types";

const CANCEL_REASONS = [
  { value: "sold_out", label: "품절" },
  { value: "duplicate", label: "중복 주문" },
  { value: "customer_request", label: "고객 요청" },
  { value: "other", label: "기타" },
] as const;

type CancelReason = (typeof CANCEL_REASONS)[number]["value"];

function isCancelReason(value: string): value is CancelReason {
  return CANCEL_REASONS.some((reason) => reason.value === value);
}

function dialogCopy(target: NonNullable<ShopOrderActionTarget>) {
  if (target.action === "undo_prepare") {
    return {
      title: "준비 상태를 되돌릴까요?",
      description: `${target.row.participantName} · ${target.row.menuName}`,
      body: "준비 중 표시를 해제하고 접수 상태로 되돌립니다. 주문은 그대로 유지됩니다.",
      confirm: "준비 취소",
    };
  }
  if (target.action === "undo_serve") {
    return {
      title: "완료 처리를 되돌릴까요?",
      description: `${target.row.participantName} · ${target.row.menuName}`,
      body: "전달 완료 표시를 해제하고 접수 상태로 되돌립니다. 실제 전달 여부를 먼저 확인해 주세요.",
      confirm: "완료 취소",
    };
  }
  return {
    title: "주문을 취소할까요?",
    description: `${target.row.participantName} · ${target.row.menuName}`,
    body: "취소 내역은 보관되며 참가자에게 사유와 함께 알려드립니다.",
    confirm: "주문 취소",
  };
}

export function ShopOrderActionDialog({
  onClose,
  onConfirm,
  submitting,
  target,
}: {
  readonly onClose: () => void;
  readonly onConfirm: (options?: ShopOrderActionOptions) => void;
  readonly submitting: boolean;
  readonly target: ShopOrderActionTarget;
}) {
  const [reasonCode, setReasonCode] = useState<CancelReason>("sold_out");
  const [reasonText, setReasonText] = useState("");
  const copy = target ? dialogCopy(target) : null;
  const cancel = target?.action === "cancel";
  const missingOtherReason = cancel && reasonCode === "other" && reasonText.trim().length === 0;

  return (
    <Dialog
      closeLabel="확인 창 닫기"
      description={copy?.description}
      onClose={() => { if (!submitting) onClose(); }}
      open={Boolean(target)}
      title={copy?.title ?? "주문 처리 확인"}
    >
      {target && copy ? (
        <div className="space-y-4">
          <p className={`rounded-2xl px-4 py-3 text-sm font-semibold leading-relaxed ${cancel ? "brand-alert-error" : "brand-alert-info"}`}>
            {copy.body}
          </p>

          {cancel ? (
            <div className="space-y-3">
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[var(--brand-text)]">취소 사유</span>
                <select
                  className="brand-input w-full rounded-2xl px-4 py-3 text-sm outline-none"
                  onChange={(event) => {
                    if (isCancelReason(event.target.value)) setReasonCode(event.target.value);
                  }}
                  value={reasonCode}
                >
                  {CANCEL_REASONS.map((reason) => <option key={reason.value} value={reason.value}>{reason.label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-bold text-[var(--brand-text)]">추가 설명</span>
                <textarea
                  aria-invalid={missingOtherReason}
                  className={`${missingOtherReason ? "brand-input-error" : "brand-input"} min-h-24 w-full resize-none rounded-2xl px-4 py-3 text-sm outline-none`}
                  maxLength={100}
                  onChange={(event) => setReasonText(event.target.value)}
                  placeholder={reasonCode === "other" ? "기타 사유를 입력해 주세요." : "필요한 경우 설명을 덧붙이세요."}
                  value={reasonText}
                />
                {missingOtherReason ? <span className="brand-form-error">기타 사유를 입력해 주세요.</span> : null}
              </label>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button className="brand-button-secondary rounded-2xl px-4 py-3 text-sm font-bold" disabled={submitting} onClick={onClose} type="button">
              유지하기
            </button>
            <button
              className={`${cancel ? "brand-button-danger-solid" : "brand-button-primary"} rounded-2xl px-4 py-3 text-sm font-extrabold`}
              disabled={submitting || missingOtherReason}
              onClick={() => onConfirm(cancel ? { reasonCode, reasonText } : undefined)}
              type="button"
            >
              {submitting ? "처리 중…" : copy.confirm}
            </button>
          </div>
        </div>
      ) : null}
    </Dialog>
  );
}
