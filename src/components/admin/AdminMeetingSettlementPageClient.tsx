"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import {
  AdminBillingReadinessPanel,
  AdminFinalSettlementPanel,
  AdminPaymentStatusPanel,
} from "@/components/admin/AdminBillingWorkflowPanels";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { Toast, useToast } from "@/components/ui/Toast";
import type { AdminSettlementData, AdminSettlementRecipient } from "@/lib/admin-page-data";
import { formatWon } from "@/lib/format";
import { getOvernightMeetingSpan } from "@/lib/meeting-group";
import { AdjustmentDeleteDialog } from "./AdminMeetingSettlementDialogs";
import { AdminOvernightLodgingPanel } from "./AdminOvernightLodgingPanel";
import { AdminMeetingSettlementOverview } from "./AdminMeetingSettlementOverview";
import { AdminMeetingSettlementRecipients } from "./AdminMeetingSettlementRecipients";
import type {
  AdjustmentDeleteTarget,
  SettlementDraft,
  SettlementDraftChange,
} from "./admin-meeting-settlement-types";

type WorkflowDialog = "publish" | "correct" | "complete" | null;

type ApiResponse = {
  readonly error?: string;
  readonly data?: AdminSettlementData;
};

function pageTitle(data: AdminSettlementData): string {
  const prefix = data.meeting.overnightGroup ? "1박 2일 합산 " : "";
  if (data.billing.settlementCompletedAt) return `${prefix}정산 완료 보고서`;
  return data.meeting.settlementOpen ? `${prefix}입금 현황` : `${prefix}청구 검토`;
}

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
  const [workflowWorking, setWorkflowWorking] = useState<string | null>(null);
  const [workingRecipient, setWorkingRecipient] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<number, SettlementDraft>>({});
  const [selectedRecipientKey, setSelectedRecipientKey] = useState<string | null>(null);
  const [reloading, setReloading] = useState(false);
  const [workflowDialog, setWorkflowDialog] = useState<WorkflowDialog>(null);
  const [adjustmentDeleteTarget, setAdjustmentDeleteTarget] = useState<AdjustmentDeleteTarget>(null);
  const [correctionReason, setCorrectionReason] = useState("");
  const [settlementNote, setSettlementNote] = useState("");
  const [shopPayoutDraft, setShopPayoutDraft] = useState(String(initialData.billing.shopPayout.amount ?? initialData.billing.totals.shopPayableTotal));
  const [foodPayoutDraft, setFoodPayoutDraft] = useState(String(initialData.billing.foodPayout.amount ?? initialData.billing.totals.foodPayableTotal));
  const [lodgingParticipantIds, setLodgingParticipantIds] = useState<number[]>([]);
  const [lodgingLabel, setLodgingLabel] = useState("공동 숙박비");
  const [lodgingAmount, setLodgingAmount] = useState("");
  const [lodgingWorking, setLodgingWorking] = useState(false);
  const { toasts, addToast, removeToast } = useToast();

  async function reloadSettlement(): Promise<void> {
    setReloading(true);
    try {
      const response = await fetch(`/api/admin/meetings/${meetingId}/settlement`, { cache: "no-store" });
      const next = await response.json() as ApiResponse | AdminSettlementData;
      if (!response.ok) throw new Error("error" in next && next.error ? next.error : "청구 정보를 불러오지 못했습니다.");
      setData(next as AdminSettlementData);
    } catch (error) {
      addToast(error instanceof Error ? error.message : "청구 정보를 불러오지 못했습니다.", "error");
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

  async function runWorkflowAction(
    key: string,
    body: Record<string, unknown>,
    successMessage: string
  ): Promise<boolean> {
    setWorkflowWorking(key);
    try {
      const response = await fetch(`/api/admin/meetings/${meetingId}/settlement`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await response.json() as ApiResponse;
      if (!response.ok) throw new Error(result.error || "요청을 처리하지 못했습니다.");
      if (result.data) setData(result.data);
      else await reloadSettlement();
      addToast(successMessage, "success");
      return true;
    } catch (error) {
      addToast(error instanceof Error ? error.message : "요청을 처리하지 못했습니다.", "error");
      return false;
    } finally {
      setWorkflowWorking(null);
    }
  }

  async function handleAddAdjustment(participantId: number): Promise<void> {
    const draft = drafts[participantId];
    if (!draft?.label.trim()) {
      addToast("조정 항목 이름을 입력해 주세요.", "error");
      return;
    }
    const amountMagnitude = Number(draft.amount);
    if (!draft.amount || !Number.isInteger(amountMagnitude) || amountMagnitude < 0) {
      addToast("조정 금액을 0원 이상의 정수로 입력해 주세요.", "error");
      return;
    }
    const amount = draft.direction === "deduct" ? -amountMagnitude : amountMagnitude;

    setSubmittingFor(participantId);
    try {
      const response = await fetch(`/api/admin/meetings/${meetingId}/settlement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ participantId, label: draft.label, amount }),
      });
      const result = await response.json() as ApiResponse;
      if (!response.ok) throw new Error(result.error || "청구 조정을 추가하지 못했습니다.");
      setDrafts((current) => ({
        ...current,
        [participantId]: { label: "", amount: "", direction: "increase" },
      }));
      addToast("청구 조정을 추가했습니다.", "success");
      await reloadSettlement();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "청구 조정을 추가하지 못했습니다.", "error");
    } finally {
      setSubmittingFor(null);
    }
  }

  async function handleDeleteAdjustment(adjustmentId: number): Promise<void> {
    setDeletingAdjustmentId(adjustmentId);
    try {
      const response = await fetch(`/api/admin/meetings/${meetingId}/settlement/${adjustmentId}`, { method: "DELETE" });
      const result = await response.json() as ApiResponse;
      if (!response.ok) throw new Error(result.error || "청구 조정을 삭제하지 못했습니다.");
      addToast("청구 조정을 삭제했습니다.", "success");
      await reloadSettlement();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "청구 조정을 삭제하지 못했습니다.", "error");
    } finally {
      setDeletingAdjustmentId(null);
    }
  }

  async function handleBatchLodging(): Promise<void> {
    const amount = Number(lodgingAmount);
    if (lodgingParticipantIds.length === 0) {
      addToast("숙박비를 반영할 회원을 선택해 주세요.", "error");
      return;
    }
    if (!lodgingLabel.trim() || !Number.isInteger(amount) || amount <= 0) {
      addToast("숙박비 항목명과 0원보다 큰 1인 금액을 입력해 주세요.", "error");
      return;
    }
    setLodgingWorking(true);
    try {
      const response = await fetch(`/api/admin/meetings/${meetingId}/settlement`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "batch-lodging",
          participantIds: lodgingParticipantIds,
          label: lodgingLabel.trim(),
          amount,
        }),
      });
      const result = await response.json() as ApiResponse;
      if (!response.ok) throw new Error(result.error || "숙박비를 반영하지 못했습니다.");
      setLodgingParticipantIds([]);
      setLodgingAmount("");
      addToast(`${lodgingParticipantIds.length}명에게 숙박비를 추가했습니다.`, "success");
      await reloadSettlement();
    } catch (error) {
      addToast(error instanceof Error ? error.message : "숙박비를 반영하지 못했습니다.", "error");
    } finally {
      setLodgingWorking(false);
    }
  }

  const handleDraftChange: SettlementDraftChange = (participantId, change) => {
    setDrafts((current) => {
      const draft = current[participantId] ?? { label: "", amount: "", direction: "increase" };
      return {
        ...current,
        [participantId]: { ...draft, ...change },
      };
    });
  };

  async function handleReviewToggle(reviewed: boolean) {
    await runWorkflowAction(
      reviewed ? "unconfirm-review" : "confirm-review",
      { action: reviewed ? "unconfirm-review" : "confirm-review" },
      reviewed ? "청구 검토 완료를 취소했습니다." : "회원별 청구 금액을 확정했습니다."
    );
  }

  async function handlePaymentVerification(recipient: AdminSettlementRecipient, verified: boolean) {
    setWorkingRecipient(recipient.recipientKakaoId);
    await runWorkflowAction(
      verified ? "unverify-payment" : "verify-payment",
      { action: verified ? "unverify-payment" : "verify-payment", recipientKakaoId: recipient.recipientKakaoId },
      verified ? `${recipient.recipientName}님의 입금 확인을 취소했습니다.` : `${recipient.recipientName}님의 계좌 입금을 확인했습니다.`
    );
    setWorkingRecipient(null);
  }

  async function handlePayout(type: "shop" | "food", draft: string) {
    const amount = Number(draft);
    if (!Number.isInteger(amount) || amount < 0) {
      addToast("실제 지급액을 0원 이상의 숫자로 입력해 주세요.", "error");
      return;
    }
    await runWorkflowAction(
      type,
      { action: "record-payout", payoutType: type, amount },
      type === "shop" ? "샵 실제 지급액을 기록했습니다." : "식음료 실제 지급액을 기록했습니다."
    );
  }

  const reviewComplete = Boolean(data.readiness.checks.find((check) => check.id === "billing-reviewed")?.complete);
  const accountLabel = [data.billing.account.bankName, data.billing.account.accountNumber, data.billing.account.accountHolder]
    .filter(Boolean)
    .join(" · ");
  const lodgingParticipants = data.meeting.overnightGroup
    ? data.participants.filter((participant) => participant.usesClubLodging)
    : [];
  const overnightDays = data.meeting.overnightGroup?.days;
  const overnightSpan = data.meeting.overnightGroup ? getOvernightMeetingSpan(data.meeting.overnightGroup) : null;

  return (
    <AdminLayout>
      <div className="space-y-5">
        <header>
          <div className="flex items-start gap-3">
            <Link aria-label="모임 상세로 돌아가기" className="brand-button-secondary flex h-11 w-11 shrink-0 items-center justify-center rounded-full" href={`/admin/meetings/${meetingId}`}><Icon name="arrow_back" /></Link>
            <div className="min-w-0 flex-1">
              <p className="brand-text-subtle text-xs font-bold">{data.workflowLabel}</p>
              <h1 className="mt-1 font-headline text-[1.6rem] font-extrabold tracking-[-0.03em] text-brand-text">{pageTitle(data)}</h1>
              {overnightDays && overnightSpan ? (
                <>
                  <p className="brand-text-muted mt-1 break-keep text-sm">{overnightSpan.startDate}–{overnightSpan.endDate} · {overnightSpan.location}</p>
                  <p className="brand-text-subtle mt-0.5 text-xs">{overnightSpan.startTime} 시작 · {overnightSpan.endTime} 종료</p>
                </>
              ) : (
                <p className="brand-text-muted mt-1 break-keep text-sm">{data.meeting.date} {data.meeting.startTime}–{data.meeting.endTime} · {data.meeting.location}</p>
              )}
            </div>
            <button aria-label="청구 정보 새로고침" className="brand-button-secondary flex h-11 w-11 shrink-0 items-center justify-center rounded-full" disabled={reloading} onClick={() => void reloadSettlement()} type="button"><Icon className={reloading ? "animate-spin" : ""} name="refresh" /></button>
          </div>
          {data.meeting.settlementOpen ? (
            <div className="mt-3 flex items-center justify-between gap-3">
              <span className="brand-chip-success rounded-full px-2.5 py-1 text-xs font-bold">회원 공개됨{data.billing.revision ? ` · v${data.billing.revision}` : ""}</span>
              <button className="brand-button-secondary min-h-11 rounded-xl px-3 text-xs font-bold" onClick={() => setWorkflowDialog("correct")} type="button">청구 정정</button>
            </div>
          ) : data.billing.correctionReason ? (
            <div className="brand-alert-info mt-3 rounded-xl px-3 py-3 text-xs"><strong>정정 중</strong><span className="ml-2">{data.billing.correctionReason}</span></div>
          ) : null}
        </header>

        <AdminMeetingSettlementOverview data={data} reloading={reloading} />

        {!data.meeting.settlementOpen ? (
          <>
            {data.meeting.overnightGroup?.lodgingFee === 0 ? (
              <AdminOvernightLodgingPanel
                amount={lodgingAmount}
                editable={!reviewComplete}
                label={lodgingLabel}
                onAmountChange={setLodgingAmount}
                onLabelChange={setLodgingLabel}
                onSelectAll={() => setLodgingParticipantIds((current) => current.length === lodgingParticipants.length ? [] : lodgingParticipants.map((participant) => participant.id))}
                onSubmit={() => void handleBatchLodging()}
                onToggleParticipant={(participantId) => setLodgingParticipantIds((current) => current.includes(participantId) ? current.filter((id) => id !== participantId) : [...current, participantId])}
                participants={lodgingParticipants}
                selectedParticipantIds={lodgingParticipantIds}
                submitting={lodgingWorking}
              />
            ) : data.meeting.overnightGroup ? (
              <section className="brand-panel-soft flex items-center justify-between gap-3 rounded-2xl px-4 py-4">
                <div>
                  <h2 className="text-sm font-extrabold text-brand-text">숙박비 자동 반영</h2>
                  <p className="brand-text-subtle mt-1 text-xs">숙소를 선택한 {lodgingParticipants.length}명에게 한 번씩 반영됩니다.</p>
                </div>
                <strong className="shrink-0 text-sm text-brand-primary">1인 {formatWon(data.meeting.overnightGroup.lodgingFee)}</strong>
              </section>
            ) : null}
            <AdminBillingReadinessPanel data={data} onToggleReview={(reviewed) => void handleReviewToggle(reviewed)} working={workflowWorking === "confirm-review" || workflowWorking === "unconfirm-review"} />
            <section className="space-y-3">
              <div className="px-1">
                <h2 className="text-base font-extrabold text-brand-text">회원별 청구 항목</h2>
                <p className="brand-text-muted mt-1 text-xs">실제 이용과 식음료를 확인하고 필요한 조정만 추가합니다.</p>
              </div>
              <AdminMeetingSettlementRecipients
                data={data}
                drafts={drafts}
                editable={!reviewComplete}
                onAddAdjustment={(participantId) => void handleAddAdjustment(participantId)}
                onDraftChange={handleDraftChange}
                onRequestDelete={setAdjustmentDeleteTarget}
                onToggle={(key) => setSelectedRecipientKey((current) => current === key ? null : key)}
                selectedRecipientKey={selectedRecipientKey}
                showAmounts
                submittingFor={submittingFor}
              />
            </section>
            <section className="brand-panel-strong rounded-2xl px-4 py-4">
              <h2 className="text-sm font-extrabold text-brand-text">회원에게 청구 내역 공개</h2>
              <p className="brand-text-muted mt-1 break-keep text-xs">공개 시 현재 금액과 입금 계좌를 스냅샷으로 고정하고 회원에게 알립니다.</p>
              <button className="brand-button-primary mt-4 min-h-12 w-full rounded-xl px-4 text-sm font-extrabold disabled:opacity-50" disabled={!data.readiness.ready || Boolean(workflowWorking)} onClick={() => setWorkflowDialog("publish")} type="button">청구 내역 공개</button>
              {!data.readiness.ready ? <p className="brand-text-subtle mt-2 text-center text-xs">준비 항목을 모두 완료해야 공개할 수 있습니다.</p> : null}
            </section>
          </>
        ) : (
          <>
            <section className="brand-panel rounded-2xl px-4 py-4">
              <p className="brand-text-subtle text-xs font-bold">회원 입금 계좌</p>
              <p className="mt-1 break-all text-sm font-extrabold text-brand-text">{accountLabel || "계좌 정보 없음"}</p>
              {data.billing.publishedAt ? <p className="brand-text-subtle mt-2 text-xs">공개 {new Date(data.billing.publishedAt).toLocaleString("ko-KR")}</p> : null}
            </section>
            <AdminPaymentStatusPanel data={data} onVerify={(recipient, verified) => void handlePaymentVerification(recipient, verified)} workingRecipient={workingRecipient} />
            <AdminFinalSettlementPanel
              data={data}
              foodDraft={foodPayoutDraft}
              onFoodDraft={setFoodPayoutDraft}
              onRecordFood={() => void handlePayout("food", foodPayoutDraft)}
              onRecordShop={() => void handlePayout("shop", shopPayoutDraft)}
              onRequestComplete={() => setWorkflowDialog("complete")}
              onShopDraft={setShopPayoutDraft}
              shopDraft={shopPayoutDraft}
              working={workflowWorking}
            />
          </>
        )}
      </div>

      <Dialog closeLabel="청구 공개 창 닫기" onClose={() => setWorkflowDialog(null)} open={workflowDialog === "publish"} title="청구 내역을 공개할까요?">
        <p className="brand-text-muted break-keep text-sm">회원별 금액과 입금 계좌가 고정되고, 각 회원에게 청구 알림이 전송됩니다.</p>
        <div className="brand-panel mt-4 rounded-xl px-3 py-3 text-sm">
          <p className="brand-text-subtle text-xs font-bold">회원 청구 합계</p>
          <p className="mt-1 text-lg font-extrabold text-brand-text">{formatWon(data.billing.totals.memberChargeTotal)}</p>
          <p className="brand-text-subtle mt-1 break-all text-xs">{accountLabel || "입금 계좌가 설정되지 않았습니다."}</p>
        </div>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button className="brand-button-secondary min-h-11 rounded-xl text-sm font-bold" onClick={() => setWorkflowDialog(null)} type="button">돌아가기</button>
          <button className="brand-button-primary min-h-11 rounded-xl text-sm font-extrabold" disabled={workflowWorking === "publish"} onClick={() => void runWorkflowAction("publish", { action: "publish" }, "청구 내역을 회원에게 공개했습니다.").then((ok) => { if (ok) setWorkflowDialog(null); })} type="button">{workflowWorking === "publish" ? "공개 중" : "공개하기"}</button>
        </div>
      </Dialog>

      <Dialog closeLabel="청구 정정 창 닫기" onClose={() => setWorkflowDialog(null)} open={workflowDialog === "correct"} title="공개된 청구를 정정할까요?">
        <p className="brand-text-muted break-keep text-sm">회원 화면의 현재 청구를 닫고 수정 단계로 돌아갑니다. 입금 확인과 지급 기록은 초기화됩니다.</p>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-bold text-brand-text">정정 사유</span>
          <textarea className="brand-input w-full resize-none rounded-xl px-3 py-3 text-base" maxLength={200} onChange={(event) => setCorrectionReason(event.target.value)} placeholder="예: 샵 실제 이용 수량 정정" rows={3} value={correctionReason} />
        </label>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button className="brand-button-secondary min-h-11 rounded-xl text-sm font-bold" onClick={() => setWorkflowDialog(null)} type="button">돌아가기</button>
          <button className="brand-button-danger-solid min-h-11 rounded-xl text-sm font-extrabold disabled:opacity-50" disabled={!correctionReason.trim() || workflowWorking === "reopen"} onClick={() => void runWorkflowAction("reopen", { action: "reopen", correctionReason }, "청구 정정을 시작했습니다.").then((ok) => { if (ok) { setWorkflowDialog(null); setCorrectionReason(""); } })} type="button">{workflowWorking === "reopen" ? "처리 중" : "정정 시작"}</button>
        </div>
      </Dialog>

      <Dialog closeLabel="최종 정산 완료 창 닫기" onClose={() => setWorkflowDialog(null)} open={workflowDialog === "complete"} title="최종 정산을 완료할까요?">
        <p className="brand-text-muted break-keep text-sm">회원 입금과 외부 지급 기록을 확인했습니다. 완료 후에는 이 모임을 잠긴 보고서로 봅니다.</p>
        <label className="mt-4 block">
          <span className="mb-1.5 block text-sm font-bold text-brand-text">운영 메모 <span className="brand-text-subtle font-normal">선택</span></span>
          <textarea className="brand-input w-full resize-none rounded-xl px-3 py-3 text-base" maxLength={300} onChange={(event) => setSettlementNote(event.target.value)} placeholder="차액이나 특이사항을 기록하세요." rows={3} value={settlementNote} />
        </label>
        <div className="mt-5 grid grid-cols-2 gap-2">
          <button className="brand-button-secondary min-h-11 rounded-xl text-sm font-bold" onClick={() => setWorkflowDialog(null)} type="button">돌아가기</button>
          <button className="brand-button-primary min-h-11 rounded-xl text-sm font-extrabold" disabled={workflowWorking === "complete-settlement"} onClick={() => void runWorkflowAction("complete-settlement", { action: "complete-settlement", note: settlementNote }, "최종 정산을 완료했습니다.").then((ok) => { if (ok) setWorkflowDialog(null); })} type="button">{workflowWorking === "complete-settlement" ? "완료 중" : "완료하기"}</button>
        </div>
      </Dialog>

      <AdjustmentDeleteDialog
        onClose={() => setAdjustmentDeleteTarget(null)}
        onConfirm={(target) => void handleDeleteAdjustment(target.id).finally(() => setAdjustmentDeleteTarget(null))}
        submitting={adjustmentDeleteTarget ? deletingAdjustmentId === adjustmentDeleteTarget.id : false}
        target={adjustmentDeleteTarget}
      />

      {toasts.map((toast) => <Toast key={toast.id} message={toast.message} onClose={() => removeToast(toast.id)} type={toast.type} />)}
    </AdminLayout>
  );
}
