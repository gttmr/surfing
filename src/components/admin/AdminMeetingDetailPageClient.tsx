"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminMeetingFeesSection } from "@/components/admin/AdminMeetingFeesSection";
import { AdminMeetingParticipants, type ParticipantAction, type ParticipantTab } from "@/components/admin/AdminMeetingParticipants";
import { isAdminMeetingDetail, meetingResponseError } from "@/components/admin/admin-meeting-response";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { Toast, useToast } from "@/components/ui/Toast";
import type { AdminMeetingDetail, AdminMeetingParticipant, AdminSettlementData } from "@/lib/admin-page-data";
import { DAY_KO } from "@/lib/format";
import { isOvernightMeeting, lastMeetingDate } from "@/lib/meeting-days";

type Confirmation =
  | { readonly kind: "delete" }
  | { readonly kind: "end" }
  | { readonly kind: "participant"; readonly action: ParticipantAction; readonly participant: AdminMeetingParticipant };

type AdminMeetingDetailPageClientProps = {
  readonly meetingId: number;
  readonly initialMeeting: AdminMeetingDetail;
  readonly initialOperations: AdminSettlementData;
};

function displayDate(dateValue: string): string {
  const date = new Date(`${dateValue}T00:00:00`);
  const [, month, day] = dateValue.split("-");
  return `${Number(month)}월 ${Number(day)}일 (${DAY_KO[date.getDay()]})`;
}

const PARTICIPANT_ACTION_COPY: Record<ParticipantAction, { readonly title: string; readonly button: string; readonly toast: string }> = {
  approve: { title: "참가를 확정할까요?", button: "참가 확정", toast: "참가를 확정 상태로 변경했습니다" },
  cancel: { title: "참가를 취소할까요?", button: "참가 취소", toast: "참가를 취소 상태로 변경했습니다" },
  attended: { title: "참석으로 되돌릴까요?", button: "참석으로 되돌리기", toast: "참석으로 되돌렸습니다" },
  absent: { title: "불참으로 처리할까요?", button: "불참 처리", toast: "불참으로 처리했습니다" },
  "lodging-on": { title: "숙박비를 청구할까요?", button: "숙박 포함", toast: "숙박 대상에 추가했습니다" },
  "lodging-off": { title: "숙박비를 빼 줄까요?", button: "숙박 제외", toast: "숙박 대상에서 뺐습니다" },
};

const PARTICIPANT_ACTION_DESCRIPTION: Record<ParticipantAction, { readonly action: string; readonly consequence: string }> = {
  approve: { action: "참가를 확정합니다", consequence: "다른 참가자의 상태는 바뀌지 않습니다." },
  cancel: { action: "참가를 취소합니다", consequence: "패널티와 다른 참가자 상태는 바뀌지 않습니다." },
  attended: { action: "참석으로 되돌립니다", consequence: "실제 이용 확인 대상에 다시 포함됩니다." },
  absent: { action: "불참으로 처리합니다", consequence: "참가비는 그대로 청구되고, 실제 이용 확인 대상에서만 빠집니다." },
  "lodging-on": { action: "숙박 대상에 추가합니다", consequence: "1인 숙박비가 일정 전체에 한 번 청구됩니다." },
  "lodging-off": { action: "숙박 대상에서 뺍니다", consequence: "숙박비가 청구되지 않습니다." },
};

function nextActionLabel(operations: AdminSettlementData): string {
  const nextIncomplete = operations.readiness.checks.find((check) => !check.complete);
  if (operations.workflowStage === "PAYMENT_CONFIRMATION") return "회원 입금 확인하기";
  if (operations.workflowStage === "FINAL_SETTLEMENT") return "샵 지급 기록하고 마감";
  if (operations.workflowStage === "COMPLETED") return "완료 보고서 확인하기";
  return nextIncomplete?.label ?? "청구 내역 검토하기";
}

function nextActionHref(operations: AdminSettlementData, meetingId: number): string {
  if (
    operations.workflowStage === "PAYMENT_CONFIRMATION"
    || operations.workflowStage === "FINAL_SETTLEMENT"
    || operations.workflowStage === "COMPLETED"
  ) {
    return `/admin/meetings/${meetingId}/settlement`;
  }
  const nextIncomplete = operations.readiness.checks.find((check) => !check.complete);
  return nextIncomplete?.href ?? `/admin/meetings/${meetingId}/settlement`;
}

