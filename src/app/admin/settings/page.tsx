"use client";

import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Toast, useToast } from "@/components/ui/Toast";
import {
  DEFAULT_PARTICIPANT_OPTION_PRICING_GUIDE,
  PARTICIPANT_OPTION_PRICING_GUIDE_KEY,
  DEFAULT_SETTLEMENT_ACCOUNT_HOLDER,
  DEFAULT_SETTLEMENT_ACCOUNT_NUMBER,
  DEFAULT_SETTLEMENT_BANK_NAME,
  SETTLEMENT_ACCOUNT_HOLDER_KEY,
  SETTLEMENT_ACCOUNT_NUMBER_KEY,
  SETTLEMENT_BANK_NAME_KEY,
} from "@/lib/settings";

const DEFAULT_PENALTY_MESSAGE =
  "일정 2일 이내 취소로 패널티가 부과됩니다. 잦은 직전 취소는 다른 회원들에게 피해를 줄 수 있으니 신중하게 결정해 주세요.";

export default function AdminSettingsPage() {
  const [penaltyMessage, setPenaltyMessage] = useState(DEFAULT_PENALTY_MESSAGE);
  const [penaltyDays, setPenaltyDays] = useState("2");
  const [participantOptionPricingGuide, setParticipantOptionPricingGuide] = useState(DEFAULT_PARTICIPANT_OPTION_PRICING_GUIDE);
  const [settlementBankName, setSettlementBankName] = useState(DEFAULT_SETTLEMENT_BANK_NAME);
  const [settlementAccountNumber, setSettlementAccountNumber] = useState(DEFAULT_SETTLEMENT_ACCOUNT_NUMBER);
  const [settlementAccountHolder, setSettlementAccountHolder] = useState(DEFAULT_SETTLEMENT_ACCOUNT_HOLDER);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  useEffect(() => {
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((data) => {
        if (data.cancellation_penalty_message) {
          setPenaltyMessage(data.cancellation_penalty_message);
        }
        if (data.cancellation_penalty_days) {
          setPenaltyDays(data.cancellation_penalty_days);
        }
        if (data[PARTICIPANT_OPTION_PRICING_GUIDE_KEY]) {
          setParticipantOptionPricingGuide(data[PARTICIPANT_OPTION_PRICING_GUIDE_KEY]);
        }
        if (data[SETTLEMENT_BANK_NAME_KEY]) {
          setSettlementBankName(data[SETTLEMENT_BANK_NAME_KEY]);
        }
        if (data[SETTLEMENT_ACCOUNT_NUMBER_KEY]) {
          setSettlementAccountNumber(data[SETTLEMENT_ACCOUNT_NUMBER_KEY]);
        }
        if (data[SETTLEMENT_ACCOUNT_HOLDER_KEY]) {
          setSettlementAccountHolder(data[SETTLEMENT_ACCOUNT_HOLDER_KEY]);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);

    try {
      await Promise.all([
        fetch("/api/admin/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "cancellation_penalty_message", value: penaltyMessage }),
        }),
        fetch("/api/admin/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: "cancellation_penalty_days", value: penaltyDays }),
        }),
        fetch("/api/admin/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: PARTICIPANT_OPTION_PRICING_GUIDE_KEY, value: participantOptionPricingGuide }),
        }),
        fetch("/api/admin/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: SETTLEMENT_BANK_NAME_KEY, value: settlementBankName }),
        }),
        fetch("/api/admin/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: SETTLEMENT_ACCOUNT_NUMBER_KEY, value: settlementAccountNumber }),
        }),
        fetch("/api/admin/settings", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key: SETTLEMENT_ACCOUNT_HOLDER_KEY, value: settlementAccountHolder }),
        }),
      ]);

      addToast("설정이 저장되었습니다", "success");
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
        <h1 className="font-headline text-[1.7rem] font-extrabold tracking-[-0.03em] text-[var(--brand-text)]">설정</h1>
        <p className="brand-text-muted mt-1 text-sm">취소 정책과 참가 옵션 안내 문구를 관리합니다.</p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* 취소 패널티 설정 */}
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
                  value={penaltyDays}
                  onChange={(e) => setPenaltyDays(e.target.value)}
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
                value={penaltyMessage}
                onChange={(e) => setPenaltyMessage(e.target.value)}
                rows={4}
                className="brand-input w-full resize-none rounded-2xl px-4 py-3 text-sm outline-none transition-colors"
                placeholder="취소 시 안내할 메시지를 입력하세요..."
              />
              <p className="brand-text-subtle mt-1 text-right text-xs">{penaltyMessage.length}자</p>
            </div>

            {/* 미리보기 */}
            <div>
              <label className="brand-text-muted mb-2 block text-xs font-bold">미리보기</label>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="text-center mb-2">
                  <span className="text-2xl">⚠️</span>
                </div>
                <p className="mb-2 text-center text-sm font-bold text-[var(--brand-text)]">참가가 취소되었습니다</p>
                <div className="bg-red-100 rounded-lg p-3 text-sm text-red-700">
                  {penaltyMessage || "(메시지 없음)"}
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
                value={participantOptionPricingGuide}
                onChange={(e) => setParticipantOptionPricingGuide(e.target.value)}
                rows={4}
                className="brand-input w-full resize-none rounded-2xl px-4 py-3 text-sm outline-none transition-colors"
                placeholder="참가 옵션 가격 안내 문구를 입력하세요..."
              />
              <p className="brand-text-subtle mt-1 text-right text-xs">{participantOptionPricingGuide.length}자</p>
            </div>

            <div>
              <label className="brand-text-muted mb-2 block text-xs font-bold">미리보기</label>
              <div className="brand-list-item rounded-2xl p-4">
                <p className="brand-text-muted whitespace-pre-line text-sm">
                  {participantOptionPricingGuide || "(메시지 없음)"}
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
                  value={settlementBankName}
                  onChange={(e) => setSettlementBankName(e.target.value)}
                  className="brand-input w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  placeholder="예: 카카오뱅크"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-[var(--brand-text)]">계좌번호</span>
                <input
                  value={settlementAccountNumber}
                  onChange={(e) => setSettlementAccountNumber(e.target.value)}
                  className="brand-input w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  placeholder="예: 3333-12-1234567"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-[var(--brand-text)]">예금주</span>
                <input
                  value={settlementAccountHolder}
                  onChange={(e) => setSettlementAccountHolder(e.target.value)}
                  className="brand-input w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                  placeholder="예: 홍길동"
                />
              </label>
            </div>

            <div>
              <label className="brand-text-muted mb-2 block text-xs font-bold">미리보기</label>
              <div className="brand-list-item rounded-2xl p-4">
                {settlementBankName || settlementAccountNumber || settlementAccountHolder ? (
                  <p className="text-sm font-semibold text-[var(--brand-text)]">
                    {settlementBankName} {settlementAccountNumber} {settlementAccountHolder ? `(${settlementAccountHolder})` : ""}
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

      {toasts.map((t) => (
        <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
      ))}
    </AdminLayout>
  );
}
