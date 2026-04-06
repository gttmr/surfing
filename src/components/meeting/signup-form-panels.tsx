"use client";

import { StatusBadge } from "@/components/ui/StatusBadge";
import type {
  CompanionItem,
  LinkedCompanionStatus,
  MyParticipantData,
  SignedUpCompanionData,
} from "@/lib/landing-types";
import type {
  CompanionOption,
  NewCompanionEntry,
  SubmissionResult,
} from "@/components/meeting/useSignupFormState";
import {
  CheckboxOptionItem,
  KakaoIcon,
  OptionPricingHelp,
  RadioOptionItem,
} from "@/components/meeting/signup-form-controls";

type OptionField = "hasLesson" | "hasBus" | "hasRental";

export function GuestSignupPanel({
  onLogin,
}: {
  onLogin: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="brand-card-soft rounded-xl p-5 text-center space-y-3">
        <p className="brand-text-muted text-sm">카카오 계정으로 간편하게 신청할 수 있습니다</p>
        <button
          type="button"
          onClick={onLogin}
          className="brand-button-primary inline-flex h-12 w-full items-center justify-center gap-2 rounded-xl text-sm font-bold transition-colors"
        >
          <KakaoIcon />
          카카오로 로그인하여 신청하기
        </button>
      </div>
    </div>
  );
}

type CompanionPanelProps = {
  linkedStatus: LinkedCompanionStatus;
  serverError: string;
  participantOptionPricingGuide: string;
  updatingLinked: boolean;
  submittingLinked: boolean;
  hasBus: boolean;
  hasLesson: boolean;
  hasRental: boolean;
  onToggleMainOption: (field: OptionField) => void;
  onUpdateLinkedOption: (field: OptionField, value: boolean) => void;
  onApplyLinkedCompanion: () => void;
};

export function CompanionSignupPanel({
  linkedStatus,
  serverError,
  participantOptionPricingGuide,
  updatingLinked,
  submittingLinked,
  hasBus,
  hasLesson,
  hasRental,
  onToggleMainOption,
  onUpdateLinkedOption,
  onApplyLinkedCompanion,
}: CompanionPanelProps) {
  if (!linkedStatus.linked) {
    return (
      <div className="brand-panel-white rounded-xl p-5 text-sm space-y-2">
        <p className="font-semibold text-[var(--brand-text)]">동반인 연동 필요</p>
        <p className="brand-text-muted text-xs">프로필 페이지에서 정회원과 연동해주세요. 연동 후 참가 여부를 확인할 수 있습니다.</p>
        <a href="/profile" className="brand-link inline-block text-xs font-bold hover:underline">프로필로 이동 &rarr;</a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {serverError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{serverError}</div>
      ) : null}

      <div className="brand-panel-white rounded-xl p-4 text-sm">
        <p className="brand-text-subtle mb-1 text-xs">정회원: {linkedStatus.companion?.owner.name ?? "알 수 없음"}</p>
        <p className="font-semibold text-[var(--brand-text)]">{linkedStatus.companion?.name}</p>
      </div>

      {linkedStatus.participant ? (
        <div className="space-y-3">
          <div className={`rounded-xl p-4 text-center ${linkedStatus.participant.status === "APPROVED" ? "border border-green-200 bg-green-50" : "brand-panel-white"}`}>
            <div className="mb-1 text-2xl">✓</div>
            <p className="text-sm font-bold text-[var(--brand-text)]">
              {linkedStatus.participant.status === "APPROVED" ? "참가 확정" : "대기 중"}
            </p>
          </div>

          <div className="brand-panel-white rounded-xl p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[var(--brand-text)]">
                내 참가 옵션 변경 <span className="brand-text-subtle text-xs font-normal">(선택)</span>
              </p>
              <OptionPricingHelp guide={participantOptionPricingGuide} />
            </div>
            <div className="space-y-2">
              <CheckboxOptionItem
                label="셔틀 버스"
                icon="🚌"
                checked={linkedStatus.participant.hasBus}
                onChange={() => onUpdateLinkedOption("hasBus", !linkedStatus.participant!.hasBus)}
                disabled={updatingLinked}
              />
              <RadioOptionItem
                label="강습+장비대여"
                icon="🏄‍♂️"
                checked={linkedStatus.participant.hasLesson}
                onChange={() => onUpdateLinkedOption("hasLesson", !linkedStatus.participant!.hasLesson)}
                disabled={updatingLinked}
              />
              <RadioOptionItem
                label="장비 대여만"
                icon="🩳"
                checked={linkedStatus.participant.hasRental}
                onChange={() => onUpdateLinkedOption("hasRental", !linkedStatus.participant!.hasRental)}
                disabled={updatingLinked}
              />
            </div>
          </div>
        </div>
      ) : linkedStatus.ownerApplied ? (
        <div className="space-y-3">
          <div className="brand-panel-white rounded-xl p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-[var(--brand-text)]">
                내 참가 옵션 <span className="brand-text-subtle text-xs font-normal">(선택)</span>
              </p>
              <OptionPricingHelp guide={participantOptionPricingGuide} />
            </div>
            <div className="space-y-2">
              <CheckboxOptionItem label="셔틀 버스" icon="🚌" checked={hasBus} onChange={() => onToggleMainOption("hasBus")} disabled={submittingLinked} />
              <RadioOptionItem label="강습+장비대여" icon="🏄‍♂️" checked={hasLesson} onChange={() => onToggleMainOption("hasLesson")} disabled={submittingLinked} />
              <RadioOptionItem label="장비 대여만" icon="🩳" checked={hasRental} onChange={() => onToggleMainOption("hasRental")} disabled={submittingLinked} />
            </div>
          </div>

          <button
            type="button"
            onClick={onApplyLinkedCompanion}
            disabled={submittingLinked}
            className="brand-button-primary w-full rounded-xl py-3 text-sm font-bold transition-all active:scale-[0.99] disabled:cursor-not-allowed"
          >
            {submittingLinked ? "처리 중..." : "내 참가 추가하기"}
          </button>
        </div>
      ) : (
        <div className="brand-panel-white rounded-xl p-4 text-center text-sm brand-text-muted">
          연동된 정회원이 먼저 이 모임에 참가 신청해야 합니다.
        </div>
      )}
    </div>
  );
}

