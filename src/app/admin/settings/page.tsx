"use client";

import { useState, useEffect } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Toast, useToast } from "@/components/ui/Toast";
import {
  DEFAULT_PARTICIPANT_OPTION_PRICING_GUIDE,
  PARTICIPANT_OPTION_PRICING_GUIDE_KEY,
} from "@/lib/settings";

const DEFAULT_PENALTY_MESSAGE =
  "일정 2일 이내 취소로 패널티가 부과됩니다. 잦은 직전 취소는 다른 회원들에게 피해를 줄 수 있으니 신중하게 결정해 주세요.";

export default function AdminSettingsPage() {
  const [penaltyMessage, setPenaltyMessage] = useState(DEFAULT_PENALTY_MESSAGE);
  const [penaltyDays, setPenaltyDays] = useState("2");
  const [participantOptionPricingGuide, setParticipantOptionPricingGuide] = useState(DEFAULT_PARTICIPANT_OPTION_PRICING_GUIDE);
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
        <div className="text-center py-16 text-slate-400 text-sm">불러오는 중...</div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <h1 className="text-xl font-extrabold text-slate-900 mb-6">설정</h1>

      <form onSubmit={handleSave} className="space-y-6">
        {/* 취소 패널티 설정 */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span>⚠️</span> 취소 패널티 설정
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                패널티 기준 일수
              </label>
              <p className="text-xs text-slate-400 mb-2">
                모임 날짜 기준 이 일수 이내에 취소하면 패널티가 부과됩니다.
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={penaltyDays}
                  onChange={(e) => setPenaltyDays(e.target.value)}
                  min="0"
                  max="30"
                  className="w-20 px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-500 text-center"
                />
                <span className="text-sm text-slate-600">일 이내 취소 시 패널티</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                취소 시 안내 메시지
              </label>
              <p className="text-xs text-slate-400 mb-2">
                패널티가 적용될 때 회원에게 표시되는 메시지입니다.
              </p>
              <textarea
                value={penaltyMessage}
                onChange={(e) => setPenaltyMessage(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-500 transition-colors resize-none"
                placeholder="취소 시 안내할 메시지를 입력하세요..."
              />
              <p className="mt-1 text-xs text-slate-400 text-right">{penaltyMessage.length}자</p>
            </div>

            {/* 미리보기 */}
            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2">미리보기</label>
              <div className="bg-red-50 border border-red-200 rounded-xl p-4">
                <div className="text-center mb-2">
                  <span className="text-2xl">⚠️</span>
                </div>
                <p className="text-sm font-bold text-slate-800 text-center mb-2">참가가 취소되었습니다</p>
                <div className="bg-red-100 rounded-lg p-3 text-sm text-red-700">
                  {penaltyMessage || "(메시지 없음)"}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
            <span>ℹ️</span> 참가 옵션 가격 안내
          </h2>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">
                안내 문구
              </label>
              <p className="text-xs text-slate-400 mb-2">
                참가 신청 화면의 정보 버튼을 눌렀을 때 표시되는 안내입니다.
              </p>
              <textarea
                value={participantOptionPricingGuide}
                onChange={(e) => setParticipantOptionPricingGuide(e.target.value)}
                rows={4}
                className="w-full px-4 py-3 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-500 transition-colors resize-none"
                placeholder="참가 옵션 가격 안내 문구를 입력하세요..."
              />
              <p className="mt-1 text-xs text-slate-400 text-right">{participantOptionPricingGuide.length}자</p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 mb-2">미리보기</label>
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <p className="whitespace-pre-line text-sm text-slate-700">
                  {participantOptionPricingGuide || "(메시지 없음)"}
                </p>
              </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={saving}
          className={`w-full py-3 rounded-xl font-bold text-white text-sm transition-all ${
            saving ? "bg-slate-300 cursor-not-allowed" : "bg-blue-600 hover:bg-blue-700 active:scale-[0.99]"
          }`}
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
