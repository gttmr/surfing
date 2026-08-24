"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { Toast, useToast } from "@/components/ui/Toast";
import type { AdminSettlementData } from "@/lib/admin-page-data";
import { AdjustmentDeleteDialog, SettlementOpenDialog } from "./AdminMeetingSettlementDialogs";
import { AdminMeetingSettlementOverview } from "./AdminMeetingSettlementOverview";
import { AdminMeetingSettlementRecipients } from "./AdminMeetingSettlementRecipients";
import type {
  AdjustmentDeleteTarget,
  SettlementDraft,
  SettlementDraftChange,
} from "./admin-meeting-settlement-types";

export function AdminMeetingSettlementPageClient({
  meetingId,
  initialData,
}: {
  readonly meetingId: number;
  readonly initialData: AdminSettlementData;
}) {
  const [data, setData] = useState(initialData);
  const [submittingFor, setSubmittingFor] = useState<number | null>(null);
  const [deletingAdjustmentId, setDeletingAdjustmentId] = useState<number | null>(null);
  const [togglingSettlement, setTogglingSettlement] = useState(false);
  const [drafts, setDrafts] = useState<Record<number, SettlementDraft>>({});
  const [selectedRecipientKey, setSelectedRecipientKey] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);
  const [settlementOpenConfirmation, setSettlementOpenConfirmation] = useState(false);
  const [adjustmentDeleteTarget, setAdjustmentDeleteTarget] = useState<AdjustmentDeleteTarget>(null);
  const { toasts, addToast, removeToast } = useToast();

  async function reloadSettlement(): Promise<void> {
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
    if (!stillExists) setSelectedRecipientKey(null);
  }, [data, selectedRecipientKey]);

  async function handleAddAdjustment(participantId: number): Promise<void> {
    const draft = drafts[participantId];
    if (!draft?.label.trim()) {
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

  async function handleDeleteAdjustment(adjustmentId: number): Promise<void> {
    setDeletingAdjustmentId(adjustmentId);
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
    } finally {
      setDeletingAdjustmentId(null);
    }
  }

  async function handleToggleSettlement(): Promise<void> {
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
      if (response.settlementOpen) await reloadSettlement();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "정산 상태를 바꾸지 못했습니다.", "error");
    } finally {
      setTogglingSettlement(false);
    }
  }

  const handleDraftChange: SettlementDraftChange = (participantId, field, value) => {
    setDrafts((prev) => {
      const current = prev[participantId] ?? { label: "", amount: "" };
      const next = field === "label"
        ? { label: value, amount: current.amount }
        : { label: current.label, amount: value };
      return { ...prev, [participantId]: next };
    });
  };

  function requestSettlementToggle(): void {
    if (data.meeting.settlementOpen) {
      void handleToggleSettlement();
      return;
    }
    setSettlementOpenConfirmation(true);
  }

  return (
    <AdminLayout>
      <div className="mb-6 space-y-4">
        <div className="flex items-start gap-3">
          <Link href={`/admin/meetings/${meetingId}`} className="brand-link mt-0.5 text-xl">&larr;</Link>
          <div className="min-w-0 flex-1">
            <h1 className="font-headline break-keep text-[1.7rem] font-extrabold tracking-[-0.03em] text-brand-text">
              정산 관리
            </h1>
            <p className="brand-text-muted mt-0.5 break-keep text-sm">
              {data.meeting.date} {data.meeting.startTime}–{data.meeting.endTime} · {data.meeting.location}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={requestSettlementToggle}
            disabled={togglingSettlement}
            className={`${data.meeting.settlementOpen ? "brand-button-secondary" : "brand-button-primary"} min-h-11 whitespace-nowrap rounded-full px-4 py-2 text-xs font-bold`}
          >
            {togglingSettlement ? "변경 중..." : data.meeting.settlementOpen ? "정산 닫기" : "정산 열기"}
          </button>
        </div>
      </div>

      <div className="space-y-6">
        <AdminMeetingSettlementOverview
          data={data}
          showAmounts={data.meeting.settlementOpen}
          reloading={reloading}
        />
        <AdminMeetingSettlementRecipients
          data={data}
          selectedRecipientKey={selectedRecipientKey}
          showAmounts={data.meeting.settlementOpen}
          drafts={drafts}
          submittingFor={submittingFor}
          onToggle={(key) => setSelectedRecipientKey((current) => (current === key ? null : key))}
          onDraftChange={handleDraftChange}
          onAddAdjustment={(participantId) => void handleAddAdjustment(participantId)}
          onRequestDelete={setAdjustmentDeleteTarget}
        />
      </div>

      <SettlementOpenDialog
        open={settlementOpenConfirmation}
        submitting={togglingSettlement}
        onClose={() => setSettlementOpenConfirmation(false)}
        onConfirm={() => {
          void handleToggleSettlement().finally(() => setSettlementOpenConfirmation(false));
        }}
      />
      <AdjustmentDeleteDialog
        target={adjustmentDeleteTarget}
        submitting={adjustmentDeleteTarget ? deletingAdjustmentId === adjustmentDeleteTarget.id : false}
        onClose={() => setAdjustmentDeleteTarget(null)}
        onConfirm={(target) => {
          void handleDeleteAdjustment(target.id).finally(() => setAdjustmentDeleteTarget(null));
        }}
      />

      {toasts.map((toast) => (
        <Toast key={toast.id} message={toast.message} type={toast.type} onClose={() => removeToast(toast.id)} />
      ))}
    </AdminLayout>
  );
}