export function CancelResultPanel({
  cancelResult,
  onReset,
}: {
  cancelResult: { penalty: boolean; penaltyMessage: string | null; cancelledCompanions: number };
  onReset: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className={`rounded-xl p-5 text-center ${cancelResult.penalty ? "border border-red-200 bg-red-50" : "brand-panel-white"}`}>
        <div className="mb-3 text-3xl">{cancelResult.penalty ? "⚠️" : "✓"}</div>
        <p className="mb-2 font-bold text-[var(--brand-text)]">참가가 취소되었습니다</p>
        {cancelResult.cancelledCompanions > 0 ? (
          <p className="brand-text-muted mb-2 text-sm">동반인 {cancelResult.cancelledCompanions}명도 함께 취소되었습니다</p>
        ) : null}
        {cancelResult.penalty && cancelResult.penaltyMessage ? (
          <div className="mt-3 rounded-lg bg-red-100 p-3 text-sm text-red-700">{cancelResult.penaltyMessage}</div>
        ) : null}
      </div>
      <button onClick={onReset} className="brand-button-primary w-full rounded-xl py-3 text-sm font-bold transition-colors">
        다시 신청하기
      </button>
    </div>
  );
}

type ExistingSignupPanelProps = {
  meetingDisplay: string;
  participantOptionPricingGuide: string;
  profileName: string;
  serverError: string;
  myParticipant: MyParticipantData;
  submissionResult: SubmissionResult | null;
  showMySignupDetails: boolean;
  mySignupSaved: boolean;
  mySignupNote: string;
  mySignupHasBus: boolean;
  mySignupHasLesson: boolean;
  mySignupHasRental: boolean;
  companions: CompanionItem[];
  signedUpCompanionData: Record<number, SignedUpCompanionData>;
  companionOptions: Record<number, CompanionOption>;
  expandedManagedCompanions: Set<number>;
  companionActionLoading: number | null;
  savingMySignup: boolean;
  showCancelConfirm: boolean;
  cancelling: boolean;
  onOpenDetails: () => void;
  onCloseDetails: () => void;
  onMySignupNoteChange: (value: string) => void;
  onToggleMySignupOption: (field: OptionField) => void;
  onToggleExpandedCompanion: (id: number) => void;
  onAddCompanionToMeeting: (id: number) => void;
  onCancelCompanion: (id: number) => void;
  onUpdateCompanionOption: (id: number, field: OptionField, value: boolean) => void;
  onSetCompanionOption: (id: number, field: OptionField, value: boolean) => void;
  onShowCancelConfirm: (show: boolean) => void;
  onSaveMySignup: () => void;
  onCancel: () => void;
};

