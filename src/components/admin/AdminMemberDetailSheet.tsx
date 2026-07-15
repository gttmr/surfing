"use client";

import { useEffect, useRef, type FormEvent } from "react";
import { AdminMemberEditForm, type AdminMemberDraftErrors } from "@/components/admin/AdminMemberEditForm";
import { adminMemberRoleLabel, adminMemberTypeLabel } from "@/components/admin/AdminMemberListPanel";
import { AsyncState } from "@/components/ui/AsyncState";
import { Sheet } from "@/components/ui/Dialog";
import { Icon } from "@/components/ui/Icon";
import type { AdminMemberDetail } from "@/lib/admin-member-response";
import type { AdminMemberDraft } from "@/lib/admin-members";
import type { AdminMemberListItem } from "@/lib/admin-page-data";

type DetailMode = "view" | "edit";

type AdminMemberDetailSheetProps = {
  readonly deleteConfirmOpen: boolean;
  readonly deleteError: string | null;
  readonly deleting: boolean;
  readonly detail: AdminMemberDetail | null;
  readonly detailError: string | null;
  readonly dirty: boolean;
  readonly draft: AdminMemberDraft | null;
  readonly draftErrors: AdminMemberDraftErrors;
  readonly loading: boolean;
  readonly mode: DetailMode;
  readonly onCancelDelete: () => void;
  readonly onCancelEdit: () => void;
  readonly onChangeDraft: (draft: AdminMemberDraft) => void;
  readonly onClose: () => void;
  readonly onConfirmDelete: () => void;
  readonly onDeleteRequest: () => void;
  readonly onEdit: () => void;
  readonly onRetry: () => void;
  readonly onSave: (event: FormEvent<HTMLFormElement>) => void;
  readonly open: boolean;
  readonly saveError: string | null;
  readonly savedMessage: string | null;
  readonly saving: boolean;
  readonly summary: AdminMemberListItem | null;
};

function activityLabel(status: string): string {
  if (status === "APPROVED") return "참석";
  if (status === "WAITLISTED") return "대기";
  if (status === "CANCELLED") return "취소";
  return status;
}

function activityClass(status: string): string {
  if (status === "APPROVED") return "brand-chip-success";
  if (status === "WAITLISTED") return "brand-chip-soft";
  return "brand-chip-dimmed";
}

function displayDate(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat("ko-KR").format(date);
}

