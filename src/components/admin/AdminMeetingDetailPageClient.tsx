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
import type { AdminMeetingDetail, AdminMeetingParticipant } from "@/lib/admin-page-data";
import { DAY_KO } from "@/lib/format";

type Confirmation =
  | { readonly kind: "delete" }
  | { readonly kind: "participant"; readonly action: ParticipantAction; readonly participant: AdminMeetingParticipant };

type AdminMeetingDetailPageClientProps = {
  readonly meetingId: number;
  readonly initialMeeting: AdminMeetingDetail;
};

function displayDate(dateValue: string): string {
  const date = new Date(`${dateValue}T00:00:00`);
  const [, month, day] = dateValue.split("-");
  return `${Number(month)}월 ${Number(day)}일 (${DAY_KO[date.getDay()]})`;
}

export function AdminMeetingDetailPageClient({ meetingId, initialMeeting }: AdminMeetingDetailPageClientProps) {
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
      const response = await fetch(`/api/meetings/${meetingId}`);
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
      const response = await fetch(`/api/meetings/${meetingId}`, {
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
    addToast(target.action === "cancel" ? "참가를 취소 상태로 변경했습니다" : "참가를 확정 상태로 복구했습니다", "success");
    await reloadMeeting();
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
  const restoring = participantConfirmation?.action === "approve";
  const dialogTitle = confirmation?.kind === "delete" ? "모임을 삭제할까요?" : restoring ? "참가를 복구할까요?" : "참가를 취소할까요?";
  const dialogDescription = confirmation?.kind === "delete"
    ? `“${meetingName}” 모임과 참가·주문·정산 등 운영 기록도 함께 삭제되며 복구할 수 없습니다.`
    : participantConfirmation
      ? restoring
        ? <>“{meetingName}” 모임의 <span className="inline-block whitespace-nowrap" data-dialog-chunk="participant-name">{participantConfirmation.participant.name}님</span>을 <span className="inline-block whitespace-nowrap" data-dialog-chunk="participant-action">참가 확정 상태로 복구합니다</span>.</>
        : <>“{meetingName}” 모임의 <span className="inline-block whitespace-nowrap" data-dialog-chunk="participant-name">{participantConfirmation.participant.name}님</span> <span className="inline-block whitespace-nowrap" data-dialog-chunk="participant-action">참가를 취소합니다</span>. 이 참가자만 취소 상태로 변경하며 패널티와 다른 참가자 상태는 바뀌지 않습니다.</>
      : undefined;

  return (
    <AdminLayout>
      <div className="space-y-4">
        <header>
          <div className="flex items-start gap-3">
            <Link aria-label="모임 목록으로 돌아가기" className="brand-button-secondary flex h-11 w-11 shrink-0 items-center justify-center rounded-full" href="/admin/meetings"><Icon name="arrow_back" /></Link>
            <div className="min-w-0 flex-1">
              <p className="brand-text-subtle text-xs font-bold">MEETING DETAIL</p>
              <h1 className="mt-1 font-headline text-[1.55rem] font-extrabold tracking-[-0.03em] text-brand-text">{displayDate(meeting.date)}</h1>
              <p className="brand-text-muted mt-1 break-keep text-sm">{meeting.startTime}–{meeting.endTime} · {meeting.location}</p>
            </div>
            <button aria-label="모임 정보 새로고침" className="brand-button-secondary flex h-11 w-11 shrink-0 items-center justify-center rounded-full" disabled={reloading} onClick={reloadMeeting} type="button"><Icon className={reloading ? "animate-spin" : ""} name="refresh" /></button>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="brand-chip-soft rounded-full px-2.5 py-1 font-bold">{meeting.meetingType}</span>
            <span className={meeting.isOpen ? "brand-chip-success rounded-full px-2.5 py-1 font-bold" : "brand-chip-dimmed rounded-full px-2.5 py-1 font-bold"}>{meeting.isOpen ? "신청 중" : "신청 마감"}</span>
            <span className="brand-text-muted font-semibold">확정 {meeting.approvedCount}명</span>
          </div>
        </header>

        {pageError ? <div aria-live="polite" className="brand-alert-error flex items-start justify-between gap-3 rounded-2xl p-4 text-sm" role="status"><span className="font-semibold">{pageError}</span><button className="brand-button-secondary shrink-0 rounded-xl px-3 py-2 text-xs font-bold" disabled={reloading} onClick={reloadMeeting} type="button">다시 시도</button></div> : null}

        <section className="brand-admin-section overflow-hidden">
          <div className="brand-admin-section-header px-4 py-3"><h2 className="text-sm font-extrabold">모임 운영</h2></div>
          <div className="grid grid-cols-2 gap-2 px-4 py-4">
            <Link className="brand-button-secondary flex items-center justify-center rounded-xl px-3 py-2.5 text-xs font-bold" href={`/admin/meetings/${meetingId}/orders`}>주문 관리</Link>
            <Link className="brand-button-primary flex items-center justify-center rounded-xl px-3 py-2.5 text-xs font-bold" href={`/admin/meetings/${meetingId}/settlement`}>정산 관리</Link>
            <button className="brand-button-secondary rounded-xl px-3 py-2.5 text-xs font-bold" disabled={working} onClick={handleToggleOpen} type="button">{meeting.isOpen ? "신청 마감하기" : "신청 열기"}</button>
            <button className="brand-button-danger rounded-xl px-3 py-2.5 text-xs font-bold" disabled={working} onClick={() => { setDialogError(""); setConfirmation({ kind: "delete" }); }} type="button">모임 삭제</button>
          </div>
        </section>

        <AdminMeetingParticipants activeTab={activeTab} onChangeTab={setActiveTab} onRequestAction={requestParticipantAction} participants={meeting.participants} />
      </div>

      <Dialog className="[&_p]:break-keep" description={dialogDescription} onClose={() => { if (!working) setConfirmation(null); }} open={confirmation !== null} title={dialogTitle}>
        {dialogError ? <div className="brand-alert-error mb-4 rounded-xl p-3 text-sm font-semibold" role="alert">{dialogError}</div> : null}
        <div className="flex gap-3">
          <button className="brand-button-secondary flex-1 rounded-2xl px-4 py-3 text-sm font-bold" disabled={working} onClick={() => setConfirmation(null)} type="button">돌아가기</button>
          <button className="brand-button-danger-solid flex-1 rounded-2xl px-4 py-3 text-sm font-bold" disabled={working} onClick={handleConfirmedAction} type="button">
            {working ? "처리 중" : confirmation?.kind === "delete" ? "모임 삭제" : restoring ? "참가 복구" : "참가 취소"}
          </button>
        </div>
      </Dialog>

      {toasts.map((toast) => <Toast key={toast.id} message={toast.message} onClose={() => removeToast(toast.id)} type={toast.type} />)}
    </AdminLayout>
  );
}