export function ExistingSignupPanel({
  meetingDisplay,
  participantOptionPricingGuide,
  profileName,
  serverError,
  myParticipant,
  submissionResult,
  showMySignupDetails,
  mySignupSaved,
  mySignupNote,
  mySignupHasBus,
  mySignupHasLesson,
  mySignupHasRental,
  companions,
  signedUpCompanionData,
  companionOptions,
  expandedManagedCompanions,
  companionActionLoading,
  savingMySignup,
  showCancelConfirm,
  cancelling,
  onOpenDetails,
  onCloseDetails,
  onMySignupNoteChange,
  onToggleMySignupOption,
  onToggleExpandedCompanion,
  onAddCompanionToMeeting,
  onCancelCompanion,
  onUpdateCompanionOption,
  onSetCompanionOption,
  onShowCancelConfirm,
  onSaveMySignup,
  onCancel,
}: ExistingSignupPanelProps) {
  const signedUpCount = Object.keys(signedUpCompanionData).length;

  return (
    <div className="space-y-4">
      {submissionResult ? (
        <div className="brand-panel-white rounded-2xl p-5 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-600">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} />
            </svg>
          </div>
          <h3 className="mb-1 text-lg font-extrabold text-[var(--brand-text)]">신청이 완료되었습니다!</h3>
          <p className="brand-text-muted mb-4 text-sm">
            {submissionResult.status === "APPROVED"
              ? "모임 참가가 확정되었습니다."
              : submissionResult.status === "WAITLISTED"
                ? `정원 초과로 대기자 ${submissionResult.waitlistPosition ?? "-"}번째로 등록되었습니다.`
                : "참가가 취소되었습니다."}
          </p>
          <div className="brand-inset-panel space-y-3 rounded-xl p-4 text-left">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="brand-text-subtle">이름</span>
              <span className="font-semibold text-[var(--brand-text)]">{submissionResult.name}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="brand-text-subtle">모임</span>
              <span className="font-semibold text-[var(--brand-text)]">{meetingDisplay}</span>
            </div>
            {submissionResult.companions > 0 ? (
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="brand-text-subtle">동반인</span>
                <span className="font-semibold text-[var(--brand-text)]">{submissionResult.companions}명 함께 신청</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="brand-text-subtle">상태</span>
              <StatusBadge size="sm" status={submissionResult.status} waitlistPosition={submissionResult.waitlistPosition} />
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-green-200 bg-green-50 p-5 text-center">
          <div className="mb-2 text-3xl">✓</div>
          <p className="font-bold text-green-800">
            {myParticipant.status === "APPROVED" ? "참가가 확정되었습니다" : `대기자 ${myParticipant.waitlistPosition}번째입니다`}
          </p>
          {signedUpCount > 0 ? <p className="mt-1 text-sm text-green-600">동반인 {signedUpCount}명도 함께 신청되었습니다</p> : null}
        </div>
      )}

      {serverError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{serverError}</div>
      ) : null}

      {!showMySignupDetails ? (
        <button
          className="brand-button-primary w-full rounded-xl py-3 text-sm font-bold transition-all active:scale-[0.99]"
          onClick={onOpenDetails}
          type="button"
        >
          참가 내역 보기
        </button>
      ) : (
        <>
          <div className="brand-panel-white rounded-xl p-4">
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-[var(--brand-text)]">이름</label>
                <div className="brand-input-dimmed rounded-lg px-4 py-2.5 text-sm font-semibold">{profileName}</div>
              </div>

              <div>
                <div className="mb-2.5 flex items-center justify-between gap-3">
                  <p className="text-sm font-semibold text-[var(--brand-text)]">
                    내 참가 옵션 <span className="brand-text-subtle text-xs font-normal">(선택)</span>
                  </p>
                  <OptionPricingHelp guide={participantOptionPricingGuide} />
                </div>
                <div className="space-y-2">
                  <CheckboxOptionItem label="셔틀 버스" icon="🚌" checked={mySignupHasBus} onChange={() => onToggleMySignupOption("hasBus")} disabled={savingMySignup} />
                  <RadioOptionItem label="강습+장비대여" icon="🏄‍♂️" checked={mySignupHasLesson} onChange={() => onToggleMySignupOption("hasLesson")} disabled={savingMySignup} />
                  <RadioOptionItem label="장비 대여만" icon="🩳" checked={mySignupHasRental} onChange={() => onToggleMySignupOption("hasRental")} disabled={savingMySignup} />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-[var(--brand-text)]">
                  비고 <span className="brand-text-subtle font-normal">(선택)</span>
                </label>
                <textarea
                  className="brand-input w-full resize-none rounded-lg px-4 py-2.5 text-sm outline-none disabled:bg-[var(--brand-surface)] disabled:text-[var(--brand-text-subtle)]"
                  disabled={savingMySignup}
                  onChange={(e) => onMySignupNoteChange(e.target.value.slice(0, 100))}
                  placeholder="처음 참가합니다, 주차 문의 등..."
                  rows={2}
                  value={mySignupNote}
                />
                <p className="brand-text-subtle mt-1 text-right text-xs">{mySignupNote.length}/100</p>
              </div>
            </div>
          </div>

          {companions.length > 0 ? (
            <div className="brand-panel-white rounded-xl p-4">
              <p className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-[var(--brand-text)]">
                <span className="text-base">👥</span> 동반인 참가 관리
              </p>
              <div className="space-y-3">
                {companions.map((companion) => {
                  const companionData = signedUpCompanionData[companion.id];
                  const isSignedUp = !!companionData;
                  const isLoading = companionActionLoading === companion.id;
                  const isExpanded = expandedManagedCompanions.has(companion.id);
                  const options = companionOptions[companion.id] ?? { hasLesson: false, hasBus: false, hasRental: false };

                  return (
                    <div key={companion.id} className={`rounded-lg p-3 ${isSignedUp ? "border border-green-200 bg-green-50" : "brand-list-item"}`}>
                      <div className="mb-2 flex items-center gap-2">
                        <button
                          className="flex flex-1 items-center gap-3 text-left"
                          disabled={isLoading}
                          onClick={() => onToggleExpandedCompanion(companion.id)}
                          type="button"
                        >
                          <div className={`brand-choice-indicator flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-colors ${isExpanded ? "brand-check-active brand-choice-indicator-active" : ""}`}>
                            {isExpanded ? (
                              <svg className="h-3 w-3 text-[var(--brand-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : null}
                          </div>
                          <span className="flex-1 text-sm font-semibold text-[var(--brand-text)]">{companion.name}</span>
                        </button>
                        {isSignedUp ? (
                          <button
                            className="rounded-lg border border-red-200 px-2 py-1 text-xs font-bold text-red-500 transition-colors hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                            disabled={isLoading}
                            onClick={() => onCancelCompanion(companion.id)}
                            type="button"
                          >
                            {isLoading ? "..." : "취소"}
                          </button>
                        ) : (
                          <button
                            className="brand-button-secondary rounded-lg px-2 py-1 text-xs font-bold transition-colors disabled:opacity-50"
                            disabled={isLoading}
                            onClick={() => onAddCompanionToMeeting(companion.id)}
                            type="button"
                          >
                            {isLoading ? "..." : "추가"}
                          </button>
                        )}
                      </div>
                      {isExpanded ? (
                        <div className="space-y-2">
                          <CheckboxOptionItem
                            label="셔틀 버스"
                            icon="🚌"
                            checked={isSignedUp ? (companionData?.hasBus ?? false) : options.hasBus}
                            onChange={() => isSignedUp
                              ? onUpdateCompanionOption(companion.id, "hasBus", !(companionData?.hasBus ?? false))
                              : onSetCompanionOption(companion.id, "hasBus", !options.hasBus)
                            }
                            disabled={isLoading}
                          />
                          <RadioOptionItem
                            label="강습+장비대여"
                            icon="🏄‍♂️"
                            checked={isSignedUp ? (companionData?.hasLesson ?? false) : options.hasLesson}
                            onChange={() => isSignedUp
                              ? onUpdateCompanionOption(companion.id, "hasLesson", !(companionData?.hasLesson ?? false))
                              : onSetCompanionOption(companion.id, "hasLesson", !options.hasLesson)
                            }
                            disabled={isLoading}
                          />
                          <RadioOptionItem
                            label="장비 대여만"
                            icon="🩳"
                            checked={isSignedUp ? (companionData?.hasRental ?? false) : options.hasRental}
                            onChange={() => isSignedUp
                              ? onUpdateCompanionOption(companion.id, "hasRental", !(companionData?.hasRental ?? false))
                              : onSetCompanionOption(companion.id, "hasRental", !options.hasRental)
                            }
                            disabled={isLoading}
                          />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="brand-panel-white flex items-center justify-between rounded-xl p-4">
              <span className="brand-text-muted text-sm">등록된 동반인이 없습니다</span>
              <a href="/profile" className="brand-link text-xs font-semibold">동반인 등록 &rarr;</a>
            </div>
          )}

          {showCancelConfirm ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-5 space-y-3">
              <p className="text-sm font-semibold text-red-800">정말 참가를 취소하시겠습니까?</p>
              <p className="text-xs text-red-600">화요일 18시 이후 취소 시 패널티가 부과될 수 있습니다.</p>
              {signedUpCount > 0 ? (
                <p className="text-xs font-bold text-red-700">동반인 {signedUpCount}명의 참가도 함께 취소됩니다.</p>
              ) : null}
              <div className="flex gap-2">
                <button
                  onClick={onCancel}
                  disabled={cancelling}
                  className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-bold text-white transition-colors hover:bg-red-700 disabled:bg-[var(--brand-primary-soft)] disabled:text-[var(--brand-text-subtle)]"
                >
                  {cancelling ? "취소 중..." : signedUpCount > 0 ? `전체 취소 (동반 ${signedUpCount}명 포함)` : "취소 확인"}
                </button>
                <button onClick={() => onShowCancelConfirm(false)} className="brand-button-secondary rounded-lg px-4 py-2.5 text-sm transition-colors">
                  돌아가기
                </button>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <button
              className={`w-full rounded-xl py-3 text-sm font-bold transition-all ${
                savingMySignup
                  ? "bg-[var(--brand-primary-soft)] cursor-not-allowed text-[var(--brand-text-subtle)]"
                  : mySignupSaved
                    ? "bg-green-500 text-white"
                    : "brand-button-primary active:scale-[0.99]"
              }`}
              disabled={savingMySignup}
              onClick={onSaveMySignup}
              type="button"
            >
              {savingMySignup ? "저장 중..." : mySignupSaved ? "저장 완료!" : "저장하기"}
            </button>
            <button className="brand-button-secondary w-full rounded-xl py-3 text-sm font-bold transition-colors" onClick={onCloseDetails} type="button">
              닫기
            </button>
          </div>

          {!showCancelConfirm ? (
            <button
              onClick={() => onShowCancelConfirm(true)}
              className="w-full rounded-xl border-2 border-red-200 py-3 text-sm font-bold text-red-600 transition-colors hover:bg-red-50"
            >
              참가 취소하기
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}

type RegularPanelProps = {
  duplicate: boolean;
  serverError: string;
  name: string;
  profileName: string | null;
  nameError: string;
  note: string;
  hasBus: boolean;
  hasLesson: boolean;
  hasRental: boolean;
  participantOptionPricingGuide: string;
  companions: CompanionItem[];
  selectedCompanions: Set<number>;
  companionOptions: Record<number, CompanionOption>;
  newCompanionInput: string;
  newCompanions: NewCompanionEntry[];
  submitting: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onNameChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onToggleMainOption: (field: OptionField) => void;
  onSelectCompanion: (id: number) => void;
  onSetCompanionOption: (id: number, field: OptionField, value: boolean) => void;
  onNewCompanionInputChange: (value: string) => void;
  onAddNewCompanion: () => void;
  onRemoveNewCompanion: (index: number) => void;
  onUpdateNewCompanion: (index: number, field: OptionField, value: boolean) => void;
};

export function RegularSignupPanel({
  duplicate,
  serverError,
  name,
  profileName,
  nameError,
  note,
  hasBus,
  hasLesson,
  hasRental,
  participantOptionPricingGuide,
  companions,
  selectedCompanions,
  companionOptions,
  newCompanionInput,
  newCompanions,
  submitting,
  onSubmit,
  onNameChange,
  onNoteChange,
  onToggleMainOption,
  onSelectCompanion,
  onSetCompanionOption,
  onNewCompanionInputChange,
  onAddNewCompanion,
  onRemoveNewCompanion,
  onUpdateNewCompanion,
}: RegularPanelProps) {
  const totalCompanionCount = selectedCompanions.size + newCompanions.length;

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {duplicate ? (
        <div className="brand-panel-white rounded-xl p-4 text-sm text-[var(--brand-text)]">이 모임에 이미 신청하셨습니다.</div>
      ) : null}
      {serverError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{serverError}</div>
      ) : null}

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-[var(--brand-text)]">
          이름 <span className="text-red-500">*</span>
          {profileName ? (
            <span className="brand-text-subtle ml-1 text-xs font-normal">(프로필에서 변경 가능)</span>
          ) : (
            <span className="brand-text-subtle ml-1 text-xs font-normal">(프로필에서 이름을 설정해 주세요)</span>
          )}
        </label>
        <input
          type="text"
          value={name}
          readOnly={!!profileName}
          onChange={profileName ? undefined : (e) => onNameChange(e.target.value)}
          placeholder="홍길동"
          disabled={submitting}
          className={`w-full rounded-lg px-4 py-2.5 text-sm outline-none ${
            nameError ? "border border-red-400 bg-red-50" : profileName ? "brand-input-dimmed" : "brand-input"
          } disabled:bg-[var(--brand-surface)] disabled:text-[var(--brand-text-subtle)]`}
        />
        {nameError ? <p className="mt-1 text-xs text-red-500">{nameError}</p> : null}
      </div>

      <div className="brand-panel-white rounded-xl p-3">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-[var(--brand-text)]">
            내 참가 옵션 <span className="brand-text-subtle text-xs font-normal">(선택)</span>
          </p>
          <OptionPricingHelp guide={participantOptionPricingGuide} />
        </div>
        <div className="space-y-2">
          <CheckboxOptionItem label="셔틀 버스" icon="🚌" checked={hasBus} onChange={() => onToggleMainOption("hasBus")} disabled={submitting} />
          <RadioOptionItem label="강습+장비대여" icon="🏄‍♂️" checked={hasLesson} onChange={() => onToggleMainOption("hasLesson")} disabled={submitting} />
          <RadioOptionItem label="장비 대여만" icon="🩳" checked={hasRental} onChange={() => onToggleMainOption("hasRental")} disabled={submitting} />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-[var(--brand-text)]">
          비고 <span className="brand-text-subtle font-normal">(선택)</span>
        </label>
        <textarea
          value={note}
          onChange={(e) => onNoteChange(e.target.value.slice(0, 100))}
          placeholder="처음 참가합니다, 주차 문의 등..."
          rows={2}
          disabled={submitting}
          className="brand-input w-full resize-none rounded-lg px-4 py-2.5 text-sm outline-none disabled:bg-[var(--brand-surface)] disabled:text-[var(--brand-text-subtle)]"
        />
        <p className="brand-text-subtle mt-1 text-right text-xs">{note.length}/100</p>
      </div>

      <div className="brand-panel-white rounded-xl p-3 space-y-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-[var(--brand-text)]">
          <span className="text-base">👥</span> 동반인 함께 신청
        </p>

        {companions.length > 0 ? (
          <div className="space-y-2">
            {companions.map((companion) => {
              const isSelected = selectedCompanions.has(companion.id);
              const options = companionOptions[companion.id] ?? { hasLesson: false, hasBus: false, hasRental: false };

              return (
                <div key={companion.id} className={`brand-select-card rounded-lg p-2.5 transition-all ${isSelected ? "brand-select-card-active" : ""}`}>
                  <button
                    type="button"
                    onClick={() => onSelectCompanion(companion.id)}
                    disabled={submitting}
                    className="flex w-full items-center gap-3 text-left"
                  >
                    <div className={`brand-choice-indicator flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-colors ${isSelected ? "brand-check-active brand-choice-indicator-active" : ""}`}>
                      {isSelected ? (
                        <svg className="h-3 w-3 text-[var(--brand-text)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : null}
                    </div>
                    <span className="flex-1 text-sm font-semibold text-[var(--brand-text)]">{companion.name}</span>
                  </button>
                  {isSelected ? (
                    <div className="mt-2 space-y-2 pl-8">
                      <CheckboxOptionItem label="셔틀 버스" icon="🚌" checked={options.hasBus} onChange={() => onSetCompanionOption(companion.id, "hasBus", !options.hasBus)} disabled={submitting} />
                      <RadioOptionItem label="강습+장비대여" icon="🏄‍♂️" checked={options.hasLesson} onChange={() => onSetCompanionOption(companion.id, "hasLesson", !options.hasLesson)} disabled={submitting} />
                      <RadioOptionItem label="장비 대여만" icon="🩳" checked={options.hasRental} onChange={() => onSetCompanionOption(companion.id, "hasRental", !options.hasRental)} disabled={submitting} />
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        ) : null}

        <div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-stretch gap-2">
            <input
              type="text"
              value={newCompanionInput}
              onChange={(e) => onNewCompanionInputChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  onAddNewCompanion();
                }
              }}
              placeholder="동반인 이름"
              disabled={submitting}
              className="brand-input min-w-0 rounded-lg px-3 py-2 text-sm outline-none disabled:bg-[var(--brand-surface)]"
            />
            <button
              type="button"
              onClick={onAddNewCompanion}
              disabled={submitting || !newCompanionInput.trim()}
              className="brand-button-primary shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-bold transition-colors"
            >
              추가
            </button>
          </div>

          {newCompanions.length > 0 ? (
            <div className="mt-2 space-y-2">
              {newCompanions.map((newCompanion, index) => (
                <div key={index} className="brand-panel-strong rounded-lg p-2.5">
                  <div className="mb-2 flex items-center gap-2">
                    <span className="flex-1 text-sm font-semibold text-[var(--brand-text)]">{newCompanion.name}</span>
                    <span className="rounded bg-[var(--brand-primary-soft-accent)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--brand-primary-text)]">신규</span>
                    <button
                      type="button"
                      onClick={() => onRemoveNewCompanion(index)}
                      className="brand-text-subtle ml-1 text-xs transition-colors hover:text-red-500"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="space-y-2 pl-0">
                    <CheckboxOptionItem label="셔틀 버스" icon="🚌" checked={newCompanion.hasBus} onChange={() => onUpdateNewCompanion(index, "hasBus", !newCompanion.hasBus)} disabled={submitting} />
                    <RadioOptionItem label="강습+장비대여" icon="🏄‍♂️" checked={newCompanion.hasLesson} onChange={() => onUpdateNewCompanion(index, "hasLesson", !newCompanion.hasLesson)} disabled={submitting} />
                    <RadioOptionItem label="장비 대여만" icon="🩳" checked={newCompanion.hasRental} onChange={() => onUpdateNewCompanion(index, "hasRental", !newCompanion.hasRental)} disabled={submitting} />
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting || !name.trim()}
        className="brand-button-primary w-full rounded-xl py-2.5 text-sm font-bold transition-all active:scale-[0.99] disabled:cursor-not-allowed"
      >
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            처리 중...
          </span>
        ) : totalCompanionCount > 0 ? `참가 신청하기 (동반 ${totalCompanionCount}명 포함)` : "참가 신청하기"}
      </button>
    </form>
  );
}
