"use client";

import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Toast, useToast } from "@/components/ui/Toast";
import type { AdminSettingsFormData } from "@/lib/admin-page-data";

type SettingsFormState = AdminSettingsFormData;

export function AdminSettingsPageClient({
  initialSettings,
}: {
  initialSettings: AdminSettingsFormData;
}) {
  const [form, setForm] = useState<SettingsFormState>(initialSettings);
  const [saving, setSaving] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          updates: {
            cancellation_penalty_message: form.penaltyMessage,
            cancellation_penalty_days: form.penaltyDays,
            participant_option_pricing_guide: form.participantOptionPricingGuide,
            settlement_bank_name: form.settlementBankName,
            settlement_account_number: form.settlementAccountNumber,
            settlement_account_holder: form.settlementAccountHolder,
          },
        }),
      });

      if (!res.ok) throw new Error("save_failed");
      addToast("설정이 저장되었습니다", "success");
    } catch {
      addToast("저장에 실패했습니다", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="font-headline text-[1.7rem] font-extrabold tracking-[-0.03em] text-[var(--brand-text)]">설정</h1>
        <p className="brand-text-muted mt-1 text-sm">취소 정책과 참가 옵션 안내 문구를 관리합니다.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="brand-card-soft rounded-3xl p-6">
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-[var(--brand-text)]">
            <span>⚠️</span> 취소 패널티 설정
          </h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[var(--brand-text)]">
                패널티 기준 일수
              </label>
              <p className="brand-text-subtle mb-2 text-xs">
                모임 날짜 기준 이 일수 이내에 취소하면 패널티가 부과됩니다.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={form.penaltyDays}
                  onChange={(e) => setForm((prev) => ({ ...prev, penaltyDays: e.target.value }))}
                  min="0"
                  max="30"
                  className="brand-input w-20 rounded-xl px-3 py-2 text-center text-sm outline-none"
                />
                <span className="brand-text-muted text-sm">일 이내 취소 시 패널티</span>
              </div>
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[var(--brand-text)]">
                취소 시 안내 메시지
              </label>
              <p className="brand-text-subtle mb-2 text-xs">
                패널티가 적용될 때 회원에게 표시되는 메시지입니다.
              </p>
              <textarea
                value={form.penaltyMessage}
                onChange={(e) => setForm((prev) => ({ ...prev, penaltyMessage: e.target.value }))}
                rows={4}
                className="brand-input w-full resize-none rounded-2xl px-4 py-3 text-sm outline-none transition-colors"
                placeholder="취소 시 안내할 메시지를 입력하세요..."
              />
              <p className="brand-text-subtle mt-1 text-right text-xs">{form.penaltyMessage.length}자</p>
            </div>

            <div>
              <label className="brand-text-muted mb-2 block text-xs font-bold">미리보기</label>
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <div className="mb-2 text-center">
                  <span className="text-2xl">⚠️</span>
                </div>
                <p className="mb-2 text-center text-sm font-bold text-[var(--brand-text)]">참가가 취소되었습니다</p>
                <div className="rounded-lg bg-red-100 p-3 text-sm text-red-700">
                  {form.penaltyMessage || "(메시지 없음)"}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="brand-card-soft rounded-3xl p-6">
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-[var(--brand-text)]">
            <span>ℹ️</span> 참가 옵션 가격 안내
          </h2>

          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[var(--brand-text)]">
                안내 문구
              </label>
              <p className="brand-text-subtle mb-2 text-xs">
                참가 신청 화면의 정보 버튼을 눌렀을 때 표시되는 안내입니다.
              </p>
              <textarea
                value={form.participantOptionPricingGuide}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, participantOptionPricingGuide: e.target.value }))
                }
                rows={4}
                className="brand-input w-full resize-none rounded-2xl px-4 py-3 text-sm outline-none transition-colors"
                placeholder="참가 옵션 가격 안내 문구를 입력하세요..."
              />
              <p className="brand-text-subtle mt-1 text-right text-xs">
                {form.participantOptionPricingGuide.length}자
              </p>
            </div>

            <div>
              <label className="brand-text-muted mb-2 block text-xs font-bold">미리보기</label>
              <div className="brand-list-item rounded-2xl p-4">
                <p className="brand-text-muted whitespace-pre-line text-sm">
                  {form.participantOptionPricingGuide || "(메시지 없음)"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="brand-card-soft rounded-3xl p-6">
          <h2 className="mb-4 flex items-center gap-2 text-base font-bold text-[var(--brand-text)]">
            <span>💸</span> 정산 입금 계좌
          </h2>

          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-[var(--brand-text)]">은행명</span>
                <input
                  value={form.settlementBankName}
                  onChange={(e) => setForm((prev) => ({ ...prev, settlementBankName: e.target.value }))}
                  className="brand-input w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  placeholder="예: 카카오뱅크"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-[var(--brand-text)]">계좌번호</span>
                <input
                  value={form.settlementAccountNumber}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, settlementAccountNumber: e.target.value }))
                  }
                  className="brand-input w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  placeholder="예: 3333-12-1234567"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-[var(--brand-text)]">예금주</span>
                <input
                  value={form.settlementAccountHolder}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, settlementAccountHolder: e.target.value }))
                  }
                  className="brand-input w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  placeholder="예: 홍길동"
                />
              </label>
            </div>

            <div>
              <label className="brand-text-muted mb-2 block text-xs font-bold">미리보기</label>
              <div className="brand-list-item rounded-2xl p-4">
                {form.settlementBankName || form.settlementAccountNumber || form.settlementAccountHolder ? (
                  <p className="text-sm font-semibold text-[var(--brand-text)]">
                    {form.settlementBankName} {form.settlementAccountNumber}{" "}
                    {form.settlementAccountHolder ? `(${form.settlementAccountHolder})` : ""}
                  </p>
                ) : (
                  <p className="brand-text-subtle text-sm">정산 팝업에 표시할 입금 계좌를 입력하세요.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className="brand-button-primary w-full rounded-2xl py-3 text-sm font-bold transition-all"
        >
          {saving ? "저장 중..." : "설정 저장"}
        </button>
      </form>

      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => removeToast(toast.id)} />
      ))}
    </AdminLayout>
  );
}