export function AdminMemberDetailSheet(props: AdminMemberDetailSheetProps) {
  const title = props.summary?.name ?? props.detail?.name ?? "회원 상세";
  const namedMember = props.summary?.name ?? props.detail?.name;
  const deleteSubject = namedMember ? `${namedMember}님` : "이 회원";
  const deleteButtonRef = useRef<HTMLButtonElement>(null);
  const cancelDeleteButtonRef = useRef<HTMLButtonElement>(null);
  const deleteWasOpenRef = useRef(false);

  useEffect(() => {
    if (props.deleteConfirmOpen) {
      deleteWasOpenRef.current = true;
      cancelDeleteButtonRef.current?.focus();
    } else if (deleteWasOpenRef.current) {
      deleteWasOpenRef.current = false;
      deleteButtonRef.current?.focus();
    }
  }, [props.deleteConfirmOpen]);

  return (
    <Sheet
      closeLabel={props.deleteConfirmOpen ? "회원 삭제 취소" : "회원 상세 닫기"}
      description={props.deleteConfirmOpen
        ? `${deleteSubject}의 참가 기록과 소유한 동반인 정보도 함께 정리되며 되돌릴 수 없습니다.`
        : props.mode === "edit" ? "저장 전 변경사항은 초안으로만 유지됩니다." : "회원 정보와 최근 활동을 확인합니다."}
      onClose={props.deleteConfirmOpen ? props.onCancelDelete : props.onClose}
      open={props.open}
      title={props.deleteConfirmOpen ? `${deleteSubject}을 삭제할까요?` : title}
    >
      {props.deleteConfirmOpen ? (
        <section aria-label="회원 삭제 확인" className="space-y-4 pb-2">
          <div className="brand-alert-error rounded-2xl p-4">
            <p className="font-bold">삭제되는 정보</p>
            <p className="mt-1 text-sm leading-6">회원 계정, 참가 기록, 소유한 동반인 정보가 함께 정리됩니다.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button ref={cancelDeleteButtonRef} className="brand-button-secondary min-h-11 rounded-xl px-3 text-sm font-bold" disabled={props.deleting} onClick={props.onCancelDelete} type="button">취소</button>
            <button className="brand-button-danger-solid min-h-11 rounded-xl px-3 text-sm font-bold" disabled={props.deleting} onClick={props.onConfirmDelete} type="button">
              {props.deleting ? "삭제 중" : "회원 삭제"}
            </button>
          </div>
        </section>
      ) : props.loading ? (
        <AsyncState description="회원 정보와 활동 이력을 확인하고 있습니다." kind="loading" title="회원 정보를 불러오는 중" />
      ) : props.detailError ? (
        <AsyncState actionLabel="다시 불러오기" description={props.detailError} kind="error" onAction={props.onRetry} title="회원 정보를 불러오지 못했습니다" />
      ) : props.detail && props.draft ? (
        <div className="space-y-5 pb-2">
          <section aria-label="회원 요약" className="brand-highlight-panel rounded-2xl p-4">
            <div className="flex items-center gap-3">
              <span className="brand-avatar-shell flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full">
                {props.detail.profileImage ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img alt="" className="h-full w-full object-cover" src={props.detail.profileImage} />
                ) : (
                  <Icon className="text-[28px]" name="person" />
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-base font-extrabold text-[var(--brand-text)]">{props.detail.name ?? "이름 없음"}</p>
                <p className="mt-1 break-all text-xs">{props.detail.kakaoId}</p>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <span className="brand-chip-soft rounded px-2 py-1 text-[11px] font-bold">{adminMemberRoleLabel(props.detail.role)}</span>
                  <span className={props.detail.memberType === "COMPANION" ? "brand-chip-companion rounded px-2 py-1 text-[11px] font-bold" : "brand-chip-soft rounded px-2 py-1 text-[11px] font-bold"}>
                    {adminMemberTypeLabel(props.detail.memberType)}
                  </span>
                </div>
              </div>
            </div>
          </section>

          {props.savedMessage ? (
            <div aria-live="polite" className="brand-alert-success rounded-2xl p-4 text-sm font-bold">
              <Icon className="mr-1 align-text-bottom text-[18px]" name="check_circle" /> {props.savedMessage}
            </div>
          ) : null}

          {props.mode === "edit" ? (
            <AdminMemberEditForm
              dirty={props.dirty}
              draft={props.draft}
              errors={props.draftErrors}
              onCancel={props.onCancelEdit}
              onChange={props.onChangeDraft}
              onSubmit={props.onSave}
              saveError={props.saveError}
              saving={props.saving}
            />
          ) : (
            <>
              {props.deleteError ? (
                <div className="brand-alert-error rounded-2xl p-4" role="alert">
                  <p className="font-bold">삭제되지 않았습니다</p>
                  <p className="mt-1 text-sm">{props.deleteError}</p>
                </div>
              ) : null}

              <section aria-labelledby="admin-member-info-title" className="brand-admin-section overflow-hidden">
                <div className="brand-admin-section-header flex items-center justify-between gap-3 px-4 py-3">
                  <h3 className="text-sm font-extrabold text-[var(--brand-text)]" id="admin-member-info-title">기본 정보</h3>
                  <button className="brand-button-secondary inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-xs font-bold" onClick={props.onEdit} type="button">
                    <Icon className="text-[18px]" name="edit" /> 편집
                  </button>
                </div>
                <dl className="grid grid-cols-2 gap-x-3 gap-y-4 p-4 text-sm">
                  <div>
                    <dt className="brand-text-subtle text-xs">연락처</dt>
                    <dd className="mt-1 break-words font-bold text-[var(--brand-text)]">{props.detail.phoneNumber ?? "등록 안 됨"}</dd>
                  </div>
                  <div>
                    <dt className="brand-text-subtle text-xs">가입일</dt>
                    <dd className="mt-1 font-bold text-[var(--brand-text)]">{displayDate(props.detail.createdAt)}</dd>
                  </div>
                  <div>
                    <dt className="brand-text-subtle text-xs">참여 기록</dt>
                    <dd className="mt-1 font-bold text-[var(--brand-text)]">{props.detail.participants.length}회</dd>
                  </div>
                  <div>
                    <dt className="brand-text-subtle text-xs">패널티</dt>
                    <dd className={`mt-1 font-bold ${props.detail.penaltyCount > 0 ? "text-[var(--brand-danger-text)]" : "text-[var(--brand-text)]"}`}>
                      {props.detail.penaltyCount}회
                    </dd>
                  </div>
                </dl>
              </section>

              <section aria-labelledby="admin-member-activity-title" className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-extrabold text-[var(--brand-text)]" id="admin-member-activity-title">최근 활동</h3>
                  <span className="brand-text-subtle text-xs">{props.detail.participants.length}건</span>
                </div>
                {props.detail.participants.length === 0 ? (
                  <p className="brand-admin-empty brand-inset-panel rounded-2xl px-4 py-6 text-sm">활동 내역이 없습니다.</p>
                ) : (
                  <ul className="space-y-2">
                    {props.detail.participants.map((activity) => (
                      <li className="brand-list-item rounded-2xl p-3" key={activity.id}>
                        <div className="flex items-start justify-between gap-3">
                          <p className="min-w-0 text-sm font-bold text-[var(--brand-text)]">{activity.meeting.date} · {activity.meeting.startTime}</p>
                          <span className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-bold ${activityClass(activity.status)}`}>{activityLabel(activity.status)}</span>
                        </div>
                        <p className="brand-text-muted mt-1 text-xs">{activity.meeting.location}</p>
                        {activity.isPenalized ? <p className="mt-2 text-xs font-bold text-[var(--brand-danger-text)]">패널티 적용</p> : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section aria-labelledby="admin-member-danger-title" className="brand-alert-error rounded-2xl p-4">
                <h3 className="text-sm font-extrabold" id="admin-member-danger-title">회원 삭제</h3>
                <p className="mt-1 text-xs leading-5">참가 기록과 소유한 동반인 정보도 함께 정리됩니다.</p>
                <button ref={deleteButtonRef} className="brand-button-danger-solid mt-3 min-h-11 w-full rounded-xl px-4 text-sm font-bold" onClick={props.onDeleteRequest} type="button">회원 삭제</button>
              </section>
            </>
          )}
        </div>
      ) : null}

    </Sheet>
  );
}
