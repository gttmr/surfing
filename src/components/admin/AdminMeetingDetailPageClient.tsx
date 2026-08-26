"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AdminLayout } from "@/components/admin/AdminLayout";
import { AdminMeetingParticipants, type ParticipantAction, type ParticipantTab } from "@/components/admin/AdminMeetingParticipants";
import { isAdminMeetingDetail, meetingResponseError } from "@/components/admin/admin-meeting-response";
import { Dialog } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import { Toast, useToast } from "@/components/ui/Toast";
import type { AdminMeetingDetail, AdminMeetingParticipant, AdminSettlementData } from "@/lib/admin-page-data";
import { DAY_KO } from "@/lib/format";
import { getOvernightMeetingSpan } from "@/lib/meeting-group";

type Confirmation =
  | { readonly kind: "delete" }
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
  attended: { title: "실제 참석으로 기록할까요?", button: "참석 기록", toast: "실제 참석으로 기록했습니다" },
  absent: { title: "불참으로 기록할까요?", button: "불참 기록", toast: "불참으로 기록했습니다" },
  "attendance-pending": { title: "참석 상태를 미확인으로 돌릴까요?", button: "미확인으로 변경", toast: "참석 상태를 미확인으로 변경했습니다" },
};

const PARTICIPANT_ACTION_DESCRIPTION: Record<ParticipantAction, { readonly action: string; readonly consequence: string }> = {
  approve: { action: "참가를 확정합니다", consequence: "다른 참가자의 상태는 바뀌지 않습니다." },
  cancel: { action: "참가를 취소합니다", consequence: "패널티와 다른 참가자 상태는 바뀌지 않습니다." },
  attended: { action: "실제 참석으로 기록합니다", consequence: "청구 금액은 이 단계에서 바뀌지 않습니다." },
  absent: { action: "불참으로 기록합니다", consequence: "실제 이용과 청구 공개 전에 다시 확인할 수 있습니다." },
  "attendance-pending": { action: "참석 상태를 미확인으로 돌립니다", consequence: "다시 확인하기 전에는 청구를 공개할 수 없습니다." },
};

function nextActionLabel(operations: AdminSettlementData): string {
  if (operations.workflowStage === "RECRUITING") return "참가 신청 현황 확인";
  if (operations.workflowStage === "UPCOMING") return "모임 준비 확인";
  const nextIncomplete = operations.readiness.checks.find((check) => !check.complete);
  if (operations.workflowStage === "PAYMENT_CONFIRMATION") return "회원 입금 확인하기";
  if (operations.workflowStage === "FINAL_SETTLEMENT") return "샵·식음료 지급 마감하기";
  if (operations.workflowStage === "COMPLETED") return "완료 보고서 확인하기";
  return nextIncomplete?.label ?? "청구 내역 검토하기";
}

