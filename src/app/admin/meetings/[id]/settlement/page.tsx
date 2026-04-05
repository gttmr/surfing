"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Toast, useToast } from "@/components/ui/Toast";

type SettlementParticipant = {
  id: number;
  name: string;
  kakaoId: string;
  companionId: number | null;
  hasLesson: boolean;
  hasBus: boolean;
  hasRental: boolean;
  adjustments: { id: number; label: string; amount: number }[];
  breakdown: {
    baseFee: number;
    lessonFee: number;
    rentalFee: number;
    adjustmentFee: number;
    totalFee: number;
  };
};

type SettlementRecipient = {
  recipientKakaoId: string;
  recipientName: string;
  recipientType: "self" | "linked_companion" | "owner";
  totalFee: number;
  items: {
    participantId: number;
    participantName: string;
    totalFee: number;
  }[];
};

type SettlementData = {
  meeting: {
    id: number;
    date: string;
    startTime: string;
    endTime: string;
    location: string;
  };
  participants: SettlementParticipant[];
  recipients: SettlementRecipient[];
};

export default function AdminMeetingSettlementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [data, setData] = useState<SettlementData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittingFor, setSubmittingFor] = useState<number | null>(null);
  const [drafts, setDrafts] = useState<Record<number, { label: string; amount: string }>>({});
  const { toasts, addToast, removeToast } = useToast();

  function formatWon(value: number) {
    return `${value.toLocaleString("ko-KR")}원`;
  }

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/meetings/${id}/settlement`);
      const next = await res.json();
      if (!res.ok) throw new Error(next.error || "정산 정보를 불러오지 못했습니다.");
      setData(next);
    } catch (error) {
      addToast(error instanceof Error ? error.message : "정산 정보를 불러오지 못했습니다.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [id]);

  async function handleAddAdjustment(participantId: number) {
    const draft = drafts[participantId];
    if (!draft?.label?.trim()) {
      addToast("항목 이름을 입력해 주세요.", "error");
      return;
    }

    const amount = Number(draft.amount);
    if (!Number.isFinite(amount)) {
      addToast("금액을 숫자로 입력해 주세요.", "error");
      return;
    }

    setSubmittingFor(participantId);
    try {
      const res = await fetch(`/api/admin/meetings/${id}/settlement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId,
          label: draft.label,
          amount,
        }),
      });
      const response = await res.json();
      if (!res.ok) throw new Error(response.error || "정산 항목을 추가하지 못했습니다.");
      setDrafts((prev) => ({ ...prev, [participantId]: { label: "", amount: "" } }));
      addToast("정산 항목을 추가했습니다.", "success");
      await load();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "정산 항목을 추가하지 못했습니다.", "error");
    } finally {
      setSubmittingFor(null);
    }
  }

  async function handleDeleteAdjustment(adjustmentId: number) {
    try {
      const res = await fetch(`/api/admin/meetings/${id}/settlement/${adjustmentId}`, {
        method: "DELETE",
      });
      const response = await res.json();
      if (!res.ok) throw new Error(response.error || "정산 항목을 삭제하지 못했습니다.");
      addToast("정산 항목을 삭제했습니다.", "success");
      await load();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "정산 항목을 삭제하지 못했습니다.", "error");
    }
  }

  return (
    <AdminLayout>
      <div className="mb-6 flex items-start gap-3">
        <Link href={`/admin/meetings/${id}`} className="brand-link mt-0.5 text-xl">&larr;</Link>
        <div className="flex-1">
          <h1 className="font-headline text-[1.7rem] font-extrabold tracking-[-0.03em] text-[var(--brand-text)]">정산 관리</h1>
          {data ? (
            <p className="brand-text-muted mt-0.5 text-sm">
              {data.meeting.date} {data.meeting.startTime}–{data.meeting.endTime} · {data.meeting.location}
            </p>
          ) : null}
        </div>
      </div>

      {loading || !data ? (
        <div className="brand-text-subtle py-16 text-center text-sm">불러오는 중...</div>
      ) : (
        <div className="space-y-6">
          <section className="brand-card-soft rounded-3xl p-5">
            <h2 className="mb-3 text-base font-extrabold text-[var(--brand-text)]">수신자별 정산 미리보기</h2>
            <div className="space-y-3">
              {data.recipients.map((recipient) => (
                <div key={`${recipient.recipientKakaoId}-${recipient.recipientType}`} className="brand-panel-white rounded-2xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-[var(--brand-text)]">{recipient.recipientName}</p>
                      <p className="brand-text-subtle mt-1 text-xs">
                        {recipient.items.map((item) => `${item.participantName} ${formatWon(item.totalFee)}`).join(" · ")}
                      </p>
                    </div>
                    <span className="text-sm font-extrabold text-[var(--brand-text)]">{formatWon(recipient.totalFee)}</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="space-y-4">
            {data.participants.map((participant) => {
              const draft = drafts[participant.id] ?? { label: "", amount: "" };
              return (
                <div key={participant.id} className={`brand-card-soft rounded-3xl p-5 ${participant.companionId ? "ml-6" : ""}`}>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-extrabold text-[var(--brand-text)]">
                        {participant.name}
                        {participant.companionId ? " (동반)" : ""}
                      </p>
                      <p className="brand-text-subtle mt-1 text-xs">
                        참가 {formatWon(participant.breakdown.baseFee)} · 강습 {formatWon(participant.breakdown.lessonFee)} · 대여 {formatWon(participant.breakdown.rentalFee)}
                      </p>
                    </div>
                    <span className="brand-chip-dark rounded-full px-2 py-1 text-xs font-bold">
                      합계 {formatWon(participant.breakdown.totalFee)}
                    </span>
                  </div>

                  <div className="mb-4 space-y-2">
                    {participant.adjustments.length > 0 ? (
                      participant.adjustments.map((adjustment) => (
                        <div key={adjustment.id} className="brand-panel-white flex items-center justify-between gap-3 rounded-2xl px-4 py-3">
                          <div>
                            <p className="text-sm font-semibold text-[var(--brand-text)]">{adjustment.label}</p>
                            <p className={`text-xs font-bold ${adjustment.amount >= 0 ? "text-red-600" : "text-blue-600"}`}>
                              {adjustment.amount >= 0 ? "+" : ""}{formatWon(adjustment.amount)}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteAdjustment(adjustment.id)}
                            className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-bold text-red-600 transition-colors hover:bg-red-50"
                          >
                            삭제
                          </button>
                        </div>
                      ))
                    ) : (
                      <div className="brand-panel-white rounded-2xl px-4 py-4 text-sm brand-text-subtle">
                        추가/차감 항목이 없습니다.
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-[1fr_120px_auto] gap-2">
                    <input
                      value={draft.label}
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [participant.id]: { ...draft, label: event.target.value },
                        }))
                      }
                      placeholder="예: 뒤풀이, 늦게 합류, 할인"
                      className="brand-input rounded-2xl px-4 py-3 text-sm outline-none"
                    />
                    <input
                      value={draft.amount}
                      onChange={(event) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [participant.id]: { ...draft, amount: event.target.value },
                        }))
                      }
                      placeholder="10000 / -5000"
                      className="brand-input rounded-2xl px-4 py-3 text-sm outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddAdjustment(participant.id)}
                      disabled={submittingFor === participant.id}
                      className="brand-button-primary rounded-2xl px-4 py-3 text-sm font-bold"
                    >
                      {submittingFor === participant.id ? "추가 중..." : "추가"}
                    </button>
                  </div>
                </div>
              );
            })}
          </section>
        </div>
      )}

      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => removeToast(toast.id)} />
      ))}
    </AdminLayout>
  );
}
