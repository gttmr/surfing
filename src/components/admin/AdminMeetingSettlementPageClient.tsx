"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Toast, useToast } from "@/components/ui/Toast";
import type { AdminSettlementData } from "@/lib/admin-page-data";
import { formatWon } from "@/lib/format";

export function AdminMeetingSettlementPageClient({
  meetingId,
  initialData,
}: {
  meetingId: number;
  initialData: AdminSettlementData;
}) {
  const [data, setData] = useState(initialData);
  const [submittingFor, setSubmittingFor] = useState<number | null>(null);
  const [togglingSettlement, setTogglingSettlement] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, { label: string; amount: string }>>({});
  const [selectedRecipientKey, setSelectedRecipientKey] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  async function reloadSettlement() {
    setReloading(true);
    try {
      const res = await fetch(`/api/admin/meetings/${meetingId}/settlement`);
      const next = await res.json();
      if (!res.ok) throw new Error(next.error || "정산 정보를 불러오지 못했습니다.");
      setData(next as AdminSettlementData);
    } catch (error) {
      addToast(error instanceof Error ? error.message : "정산 정보를 불러오지 못했습니다.", "error");
    } finally {
      setReloading(false);
    }
  }

  useEffect(() => {
    if (!selectedRecipientKey) return;
    const stillExists = data.recipients.some(
      (recipient) => `${recipient.recipientKakaoId}-${recipient.recipientType}` === selectedRecipientKey
    );
    if (!stillExists) {
      setSelectedRecipientKey(null);
    }
  }, [data, selectedRecipientKey]);

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
      const res = await fetch(`/api/admin/meetings/${meetingId}/settlement`, {
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
      await reloadSettlement();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "정산 항목을 추가하지 못했습니다.", "error");
    } finally {
      setSubmittingFor(null);
    }
  }

  async function handleDeleteAdjustment(adjustmentId: number) {
    try {
      const res = await fetch(`/api/admin/meetings/${meetingId}/settlement/${adjustmentId}`, {
        method: "DELETE",
      });
      const response = await res.json();
      if (!res.ok) throw new Error(response.error || "정산 항목을 삭제하지 못했습니다.");
      addToast("정산 항목을 삭제했습니다.", "success");
      await reloadSettlement();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "정산 항목을 삭제하지 못했습니다.", "error");
    }
  }

  async function handleToggleSettlement() {
    setTogglingSettlement(true);
    try {
      const res = await fetch(`/api/admin/meetings/${meetingId}/settlement`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          settlementOpen: !data.meeting.settlementOpen,
        }),
      });
      const response = await res.json();
      if (!res.ok) throw new Error(response.error || "정산 상태를 바꾸지 못했습니다.");
      addToast(
        data.meeting.settlementOpen ? "정산 확인을 닫았습니다." : "정산 확인을 열었습니다.",
        "success"
      );
      setData((prev) => ({
        ...prev,
        meeting: { ...prev.meeting, settlementOpen: response.settlementOpen },
        confirmedRecipientCount: response.settlementOpen ? 0 : prev.confirmedRecipientCount,
        recipients: response.settlementOpen
          ? prev.recipients.map((recipient) => ({ ...recipient, confirmed: false }))
          : prev.recipients,
      }));
      if (response.settlementOpen) {
        await reloadSettlement();
      }
    } catch (error) {
      addToast(error instanceof Error ? error.message : "정산 상태를 바꾸지 못했습니다.", "error");
    } finally {
      setTogglingSettlement(false);
    }
  }

  return (
    <AdminLayout>
      <div className="mb-6 flex items-start gap-3">
        <Link href={`/admin/meetings/${meetingId}`} className="brand-link mt-0.5 text-xl">&larr;</Link>
        <div className="flex-1">
          <h1 className="font-headline text-[1.7rem] font-extrabold tracking-[-0.03em] text-[var(--brand-text)]">정산 관리</h1>
          <p className="brand-text-muted mt-0.5 text-sm">
            {data.meeting.date} {data.meeting.startTime}–{data.meeting.endTime} · {data.meeting.location}
          </p>
        </div>
        <button
          type="button"
          onClick={handleToggleSettlement}
          disabled={togglingSettlement}
          className={data.meeting.settlementOpen ? "brand-button-secondary rounded-full px-3 py-1.5 text-xs font-bold" : "brand-button-primary rounded-full px-3 py-1.5 text-xs font-bold"}
        >
          {togglingSettlement ? "변경 중..." : data.meeting.settlementOpen ? "정산 닫기" : "정산 열기"}
        </button>
      </div>

      <div className="space-y-6">
        <section className="brand-card-soft rounded-3xl p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-base font-extrabold text-[var(--brand-text)]">수신자별 정산 미리보기</h2>
            <div className="flex items-center gap-2">
              <span className={`${data.meeting.settlementOpen ? "brand-chip-dark" : "brand-chip-soft"} rounded-full px-2 py-1 text-xs font-bold`}>
                {data.meeting.settlementOpen ? "정산 오픈" : "정산 준비중"}
              </span>
              <span className="brand-chip-accent rounded-full px-2 py-1 text-xs font-bold">
                확인 {data.confirmedRecipientCount}/{data.recipients.length}
              </span>
              {reloading ? <span className="brand-text-subtle text-xs">갱신 중...</span> : null}
            </div>
          </div>
          <div className="space-y-3">
            {data.recipients.map((recipient) => {
              const recipientKey = `${recipient.recipientKakaoId}-${recipient.recipientType}`;
              const expanded = selectedRecipientKey === recipientKey;
              const selectedParticipantIds = new Set(recipient.items.map((item) => item.participantId));
              const participants = data.participants.filter((participant) => selectedParticipantIds.has(participant.id));

              return (
                <div
                  key={recipientKey}
                  className={`rounded-2xl transition-colors ${
                    expanded ? "brand-panel-white ring-2 ring-[var(--brand-primary)]" : "brand-panel-white"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedRecipientKey((current) => (current === recipientKey ? null : recipientKey))}
                    className="w-full p-4 text-left"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold text-[var(--brand-text)]">{recipient.recipientName}</p>
                          <span className={`${recipient.completed ? "brand-chip-dark" : "brand-chip-soft"} rounded-full px-2 py-0.5 text-[10px] font-bold`}>
                            {recipient.completed ? "송금완료" : "정산 대기"}
                          </span>
                        </div>
                        <p className="brand-text-subtle mt-1 text-xs">
                          {recipient.items.length === 1
                            ? formatWon(recipient.items[0].totalFee)
                            : `${recipient.items.length}건 합산`}
                        </p>
                      </div>
                      <span className="text-sm font-extrabold text-[var(--brand-text)]">{formatWon(recipient.totalFee)}</span>
                    </div>
                  </button>

                  {expanded ? (
                    <div className="border-t border-[var(--brand-divider)] px-4 pb-4 pt-4">
                      <div className="divide-y divide-[var(--brand-divider)]">
                        {participants.map((participant, index) => {
                          const draft = drafts[participant.id] ?? { label: "", amount: "" };
                          return (
                            <div key={participant.id} className={`${index === 0 ? "" : "pt-5"} pb-1`}>
                              <div className="mb-3 flex items-start justify-between gap-3">
                                <div>
                                  <p className="text-base font-extrabold text-[var(--brand-text)]">
                                    {participant.name}
                                    {participant.companionId ? " (동반)" : ""}
                                  </p>
                                  <p className="brand-text-subtle mt-1 text-xs">
                                    참가 {formatWon(participant.breakdown.baseFee)} · 강습 {formatWon(participant.breakdown.lessonFee)} · 대여 {formatWon(participant.breakdown.rentalFee)}
                                    {participant.breakdown.foodSubtotal > 0
                                      ? ` · 식음료 ${formatWon(participant.breakdown.foodSubtotal)} · 지원 -${formatWon(participant.breakdown.foodSupportApplied)}`
                                      : ""}
                                  </p>
                                </div>
                                <span className="rounded-full bg-[var(--brand-primary-soft-accent)] px-2.5 py-1 text-xs font-bold text-[var(--brand-primary-text)]">
                                  {formatWon(participant.breakdown.totalFee)}
                                </span>
                              </div>

                              {participant.foodOrders.length > 0 ? (
                                <div className="mb-4 space-y-2">
                                  {participant.foodOrders.map((item) => (
                                    <div key={item.id} className="brand-panel-white flex items-center justify-between rounded-2xl px-4 py-3">
                                      <div>
                                        <p className="text-sm font-semibold text-[var(--brand-text)]">{item.menuNameSnapshot}</p>
                                        <p className="brand-text-subtle mt-1 text-xs">
                                          {formatWon(item.unitPriceSnapshot)} · 수량 {item.quantity}
                                        </p>
                                      </div>
                                      <span className="text-sm font-bold text-[var(--brand-text)]">
                                        {formatWon(item.unitPriceSnapshot * item.quantity)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : null}

                              <div className="mb-4 space-y-2">
                                {participant.adjustments.length > 0 ? (
                                  participant.adjustments.map((adjustment) => (
                                    <div key={adjustment.id} className="brand-card-soft flex items-center justify-between gap-3 rounded-2xl px-4 py-3">
                                      <div>
                                        <p className="text-sm font-semibold text-[var(--brand-text)]">{adjustment.label}</p>
                                        <p className={`text-xs font-bold ${adjustment.amount >= 0 ? "text-[var(--brand-companion)]" : "text-[var(--brand-primary-text)]"}`}>
                                          {adjustment.amount >= 0 ? "+" : ""}{formatWon(adjustment.amount)}
                                        </p>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteAdjustment(adjustment.id)}
                                        className="brand-button-danger rounded-full px-3 py-1.5 text-xs font-bold transition-colors"
                                      >
                                        삭제
                                      </button>
                                    </div>
                                  ))
                                ) : (
                                  <div className="brand-card-soft rounded-2xl px-4 py-4 text-sm brand-text-subtle">
                                    추가/차감 항목이 없습니다.
                                  </div>
                                )}
                              </div>

                              <div className="grid grid-cols-[minmax(0,1fr)_108px_auto] gap-2">
                                <input
                                  value={draft.label}
                                  onChange={(event) =>
                                    setDrafts((prev) => ({
                                      ...prev,
                                      [participant.id]: { ...draft, label: event.target.value },
                                    }))
                                  }
                                  placeholder="항목명"
                                  className="brand-input min-w-0 rounded-2xl px-4 py-3 text-sm outline-none"
                                />
                                <input
                                  value={draft.amount}
                                  onChange={(event) =>
                                    setDrafts((prev) => ({
                                      ...prev,
                                      [participant.id]: { ...draft, amount: event.target.value },
                                    }))
                                  }
                                  inputMode="decimal"
                                  pattern="[+-]?[0-9]*"
                                  placeholder="금액"
                                  className="brand-input min-w-0 rounded-2xl px-4 py-3 text-sm outline-none"
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
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => removeToast(toast.id)} />
      ))}
    </AdminLayout>
  );
}