function nextActionHref(operations: AdminSettlementData, meetingId: number): string {
  if (operations.workflowStage === "RECRUITING" || operations.workflowStage === "UPCOMING") return "#participants";
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
  const [activeMeetingId, setActiveMeetingId] = useState(initialMeeting.id);
  const [activeTab, setActiveTab] = useState<ParticipantTab>("approved");
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [reloading, setReloading] = useState(false);
  const [working, setWorking] = useState(false);
  const [pageError, setPageError] = useState("");
  const [dialogError, setDialogError] = useState("");
  const { toasts, addToast, removeToast } = useToast();
  const router = useRouter();
  const meetingName = `${displayDate(meeting.date)} · ${meeting.location}`;

  async function reloadMeeting(targetMeetingId = activeMeetingId) {
    setReloading(true);
    setPageError("");
    try {
      const response = await fetch(`/api/meetings/${targetMeetingId}`);
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
      setActiveMeetingId(targetMeetingId);
    } catch (error) {
      setPageError(error instanceof Error ? "네트워크 연결을 확인하고 다시 시도해 주세요." : "모임 정보를 다시 불러오지 못했습니다.");
    } finally {
      setReloading(false);
    }
  }

  async function handleSelectDay(targetMeetingId: number) {
    if (targetMeetingId === activeMeetingId || reloading) return;
    await reloadMeeting(targetMeetingId);
  }

  async function handleToggleOpen() {
    setWorking(true);
    setPageError("");
    try {
      const response = await fetch(`/api/meetings/${activeMeetingId}`, {
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
    await reloadMeeting(activeMeetingId);
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

  async function handleConfirmedAction() {
    if (!confirmation) return;
    setWorking(true);
    setDialogError("");
    try {
      switch (confirmation.kind) {
        case "delete":
          await handleDelete();
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
  const dialogTitle = confirmation?.kind === "delete" ? "모임을 삭제할까요?" : participantCopy?.title ?? "상태를 변경할까요?";
  const dialogDescription = confirmation?.kind === "delete"
    ? `“${meetingName}” 모임과 참가·주문·청구·입금 등 운영 기록도 함께 삭제되며 복구할 수 없습니다.`
    : participantConfirmation
      ? <>“{meetingName}” 모임의 <span className="inline-block whitespace-nowrap" data-dialog-chunk="participant-name">{participantConfirmation.participant.name}님</span>의 <span className="inline-block whitespace-nowrap" data-dialog-chunk="participant-action">{participantDescription?.action}</span>. {participantDescription?.consequence}</>
      : undefined;
  const completedReadinessCount = initialOperations.readiness.checks.filter((check) => check.complete).length;
  const workflowProgressLabel = initialOperations.billing.settlementCompletedAt
    ? "정산 완료"
    : initialOperations.meeting.settlementOpen
      ? `${initialOperations.verifiedRecipientCount}/${initialOperations.recipients.length} 입금`
      : `${completedReadinessCount}/${initialOperations.readiness.checks.length} 확인`;
  const billingHref = `/admin/meetings/${meetingId}/settlement`;
  const nextHref = nextActionHref(initialOperations, meetingId);
  const usageLinkLabel = initialOperations.workflowStage === "RECRUITING" || initialOperations.workflowStage === "UPCOMING"
    ? "이용 예정 현황"
    : "실제 이용 확인";
  const overnightDays = meeting.overnightGroup?.days ?? [];
  const overnightSpan = meeting.overnightGroup ? getOvernightMeetingSpan(meeting.overnightGroup) : null;
  const activeDay = overnightDays.find((day) => day.id === activeMeetingId);

  return (
    <AdminLayout>
      <div className="space-y-4">
        <header>
          <div className="flex items-start gap-3">
            <Link aria-label="모임 목록으로 돌아가기" className="brand-button-secondary flex h-11 w-11 shrink-0 items-center justify-center rounded-full" href="/admin/meetings"><Icon name="arrow_back" /></Link>
            <div className="min-w-0 flex-1">
              <p className="brand-text-subtle text-xs font-bold">MEETING DETAIL</p>
              <h1 className="mt-1 font-headline text-[1.55rem] font-extrabold tracking-[-0.03em] text-brand-text">
                {overnightDays.length === 2
                  ? `${displayDate(overnightDays[0].date)} – ${displayDate(overnightDays[1].date)}`
                  : displayDate(meeting.date)}
              </h1>
              <p className="brand-text-muted mt-1 break-keep text-sm">
                {overnightSpan
                  ? `${overnightSpan.startTime} 시작 · ${overnightSpan.endTime} 종료 · ${overnightSpan.location}`
                  : `${meeting.startTime}–${meeting.endTime} · ${meeting.location}`}
              </p>
            </div>
            <button aria-label="모임 정보 새로고침" className="brand-button-secondary flex h-11 w-11 shrink-0 items-center justify-center rounded-full" disabled={reloading} onClick={() => void reloadMeeting()} type="button"><Icon className={reloading ? "animate-spin" : ""} name="refresh" /></button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="brand-chip-soft rounded-full px-2.5 py-1 font-bold">{meeting.meetingType}</span>
            {overnightDays.length === 2 ? <span className="brand-chip-accent rounded-full px-2.5 py-1 font-bold">1박 2일</span> : null}
            <span className={meeting.isOpen ? "brand-chip-success rounded-full px-2.5 py-1 font-bold" : "brand-chip-dimmed rounded-full px-2.5 py-1 font-bold"}>{meeting.isOpen ? "신청 중" : "신청 마감"}</span>
            <span className="brand-text-muted font-semibold">확정 {meeting.approvedCount}명</span>
          </div>
        </header>

        {pageError ? <div aria-live="polite" className="brand-alert-error flex items-start justify-between gap-3 rounded-2xl p-4 text-sm" role="status"><span className="font-semibold">{pageError}</span><button className="brand-button-secondary shrink-0 rounded-xl px-3 py-2 text-xs font-bold" disabled={reloading} onClick={() => void reloadMeeting()} type="button">다시 시도</button></div> : null}

        {overnightDays.length === 2 ? (
          <div aria-label="운영 날짜 선택" className="grid grid-cols-2 gap-2" role="tablist">
            {overnightDays.map((day) => (
              <button
                aria-selected={day.id === activeMeetingId}
                className={`${day.id === activeMeetingId ? "brand-toggle-active" : "brand-button-secondary"} min-h-12 rounded-xl px-3 text-left text-xs font-bold`}
                disabled={reloading}
                key={day.id}
                onClick={() => void handleSelectDay(day.id)}
                role="tab"
                type="button"
              >
                <span className="block">{day.dayIndex}일차 · {displayDate(day.date)}</span>
                <span className="mt-0.5 block font-normal opacity-75">실제 이용·주문 관리</span>
              </button>
            ))}
          </div>
        ) : null}

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
          {!initialOperations.meeting.settlementOpen ? (
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

        <section className="brand-admin-section scroll-mt-4 overflow-hidden" id="meeting-operations">
          <div className="brand-admin-section-header px-4 py-3"><h2 className="text-sm font-extrabold">모임 운영</h2></div>
          <div className="grid grid-cols-2 gap-2 px-4 py-4">
            <Link className="brand-button-secondary flex min-h-11 items-center justify-center rounded-xl px-3 py-2.5 text-xs font-bold" href={`/admin/meetings/${activeMeetingId}/orders`}>{activeDay ? `${activeDay.dayIndex}일차 식음료` : "식음료 주문"}</Link>
            <Link className="brand-button-secondary flex min-h-11 items-center justify-center rounded-xl px-3 py-2.5 text-xs font-bold" href={`/shop/usage?meetingId=${activeMeetingId}`}>{activeDay ? `${activeDay.dayIndex}일차 ${usageLinkLabel}` : usageLinkLabel}</Link>
            <Link className="brand-button-primary col-span-2 flex min-h-11 items-center justify-center rounded-xl px-3 py-2.5 text-xs font-bold" href={billingHref}>{initialOperations.meeting.settlementOpen ? "입금 현황 보기" : "청구 검토하기"}</Link>
            <button className="brand-button-secondary rounded-xl px-3 py-2.5 text-xs font-bold" disabled={working} onClick={handleToggleOpen} type="button">{meeting.isOpen ? "신청 마감하기" : "신청 열기"}</button>
            <button className="brand-button-danger rounded-xl px-3 py-2.5 text-xs font-bold" disabled={working} onClick={() => { setDialogError(""); setConfirmation({ kind: "delete" }); }} type="button">모임 삭제</button>
          </div>
        </section>

        <div className="scroll-mt-4" id="participants">
          <AdminMeetingParticipants activeTab={activeTab} attendanceLocked={initialOperations.meeting.settlementOpen} onChangeTab={setActiveTab} onRequestAction={requestParticipantAction} participants={meeting.participants} />
        </div>
      </div>

      <Dialog className="[&_p]:break-keep" description={dialogDescription} onClose={() => { if (!working) setConfirmation(null); }} open={confirmation !== null} title={dialogTitle}>
        {dialogError ? <div className="brand-alert-error mb-4 rounded-xl p-3 text-sm font-semibold" role="alert">{dialogError}</div> : null}
        <div className="flex gap-3">
          <button className="brand-button-secondary flex-1 rounded-2xl px-4 py-3 text-sm font-bold" disabled={working} onClick={() => setConfirmation(null)} type="button">돌아가기</button>
          <button className={`${confirmation?.kind === "delete" || participantConfirmation?.action === "cancel" ? "brand-button-danger-solid" : "brand-button-primary"} flex-1 rounded-2xl px-4 py-3 text-sm font-bold`} disabled={working} onClick={handleConfirmedAction} type="button">
            {working ? "처리 중" : confirmation?.kind === "delete" ? "모임 삭제" : participantCopy?.button}
          </button>
        </div>
      </Dialog>

      {toasts.map((toast) => <Toast key={toast.id} message={toast.message} onClose={() => removeToast(toast.id)} type={toast.type} />)}
    </AdminLayout>
  );
}
