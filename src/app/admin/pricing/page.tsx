"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Toast, useToast } from "@/components/ui/Toast";
import { DEFAULT_PRICING_SETTINGS, PRICING_SETTING_KEYS, type PricingSettingKey } from "@/lib/settings";

type PricingState = Record<PricingSettingKey, string>;

const PRICING_FIELDS: Array<{
  title: string;
  description: string;
  regularKey: PricingSettingKey;
  companionKey: PricingSettingKey;
}> = [
  {
    title: "기본 참가비",
    description: "모임 참가 자체에 대한 기본 비용입니다.",
    regularKey: PRICING_SETTING_KEYS.regularBaseFee,
    companionKey: PRICING_SETTING_KEYS.companionBaseFee,
  },
  {
    title: "강습비",
    description: "강습 선택 시 추가되는 비용입니다.",
    regularKey: PRICING_SETTING_KEYS.regularLessonFee,
    companionKey: PRICING_SETTING_KEYS.companionLessonFee,
  },
  {
    title: "장비 대여비",
    description: "장비 대여 선택 시 추가되는 비용입니다.",
    regularKey: PRICING_SETTING_KEYS.regularRentalFee,
    companionKey: PRICING_SETTING_KEYS.companionRentalFee,
  },
];

function parseWon(value: string) {
  const normalized = value.replace(/[^\d]/g, "");
  return normalized ? Number(normalized) : 0;
}

function formatWon(value: string) {
  return `${parseWon(value).toLocaleString("ko-KR")}원`;
}

