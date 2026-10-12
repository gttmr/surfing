"use client";

import { useState } from "react";
import { formatWon } from "@/lib/format";

type Fees = {
  readonly regularFee: number;
  readonly companionFee: number;
  readonly lodgingFee: number;
};

type FeeKey = keyof Fees;

/** 모임 참가비(1박은 둘째 날 포함 총액)와 1박 숙박비. 청구 공개 전까지 바꿀 수 있다. */
export function AdminMeetingFeesSection({
  meetingId,
  initialFees,
  overnight,
  locked,
  onSaved,
}: {
  readonly meetingId: number;
  readonly initialFees: Fees;
  readonly overnight: boolean;
  readonly locked: boolean;
  readonly onSaved: (message: string, type: "success" | "error") => void;
}) {
  const [fees, setFees] = useState<Fees>({
    regularFee: initialFees.regularFee,
    companionFee: initialFees.companionFee,
    lodgingFee: initialFees.lodgingFee,
  });
  const [draft, setDraft] = useState<Record<FeeKey, string> | null>(null);
  const [saving, setSaving] = useState(false);
  const fields: ReadonlyArray<{ readonly key: FeeKey; readonly label: string }> = [
    { key: "regularFee", label: overnight ? "정회원 1박 참가비" : "정회원 참가비" },
    { key: "companionFee", label: overnight ? "동반인 1박 참가비" : "동반인 참가비" },
    ...(overnight ? [{ key: "lodgingFee" as const, label: "1인 숙박비" }] : []),
  ];

  async function save() {
    if (!draft) return;
    setSaving(true);
    try {
      const amount = (value: string) => Number(value.replace(/[^\d]/g, ""));
      const response = await fetch(`/api/meetings/${meetingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          regularFee: amount(draft.regularFee),
          companionFee: amount(draft.companionFee),
          ...(overnight ? { lodgingFee: amount(draft.lodgingFee) } : {}),
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        onSaved(payload.error ?? "참가비를 바꾸지 못했습니다.", "error");
        return;
      }
      setFees({ regularFee: payload.regularFee, companionFee: payload.companionFee, lodgingFee: payload.lodgingFee });
      setDraft(null);
      onSaved("참가비를 바꿨습니다.", "success");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="brand-admin-section overflow-hidden">
      <div className="brand-admin-section-header flex items-center justify-between gap-3 px-4 py-3">
        <h2 className="text-sm font-extrabold">참가비</h2>
        {!locked && !draft ? (
          <button
            className="brand-link min-h-11 px-1 text-xs font-bold"
            onClick={() => setDraft({
              regularFee: String(fees.regularFee),
              companionFee: String(fees.companionFee),
              lodgingFee: String(fees.lodgingFee),
            })}
            type="button"
          >
            수정
          </button>
        ) : null}
      </div>
      <dl className="divide-y divide-brand-divider px-4">
        {fields.map((field) => (
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
          {locked
            ? "청구가 공개되어 참가비가 잠겼습니다."
            : overnight
              ? "참가비는 둘째 날을 포함한 총액이며, 숙박비는 숙박 대상자에게만 청구됩니다."
              : "이 모임에만 적용됩니다. 새 모임의 기본값은 요금·지원 정책에서 바꿉니다."}
        </p>
      )}
    </section>
  );
}
