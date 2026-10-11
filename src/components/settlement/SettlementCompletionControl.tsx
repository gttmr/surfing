"use client";

import { useState } from "react";

type PaymentStatus = "NO_PAYMENT_REQUIRED" | "PAYMENT_REQUIRED" | "REPORTED" | "VERIFIED";

export function PaymentReportControl({
  initialStatus,
  meetingId,
}: {
  readonly initialStatus: PaymentStatus;
  readonly meetingId: number;
}) {
  const [status, setStatus] = useState<PaymentStatus>(initialStatus);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function updateReport(reported: boolean) {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/settlement/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId, reported }),
      });
      if (!response.ok) {
        const payload: unknown = await response.json().catch(() => null);
        const message = typeof payload === "object" && payload !== null && "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "입금 상태를 바꾸지 못했습니다. 다시 시도해 주세요.";
        setError(message);
        return;
      }
      const payload: unknown = await response.json().catch(() => null);
      if (typeof payload !== "object"
        || payload === null
        || !("paymentStatus" in payload)
        || (payload.paymentStatus !== "NO_PAYMENT_REQUIRED" && payload.paymentStatus !== "PAYMENT_REQUIRED" && payload.paymentStatus !== "REPORTED" && payload.paymentStatus !== "VERIFIED")) {
        setError("입금 상태 응답을 확인하지 못했습니다. 다시 불러와 주세요.");
        return;
      }
      setStatus(payload.paymentStatus);
    } catch {
      setError("입금 상태를 바꾸지 못했습니다. 연결을 확인해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  const settled = status === "VERIFIED" || status === "NO_PAYMENT_REQUIRED";
  return (
    <div className="mt-3 border-t border-brand-divider pt-3">
      <div className="flex items-center justify-between gap-3">
        <span
          aria-live="polite"
          className={`inline-flex shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
            settled ? "brand-chip-success" : status === "REPORTED" ? "brand-chip-preparing" : "brand-chip-soft"
          }`}
        >
          {status === "NO_PAYMENT_REQUIRED" ? "납부 없음" : status === "VERIFIED" ? "입금 완료" : status === "REPORTED" ? "입금 확인 중" : "입금 필요"}
        </span>
        {!settled ? (
          <button
            className="brand-link min-h-11 shrink-0 px-1 text-xs font-bold disabled:opacity-50"
            disabled={saving}
            onClick={() => updateReport(status === "PAYMENT_REQUIRED")}
            type="button"
          >
            {saving ? "처리 중..." : status === "PAYMENT_REQUIRED" ? "입금했어요" : "입금 알림 취소"}
          </button>
        ) : null}
      </div>
      <p className="brand-text-muted mt-1 break-keep text-xs leading-5">
        {status === "NO_PAYMENT_REQUIRED"
          ? "회원 부담이 0원이라 입금할 금액이 없습니다."
          : status === "VERIFIED"
            ? "운영진이 입금을 확인했습니다."
            : status === "REPORTED"
              ? "운영진이 계좌 입금을 확인하면 완료로 바뀝니다."
              : "입금하면 운영진이 확인 후 '입금 완료'로 바뀝니다. 본인 이름이 아닌 계좌로 보냈다면 '입금했어요'를 눌러 알려 주세요."}
      </p>
      {error ? <p className="brand-inline-danger mt-2 rounded-xl px-3 py-2 text-xs font-semibold" role="alert">{error}</p> : null}
    </div>
  );
}