export function AdminMeetingDetailPageClient({ meetingId, initialMeeting, initialOperations }: AdminMeetingDetailPageClientProps) {
  const [meeting, setMeeting] = useState(initialMeeting);
  const [activeTab, setActiveTab] = useState<ParticipantTab>("approved");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [reloading, setReloading] = useState(false);
  const [working, setWorking] = useState(false);
  const [pageError, setPageError] = useState("");
  const [dialogError, setDialogError] = useState("");
  const { toasts, addToast, removeToast } = useToast();
  const router = useRouter();
  const meetingName = `${displayDate(meeting.date)} · ${meeting.location}`;

  async function reloadMeeting() {
    setReloading(true);
    setPageError("");
    try {
      const response = await fetch(`/api/meetings/${meeting.id}`);
      if (!response.ok) {
        setPageError(await meetingResponseError(response, "모임 정보를 다시 불러오지 못했습니다."));
        return;
      }
      const value: unknown = await response.json();
      if (!isAdminMeetingDetail(value)) {
        setPageError("모임 응답을 읽지 못했습니다. 다시 시도해 주세요.");
        return;
      }
      setMeeting(value);
    } catch (error) {
      setPageError(error instanceof Error ? "네트워크 연결을 확인하고 다시 시도해 주세요." : "모임 정보를 다시 불러오지 못했습니다.");
    } finally {
      setReloading(false);
    }
  }

  async function handleToggleOpen() {
    setWorking(true);
    setPageError("");
    try {
      const response = await fetch(`/api/meetings/${meeting.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isOpen: !meeting.isOpen }),
      });
      if (!response.ok) {
        const detail = await meetingResponseError(response, "잠시 후 다시 시도해 주세요.");
        setPageError(`신청 상태를 바꾸지 못했습니다. ${detail}`);
        addToast("신청 상태를 바꾸지 못했습니다", "error");
        return;
      }
      setMeeting((current) => ({ ...current, isOpen: !current.isOpen }));
      addToast(meeting.isOpen ? "신청을 마감했습니다" : "신청을 다시 열었습니다", "success");
      router.refresh();
    } catch (error) {
      setPageError(error instanceof Error ? "네트워크 연결을 확인하고 다시 시도해 주세요." : "신청 상태를 바꾸지 못했습니다.");
      addToast("신청 상태를 바꾸지 못했습니다", "error");
    } finally {
      setWorking(false);
    }
  }

  async function handleParticipantAction(target: Extract<Confirmation, { readonly kind: "participant" }>) {
    const response = await fetch(`/api/participants/${target.participant.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: target.action }),
    });
    if (!response.ok) {
      setDialogError(await meetingResponseError(response, "참가 상태를 변경하지 못했습니다."));
      return;
    }
    setConfirmation(null);
    addToast(PARTICIPANT_ACTION_COPY[target.action].toast, "success");
    await reloadMeeting();
    router.refresh();
  }

  async function handleDelete() {
    const response = await fetch(`/api/meetings/${meeting.id}`, { method: "DELETE" });
    if (!response.ok) {
      setDialogError(await meetingResponseError(response, "모임을 삭제하지 못했습니다."));
      return;
    }
    setConfirmation(null);
    addToast("모임을 삭제했습니다", "success");
    requestAnimationFrame(() => router.push("/admin/meetings"));
  }

  async function handleSetEnded(ended: boolean) {
    const response = await fetch(`/api/meetings/${meeting.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ended }),
    });
    if (!response.ok) {
      const message = await meetingResponseError(response, ended ? "모임을 종료하지 못했습니다." : "모임 종료를 취소하지 못했습니다.");
      if (ended) setDialogError(message);
      else setPageError(message);
      return;
    }
    setConfirmation(null);
    addToast(ended ? "모임을 종료했습니다" : "모임 종료를 취소했습니다", "success");
    await reloadMeeting();
    router.refresh();
  }

  async function handleUndoEnd() {
    setWorking(true);
    setPageError("");
    try {
      await handleSetEnded(false);
    } catch {
      setPageError("네트워크 연결을 확인하고 다시 시도해 주세요.");
    } finally {
      setWorking(false);
    }
  }

  async function handleConfirmedAction() {
    if (!confirmation) return;
    setWorking(true);
    setDialogError("");
    try {
      switch (confirmation.kind) {
        case "delete":
          await handleDelete();
          break;
        case "end":
          await handleSetEnded(true);
          break;
        case "participant":
          await handleParticipantAction(confirmation);
          break;
        default: {
          const exhaustive: never = confirmation;
          return exhaustive;
        }
      }
    } catch (error) {
      setDialogError(error instanceof Error ? "네트워크 연결을 확인하고 다시 시도해 주세요." : "요청을 처리하지 못했습니다.");
    } finally {
      setWorking(false);
    }
  }

  function requestParticipantAction(request: { readonly action: ParticipantAction; readonly participant: AdminMeetingParticipant }) {
    setDialogError("");
    setConfirmation({ kind: "participant", ...request });
  }

  const participantConfirmation = confirmation?.kind === "participant" ? confirmation : null;
  const participantCopy = participantConfirmation ? PARTICIPANT_ACTION_COPY[participantConfirmation.action] : null;
  const participantDescription = participantConfirmation ? PARTICIPANT_ACTION_DESCRIPTION[participantConfirmation.action] : null;
  const dialogTitle = confirmation?.kind === "delete"
    ? "모임을 삭제할까요?"
    : confirmation?.kind === "end"
      ? "모임을 종료할까요?"
      : participantCopy?.title ?? "상태를 변경할까요?";
  const dialogDescription = confirmation?.kind === "delete"
    ? `“${meetingName}” 모임과 참가·주문·청구·입금 등 운영 기록도 함께 삭제되며 복구할 수 없습니다.`
    : confirmation?.kind === "end"
      ? "신청이 닫히고 실제 이용 확인과 청구 단계로 넘어갑니다. 청구를 공개하기 전에는 종료를 취소할 수 있습니다."
      : participantConfirmation
      ? <>“{meetingName}” 모임의 <span className="inline-block whitespace-nowrap" data-dialog-chunk="participant-name">{participantConfirmation.participant.name}님</span>의 <span className="inline-block whitespace-nowrap" data-dialog-chunk="participant-action">{participantDescription?.action}</span>. {participantDescription?.consequence}</>
      : undefined;
  const completedReadinessCount = initialOperations.readiness.checks.filter((check) => check.complete).length;
  const workflowProgressLabel = initialOperations.billing.settlementCompletedAt
    ? "정산 완료"
    : initialOperations.meeting.billingPublished
      ? `${initialOperations.verifiedRecipientCount}/${initialOperations.recipients.length} 입금`
      : `${completedReadinessCount}/${initialOperations.readiness.checks.length} 확인`;
  const billingHref = `/admin/meetings/${meetingId}/settlement`;
  const meetingEnded = initialOperations.workflowStage !== "RECRUITING" && initialOperations.workflowStage !== "UPCOMING";
  const nextHref = nextActionHref(initialOperations, meetingId);
  const meetingEndDate = lastMeetingDate(meeting);
  const overnight = isOvernightMeeting(meeting);
  const waitlistedCount = meeting.participants.filter((participant) => participant.status === "WAITLISTED").length;
  const usageLinkLabel = initialOperations.workflowStage === "RECRUITING" || initialOperations.workflowStage === "UPCOMING"
    ? "이용 예정 현황"
    : "실제 이용 확인";

  return (
    <AdminLayout>
      <div className="space-y-4">
        <header>
          <div className="flex items-start gap-3">
            <Link aria-label="모임 목록으로 돌아가기" className="brand-button-secondary flex h-11 w-11 shrink-0 items-center justify-center rounded-full" href="/admin/meetings"><Icon name="arrow_back" /></Link>
            <div className="min-w-0 flex-1">
              <p className="brand-text-subtle text-xs font-bold">MEETING DETAIL</p>
              <h1 className="mt-1 font-headline text-[1.55rem] font-extrabold tracking-[-0.03em] text-brand-text">
                {overnight
                  ? `${displayDate(meeting.date)} – ${displayDate(meetingEndDate)}`
                  : displayDate(meeting.date)}
              </h1>
              <p className="brand-text-muted mt-1 break-keep text-sm">
                {overnight
                  ? `${meeting.startTime} 시작 · ${meeting.endTime} 종료 · ${meeting.location}`
                  : `${meeting.startTime}–${meeting.endTime} · ${meeting.location}`}
              </p>
            </div>
            <button aria-label="모임 정보 새로고침" className="brand-button-secondary flex h-11 w-11 shrink-0 items-center justify-center rounded-full" disabled={reloading} onClick={() => void reloadMeeting()} type="button"><Icon className={reloading ? "animate-spin" : ""} name="refresh" /></button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="brand-chip-soft rounded-full px-2.5 py-1 font-bold">{meeting.meetingType}</span>
            {overnight ? <span className="brand-chip-accent rounded-full px-2.5 py-1 font-bold">1박 2일</span> : null}
            <span className={meeting.isOpen ? "brand-chip-success rounded-full px-2.5 py-1 font-bold" : "brand-chip-dimmed rounded-full px-2.5 py-1 font-bold"}>{meeting.isOpen ? "신청 중" : "신청 마감"}</span>
            <span className="brand-text-muted font-semibold">확정 {meeting.approvedCount}명</span>
          </div>
        </header>

        {pageError ? <div aria-live="polite" className="brand-alert-error flex items-start justify-between gap-3 rounded-2xl p-4 text-sm" role="status"><span className="font-semibold">{pageError}</span><button className="brand-button-secondary shrink-0 rounded-xl px-3 py-2 text-xs font-bold" disabled={reloading} onClick={() => void reloadMeeting()} type="button">다시 시도</button></div> : null}


        {meetingEnded ? (
          <section className="brand-panel overflow-hidden rounded-2xl">
            <div className="bg-brand-primary-soft px-4 py-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="brand-text-subtle text-xs font-bold">현재 단계</p>
                  <h2 className="mt-1 text-lg font-extrabold text-brand-text">{initialOperations.workflowLabel}</h2>
                </div>
                <span className="brand-chip-soft rounded-full px-3 py-1 text-xs font-bold">{workflowProgressLabel}</span>
              </div>
              <Link className="mt-4 flex min-h-11 items-center justify-between rounded-xl bg-brand-surface px-3 text-sm font-extrabold text-brand-primary" href={nextHref}>
                <span><span className="brand-text-subtle mr-2 text-xs">다음 할 일</span>{nextActionLabel(initialOperations)}</span>
                <Icon name="arrow_forward" />
              </Link>
            </div>
            {meeting.endedAt && !initialOperations.meeting.billingPublished ? (
              <button
                className="brand-link flex min-h-11 w-full items-center justify-center border-b border-brand-divider px-4 text-xs font-bold disabled:opacity-50"
                disabled={working}
                onClick={() => void handleUndoEnd()}
                type="button"
              >
                모임 종료 취소
              </button>
            ) : null}
            {!initialOperations.meeting.billingPublished ? (
              <details>
                <summary className="brand-touch-target flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-bold text-brand-text">
                  공개 전 확인 항목
                  <Icon className="brand-text-subtle" name="expand_more" />
                </summary>
                <div className="space-y-1 border-t border-brand-divider px-4 py-3">
                  {initialOperations.readiness.checks.map((check) => (
                    <div className="flex min-h-11 items-center gap-3" key={check.id}>
                      <Icon className={check.complete ? "text-brand-success" : "text-brand-text-subtle"} name={check.complete ? "check_circle" : "radio_button_unchecked"} />
                      <span className="min-w-0 flex-1 text-sm font-semibold text-brand-text">{check.label}</span>
                      {!check.complete && check.href ? <Link className="flex min-h-11 min-w-11 items-center justify-center text-xs font-bold text-brand-primary" href={check.href}>확인</Link> : null}
                    </div>
                  ))}
                </div>
              </details>
            ) : null}
          </section>
        ) : (
          <section className="brand-panel overflow-hidden rounded-2xl">
            <div className="bg-brand-primary-soft px-4 py-4">
              <p className="brand-text-subtle text-xs font-bold">현재 단계</p>
              <h2 className="mt-1 text-lg font-extrabold text-brand-text">{initialOperations.workflowLabel}</h2>
              <p className="brand-text-muted mt-1 break-keep text-xs leading-5">
                모임을 마치면 &lsquo;모임 종료&rsquo;를 눌러 주세요. 이용 확인과 청구가 열립니다. 누르지 않아도 {displayDate(meetingEndDate)} {meeting.endTime}이 지나면 자동으로 넘어갑니다.
              </p>
              <button
                className="brand-button-primary mt-3 min-h-11 w-full rounded-xl px-3 text-sm font-bold"
                disabled={working}
                onClick={() => { setDialogError(""); setConfirmation({ kind: "end" }); }}
                type="button"
              >
                모임 종료
              </button>
              {waitlistedCount > 0 ? (
                <button
                  className="mt-3 flex min-h-11 w-full items-center justify-between rounded-xl bg-brand-surface px-3 text-sm font-extrabold text-brand-primary"
                  onClick={() => {
                    setActiveTab("waitlisted");
                    document.getElementById("participants")?.scrollIntoView({ behavior: "smooth" });
                  }}
                  type="button"
                >
                  대기자 {waitlistedCount}명 확인하기
                  <Icon name="arrow_forward" />
                </button>
              ) : null}
              <button
                className="brand-button-secondary mt-2 min-h-11 w-full rounded-xl px-3 text-sm font-bold"
                disabled={working}
                onClick={handleToggleOpen}
                type="button"
              >
                {meeting.isOpen ? "신청 마감하기" : "신청 다시 열기"}
              </button>
            </div>
          </section>
        )}

        <section className="brand-admin-section scroll-mt-4 overflow-hidden" id="meeting-operations">
          <div className="brand-admin-section-header px-4 py-3"><h2 className="text-sm font-extrabold">모임 운영</h2></div>
          <div className="grid grid-cols-2 gap-2 px-4 py-4">
            <Link className="brand-button-secondary flex min-h-11 items-center justify-center rounded-xl px-3 py-2.5 text-xs font-bold" href={`/admin/meetings/${meeting.id}/orders`}>식음료 주문</Link>
            <Link className="brand-button-secondary flex min-h-11 items-center justify-center rounded-xl px-3 py-2.5 text-xs font-bold" href={`/shop/usage?meetingId=${meeting.id}`}>{usageLinkLabel}</Link>
            {meetingEnded ? (
              <Link className="brand-button-primary col-span-2 flex min-h-11 items-center justify-center rounded-xl px-3 py-2.5 text-xs font-bold" href={billingHref}>{initialOperations.meeting.billingPublished ? "입금 현황 보기" : "청구 검토하기"}</Link>
            ) : null}
          </div>
        </section>

        <AdminMeetingFeesSection
          initialFees={meeting}
          locked={meeting.billingPublished}
          meetingId={meeting.id}
          overnight={overnight}
          onSaved={(message, type) => addToast(message, type)}
        />

        <div className="scroll-mt-4" id="participants">
          <AdminMeetingParticipants activeTab={activeTab} attendanceLocked={initialOperations.meeting.billingPublished} overnight={overnight} onChangeTab={setActiveTab} onRequestAction={requestParticipantAction} participants={meeting.participants} />
        </div>

        <button className="brand-inline-danger mx-auto flex min-h-11 items-center gap-1 rounded-xl px-4 text-xs font-bold" disabled={working} onClick={() => { setDialogError(""); setConfirmation({ kind: "delete" }); }} type="button">
          <Icon className="text-[16px]" name="delete" />
          모임 삭제
        </button>
      </div>

      <Dialog className="[&_p]:break-keep" description={dialogDescription} onClose={() => { if (!working) setConfirmation(null); }} open={confirmation !== null} title={dialogTitle}>
        {dialogError ? <div className="brand-alert-error mb-4 rounded-xl p-3 text-sm font-semibold" role="alert">{dialogError}</div> : null}
        <div className="flex gap-3">
          <button className="brand-button-secondary flex-1 rounded-2xl px-4 py-3 text-sm font-bold" disabled={working} onClick={() => setConfirmation(null)} type="button">돌아가기</button>
          <button className={`${confirmation?.kind === "delete" || participantConfirmation?.action === "cancel" ? "brand-button-danger-solid" : "brand-button-primary"} flex-1 rounded-2xl px-4 py-3 text-sm font-bold`} disabled={working} onClick={handleConfirmedAction} type="button">
            {working ? "처리 중" : confirmation?.kind === "delete" ? "모임 삭제" : confirmation?.kind === "end" ? "모임 종료" : participantCopy?.button}
          </button>
        </div>
      </Dialog>

      {toasts.map((toast) => <Toast key={toast.id} message={toast.message} onClose={() => removeToast(toast.id)} type={toast.type} />)}
    </AdminLayout>
  );
}