export default function AdminPricingPage() {
  const [pricing, setPricing] = useState<PricingState>({ ...DEFAULT_PRICING_SETTINGS });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.ok ? r.json() : ({} as Record<string, string>))
      .then((data: Record<string, string>) => {
        setPricing({
          [PRICING_SETTING_KEYS.regularBaseFee]: data[PRICING_SETTING_KEYS.regularBaseFee] ?? DEFAULT_PRICING_SETTINGS[PRICING_SETTING_KEYS.regularBaseFee],
          [PRICING_SETTING_KEYS.companionBaseFee]: data[PRICING_SETTING_KEYS.companionBaseFee] ?? DEFAULT_PRICING_SETTINGS[PRICING_SETTING_KEYS.companionBaseFee],
          [PRICING_SETTING_KEYS.regularLessonFee]: data[PRICING_SETTING_KEYS.regularLessonFee] ?? DEFAULT_PRICING_SETTINGS[PRICING_SETTING_KEYS.regularLessonFee],
          [PRICING_SETTING_KEYS.companionLessonFee]: data[PRICING_SETTING_KEYS.companionLessonFee] ?? DEFAULT_PRICING_SETTINGS[PRICING_SETTING_KEYS.companionLessonFee],
          [PRICING_SETTING_KEYS.regularRentalFee]: data[PRICING_SETTING_KEYS.regularRentalFee] ?? DEFAULT_PRICING_SETTINGS[PRICING_SETTING_KEYS.regularRentalFee],
          [PRICING_SETTING_KEYS.companionRentalFee]: data[PRICING_SETTING_KEYS.companionRentalFee] ?? DEFAULT_PRICING_SETTINGS[PRICING_SETTING_KEYS.companionRentalFee],
        });
      })
      .finally(() => setLoading(false));
  }, []);

  const preview = useMemo(() => {
    const regularBase = parseWon(pricing[PRICING_SETTING_KEYS.regularBaseFee]);
    const companionBase = parseWon(pricing[PRICING_SETTING_KEYS.companionBaseFee]);
    const regularLesson = parseWon(pricing[PRICING_SETTING_KEYS.regularLessonFee]);
    const companionLesson = parseWon(pricing[PRICING_SETTING_KEYS.companionLessonFee]);
    const regularRental = parseWon(pricing[PRICING_SETTING_KEYS.regularRentalFee]);
    const companionRental = parseWon(pricing[PRICING_SETTING_KEYS.companionRentalFee]);

    return {
      regularJoinOnly: regularBase,
      companionJoinOnly: companionBase,
      regularLessonRental: regularBase + regularLesson + regularRental,
      companionLessonRental: companionBase + companionLesson + companionRental,
      regularRentalOnly: regularBase + regularRental,
      companionRentalOnly: companionBase + companionRental,
    };
  }, [pricing]);

  function updateValue(key: PricingSettingKey, value: string) {
    const normalized = value.replace(/[^\d]/g, "");
    setPricing((prev) => ({ ...prev, [key]: normalized }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      await Promise.all(
        (Object.entries(pricing) as Array<[PricingSettingKey, string]>).map(([key, value]) =>
          fetch("/api/admin/settings", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ key, value: String(parseWon(value)) }),
          })
        )
      );
      addToast("비용 설정이 저장되었습니다", "success");
    } catch {
      addToast("저장에 실패했습니다", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <AdminLayout>
        <div className="brand-text-subtle py-16 text-center text-sm">불러오는 중...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="font-headline text-[1.7rem] font-extrabold tracking-[-0.03em] text-[var(--brand-text)]">비용 책정하기</h1>
        <p className="brand-text-muted mt-1 text-sm">정회원/동반인별 기본 참가비, 강습비, 장비 대여비를 관리합니다.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="brand-card-soft rounded-3xl p-6">
          <div className="mb-4 grid grid-cols-[1.4fr,1fr,1fr] items-center gap-3">
            <div>
              <h2 className="text-base font-extrabold text-[var(--brand-text)]">요금 항목</h2>
              <p className="brand-text-subtle mt-1 text-xs">조합형 금액은 아래 미리보기에서 자동 계산됩니다.</p>
            </div>
            <div className="brand-chip-soft justify-self-center rounded-full px-3 py-1 text-xs font-bold">정회원</div>
            <div className="brand-chip-companion justify-self-center rounded-full px-3 py-1 text-xs font-bold">동반인</div>
          </div>

          <div className="space-y-3">
            {PRICING_FIELDS.map((field) => (
              <div key={field.title} className="brand-list-item rounded-2xl p-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-[1.4fr,1fr,1fr]">
                  <div>
                    <p className="text-sm font-bold text-[var(--brand-text)]">{field.title}</p>
                    <p className="brand-text-subtle mt-1 text-xs">{field.description}</p>
                  </div>

                  <label className="block">
                    <span className="brand-text-subtle mb-1 block text-[11px] font-semibold">정회원</span>
                    <input
                      className="brand-input w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                      inputMode="numeric"
                      onChange={(e) => updateValue(field.regularKey, e.target.value)}
                      placeholder="0"
                      type="text"
                      value={pricing[field.regularKey]}
                    />
                    <span className="brand-text-subtle mt-1 block text-[11px]">{formatWon(pricing[field.regularKey])}</span>
                  </label>

                  <label className="block">
                    <span className="brand-text-subtle mb-1 block text-[11px] font-semibold">동반인</span>
                    <input
                      className="brand-input w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                      inputMode="numeric"
                      onChange={(e) => updateValue(field.companionKey, e.target.value)}
                      placeholder="0"
                      type="text"
                      value={pricing[field.companionKey]}
                    />
                    <span className="brand-text-subtle mt-1 block text-[11px]">{formatWon(pricing[field.companionKey])}</span>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="brand-card-soft rounded-3xl p-6">
          <h2 className="text-base font-extrabold text-[var(--brand-text)]">조합 미리보기</h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <div className="brand-list-item rounded-2xl p-4">
              <p className="text-sm font-bold text-[var(--brand-text)]">정회원</p>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between"><span className="brand-text-muted">참가만</span><span className="font-bold">{preview.regularJoinOnly.toLocaleString("ko-KR")}원</span></div>
                <div className="flex items-center justify-between"><span className="brand-text-muted">장비 대여만</span><span className="font-bold">{preview.regularRentalOnly.toLocaleString("ko-KR")}원</span></div>
                <div className="flex items-center justify-between"><span className="brand-text-muted">강습+장비대여</span><span className="font-bold">{preview.regularLessonRental.toLocaleString("ko-KR")}원</span></div>
              </div>
            </div>

            <div className="brand-list-item rounded-2xl p-4">
              <p className="text-sm font-bold text-[var(--brand-text)]">동반인</p>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between"><span className="brand-text-muted">참가만</span><span className="font-bold">{preview.companionJoinOnly.toLocaleString("ko-KR")}원</span></div>
                <div className="flex items-center justify-between"><span className="brand-text-muted">장비 대여만</span><span className="font-bold">{preview.companionRentalOnly.toLocaleString("ko-KR")}원</span></div>
                <div className="flex items-center justify-between"><span className="brand-text-muted">강습+장비대여</span><span className="font-bold">{preview.companionLessonRental.toLocaleString("ko-KR")}원</span></div>
              </div>
            </div>
          </div>
        </div>

        <button
          className="brand-button-primary w-full rounded-2xl py-3 text-sm font-bold transition-all"
          disabled={saving}
          type="submit"
        >
          {saving ? "저장 중..." : "비용 설정 저장"}
        </button>
      </form>

      {toasts.map((t) => (
        <Toast key={t.id} message={t.message} onClose={() => removeToast(t.id)} type={t.type} />
      ))}
    </AdminLayout>
  );
}
