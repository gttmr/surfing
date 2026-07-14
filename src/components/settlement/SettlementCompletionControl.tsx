"use client";

import { useState } from "react";

export function SettlementCompletionControl({
  initialCompleted,
  meetingId,
}: {
  readonly initialCompleted: boolean;
  readonly meetingId: number;
}) {
  const [completed, setCompleted] = useState(initialCompleted);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleCompleted() {
    const nextCompleted = !completed;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch("/api/settlement/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId, completed: nextCompleted }),
      });
      if (!response.ok) {
        setError("완료 상태를 바꾸지 못했습니다. 다시 시도해 주세요.");
        return;
      }
      const payload: unknown = await response.json().catch(() => null);
      if (typeof payload !== "object"
        || payload === null
        || !("completed" in payload)
        || typeof payload.completed !== "boolean") {
        setError("완료 상태 응답을 확인하지 못했습니다. 다시 불러와 주세요.");
        return;
      }
      setCompleted(payload.completed);
    } catch {
      setError("완료 상태를 바꾸지 못했습니다. 연결을 확인해 주세요.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="brand-panel-white mb-4 rounded-2xl p-3">
      <div className="flex items-center justify-between gap-3">
        <span
          aria-live="polite"
          className={`rounded-full px-2.5 py-1 text-xs font-bold ${completed ? "brand-chip-success" : "brand-chip-soft"}`}
        >
          {completed ? "송금 완료" : "정산 필요"}
        </span>
        <button
          className="brand-button-secondary min-h-11 rounded-xl px-3 text-xs font-bold"
          disabled={saving}
          onClick={toggleCompleted}
          type="button"
        >
          {saving ? "변경 중..." : completed ? "완료 표시 취소" : "송금 완료로 표시"}
        </button>
      </div>
      {error ? <p className="brand-inline-danger mt-2 rounded-xl px-3 py-2 text-xs font-semibold" role="alert">{error}</p> : null}
    </div>
  );
}
