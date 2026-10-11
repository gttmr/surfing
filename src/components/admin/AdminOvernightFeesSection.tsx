"use client";

import { useState } from "react";
import { formatWon } from "@/lib/format";
import type { OvernightMeetingGroupSummary } from "@/lib/meeting-group";

type Fees = Pick<OvernightMeetingGroupSummary, "regularBaseFee" | "companionBaseFee" | "lodgingFee">;

const FIELDS = [
  { key: "regularBaseFee", label: "정회원 1박 참가비" },
  { key: "companionBaseFee", label: "동반인 1박 참가비" },
  { key: "lodgingFee", label: "1인 숙박비" },
] as const;

/** 1박 모임의 요금(둘째 날 포함 총액, 숙박비). 청구 검토 전까지 수정할 수 있다. */
export function AdminOvernightFeesSection({
  groupId,
  initialFees,
  locked,
  onSaved,
}: {
  readonly groupId: number;
  readonly initialFees: Fees;
  readonly locked: boolean;
  readonly onSaved: (message: string, type: "success" | "error") => void;
}) {
  const [fees, setFees] = useState<Fees>(initialFees);
  const [draft, setDraft] = useState<Record<keyof Fees, string> | null>(null);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      const response = await fetch("/api/admin/meeting-groups", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          regularBaseFee: Number(draft.regularBaseFee.replace(/[^\d]/g, "")),
          companionBaseFee: Number(draft.companionBaseFee.replace(/[^\d]/g, "")),
          lodgingFee: Number(draft.lodgingFee.replace(/[^\d]/g, "")),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        onSaved(payload.error ?? "1박 요금을 바꾸지 못했습니다.", "error");
        return;
      }
      setFees(payload as Fees);
      setDraft(null);
      onSaved("1박 요금을 바꿨습니다.", "success");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="brand-admin-section overflow-hidden">
      <div className="brand-admin-section-header flex items-center justify-between gap-3 px-4 py-3">
        <h2 className="text-sm font-extrabold">1박 요금</h2>
        {!locked && !draft ? (
          <button
            className="brand-link min-h-11 px-1 text-xs font-bold"
            onClick={() => setDraft({
              regularBaseFee: String(fees.regularBaseFee),
              companionBaseFee: String(fees.companionBaseFee),
              lodgingFee: String(fees.lodgingFee),
            })}
            type="button"
          >
            수정
          </button>
        ) : null}
      </div>
      <dl className="divide-y divide-brand-divider px-4">
        {FIELDS.map((field) => (
          <div className="flex min-h-12 items-center justify-between gap-3" key={field.key}>
            <dt className="text-sm text-brand-text">{field.label}</dt>
            <dd>
              {draft ? (
                <input
                  aria-label={field.label}
                  className="brand-input w-32 rounded-xl px-3 py-2 text-right text-sm"
                  inputMode="numeric"
                  onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
                  value={draft[field.key]}
                />
              ) : (
                <span className="text-sm font-extrabold text-brand-text">{formatWon(fees[field.key])}</span>
              )}
            </dd>
          </div>
        ))}
      </dl>
      {draft ? (
        <div className="grid grid-cols-2 gap-2 px-4 pb-4 pt-2">
          <button className="brand-button-secondary min-h-11 rounded-xl text-sm font-bold" disabled={saving} onClick={() => setDraft(null)} type="button">취소</button>
          <button className="brand-button-primary min-h-11 rounded-xl text-sm font-bold" disabled={saving} onClick={() => void save()} type="button">{saving ? "저장 중" : "저장"}</button>
        </div>
      ) : (
        <p className="brand-text-subtle px-4 pb-3 pt-1 text-xs">
          {locked ? "청구 검토가 시작되어 요금이 잠겼습니다." : "참가비는 둘째 날을 포함한 총액이며, 숙박비는 숙박 대상자에게만 청구됩니다."}
        </p>
      )}
    </section>
  );
}
