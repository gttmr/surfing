"use client";

import { useMemo, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Toast, useToast } from "@/components/ui/Toast";
import {
  PRICING_SETTING_KEYS,
  type PricingSettingKey,
} from "@/lib/settings";
import type { AdminPricingState } from "@/lib/admin-page-data";

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

export function AdminPricingPageClient({
  initialPricing,
}: {
  initialPricing: AdminPricingState;
}) {
  const [pricing, setPricing] = useState(initialPricing);
  const [saving, setSaving] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

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
      foodSupportCap: parseWon(pricing.foodOrderSupportCap),
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
      const updates = Object.fromEntries(
        Object.entries(pricing).map(([key, value]) => [key, String(parseWon(value))])
      );
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ updates }),
      });
      if (!res.ok) throw new Error("save_failed");
      addToast("비용 설정이 저장되었습니다", "success");
    } catch {
      addToast("저장에 실패했습니다", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="font-headline text-[1.7rem] font-extrabold tracking-[-0.03em] text-[var(--brand-text)]">비용 책정하기</h1>
        <p className="brand-text-muted mt-1 text-sm">참가비, 옵션 비용, 식음료 지원 한도를 운영 기준에 맞춰 한 번에 저장합니다.</p>
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

        <div className="brand-card-soft rounded-3xl p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-[var(--brand-text)]">식음료 지원 정책</h2>
              <p className="brand-text-subtle mt-1 text-xs">참가자 1인 기준으로 식음료 주문 총액에서 차감할 최대 지원 금액입니다.</p>
            </div>
            <span className="brand-chip-soft rounded-full px-3 py-1 text-xs font-bold">운영진 설정</span>
          </div>

          <div className="grid gap-3 md:grid-cols-[minmax(0,220px)_1fr] md:items-start">
            <label className="block">
              <span className="brand-text-subtle mb-1 block text-[11px] font-semibold">1인당 지원 한도</span>
              <input
                className="brand-input w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                inputMode="numeric"
                onChange={(e) =>
                  setPricing((prev) => ({
                    ...prev,
                    foodOrderSupportCap: e.target.value.replace(/[^\d]/g, ""),
                  }))
                }
                placeholder="10000"
                type="text"
                value={pricing.foodOrderSupportCap}
              />
              <span className="brand-text-subtle mt-1 block text-[11px]">{formatWon(pricing.foodOrderSupportCap)}</span>
            </label>

            <div className="brand-list-item rounded-2xl p-4">
              <p className="text-sm font-bold text-[var(--brand-text)]">정산 반영 방식</p>
              <div className="mt-3 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="brand-text-muted">식음료 총액</span>
                  <span className="font-bold">참가자별 합산</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="brand-text-muted">지원 차감</span>
                  <span className="font-bold">최대 {preview.foodSupportCap.toLocaleString("ko-KR")}원</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="brand-text-muted">초과 청구</span>
                  <span className="font-bold">정산서에 자동 반영</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <button
          className="brand-button-primary w-full rounded-2xl py-3 text-sm font-bold transition-all"
          disabled={saving}
          type="submit"
        >
          {saving ? "저장 중..." : "비용 정책 저장"}
        </button>
      </form>

      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} onClose={() => removeToast(toast.id)} type={toast.type} />
      ))}
    </AdminLayout>
  );
}
