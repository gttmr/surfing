"use client";

import { useState } from "react";
import { StatusBadge } from "@/components/ui/StatusBadge";
import type {
  CompanionItem,
  LinkedCompanionStatus,
  MyParticipantData,
  SignedUpCompanionData,
} from "@/lib/landing-types";
import {
  emptyCompanionOption,
  type CompanionOption,
  type NewCompanionEntry,
  type SignupOptionField,
  type SubmissionResult,
} from "@/components/meeting/useSignupFormState";
import {
  KakaoIcon,
  OptionPricingHelp,
  ShopOptionChoice,
  ShuttleBusChoice,
} from "@/components/meeting/signup-form-controls";
import { MeetingFoodOrderPanel } from "@/components/meeting/MeetingFoodOrderPanel";
import { MeetingSurfUsagePanel } from "@/components/meeting/MeetingSurfUsagePanel";
import type { SignupPricingPreview } from "@/lib/signup-pricing";
import { calculateOvernightSignupEstimate } from "@/lib/signup-pricing";
import { Icon } from "@/components/ui/Icon";
import type { MeetingGroupDaySummary } from "@/lib/meeting-group";
import { getTodayInSeoul } from "@/lib/date";
import { formatWon } from "@/lib/format";

type OptionField = SignupOptionField;

function DailyMeetingActivity({ meetingId, overnightDays }: { readonly meetingId: number; readonly overnightDays?: MeetingGroupDaySummary[] }) {
  const today = getTodayInSeoul();
  const [activeMeetingId, setActiveMeetingId] = useState(() => (
    overnightDays?.find((day) => day.date === today)?.id ?? overnightDays?.[0]?.id ?? meetingId
  ));
  const activeDay = overnightDays?.find((day) => day.id === activeMeetingId);

  if (!overnightDays?.length) {
    return (
      <>
        <MeetingSurfUsagePanel meetingId={meetingId} />
        <MeetingFoodOrderPanel meetingId={meetingId} />
      </>
    );
  }

  return (
    <section className="brand-card-soft overflow-hidden rounded-2xl" aria-label="날짜별 실제 이용과 주문">
      <div className="px-4 pb-3 pt-4">
        <p className="text-sm font-extrabold text-brand-text">실제 이용·주문</p>
        <p className="brand-text-subtle mt-1 break-keep text-xs">예정과 달라도 괜찮습니다. 실제 이용한 날짜에 입력해 주세요.</p>
      </div>
      <div className="grid grid-cols-2 gap-1 border-y border-brand-divider bg-brand-surface p-1.5" role="tablist" aria-label="이용 날짜">
        {overnightDays.map((day) => {
          const [, month, date] = day.date.split("-");
          const active = day.id === activeMeetingId;
          return (
            <button
              aria-controls={`overnight-activity-${day.id}`}
              aria-selected={active}
              className={`min-h-11 rounded-xl px-2 py-2 text-xs font-extrabold ${active ? "brand-filter-tab-active" : "brand-text-subtle"}`}
              id={`overnight-day-tab-${day.id}`}
              key={day.id}
              onClick={() => setActiveMeetingId(day.id)}
              role="tab"
              type="button"
            >
              {day.dayIndex}일차 · {Number(month)}.{Number(date)}
            </button>
          );
        })}
      </div>
      <div aria-labelledby={`overnight-day-tab-${activeMeetingId}`} className="space-y-3 p-3" id={`overnight-activity-${activeMeetingId}`} role="tabpanel">
        <div className="brand-panel-white rounded-xl px-3 py-2 text-xs">
          <span className="font-extrabold text-brand-text">{activeDay?.dayIndex}일차</span>
          <span className="brand-text-muted"> · {activeDay?.startTime}–{activeDay?.endTime} · {activeDay?.location}</span>
        </div>
        <MeetingSurfUsagePanel meetingId={activeMeetingId} />
        <MeetingFoodOrderPanel meetingId={activeMeetingId} />
      </div>
    </section>
  );
}

function OvernightChoices({
  day2HasRental,
  usesClubLodging,
  disabled,
  day2Label,
  day1HasLesson,
  day1HasRental,
  lodgingFee,
  participantType,
  pricingPreview,
  onDay2Rental,
  onLodging,
}: {
  readonly day2HasRental: boolean;
  readonly usesClubLodging: boolean;
  readonly disabled: boolean;
  readonly day2Label: string;
  readonly day1HasLesson: boolean;
  readonly day1HasRental: boolean;
  readonly lodgingFee: number;
  readonly participantType: "REGULAR" | "COMPANION";
  readonly pricingPreview: SignupPricingPreview;
  readonly onDay2Rental: (value: boolean) => void;
  readonly onLodging: (value: boolean) => void;
}) {
  const day1Option = day1HasLesson ? "lesson" : day1HasRental ? "rental" : null;
  const estimate = calculateOvernightSignupEstimate({
    participantType,
    pricing: pricingPreview,
    day1Option,
    day2HasRental,
    usesClubLodging,
    lodgingFee,
  });
  const day2Description = participantType === "REGULAR" && !day1Option
    ? "첫 장비 대여일로 동호회 지원이 적용됩니다."
    : participantType === "REGULAR"
      ? "첫날 지원을 사용하면 둘째 날은 샵 가격을 부담합니다."
      : "둘째 날에도 샵 장비 대여비가 반영됩니다.";
  const choices = [
    {
      key: "day2-rental",
      checked: day2HasRental,
      label: `${day2Label} 장비 대여`,
      description: day2Description,
      onChange: onDay2Rental,
    },
    {
      key: "lodging",
      checked: usesClubLodging,
      label: "동호회 숙소 이용",
      description: lodgingFee > 0
        ? "선택 시 모임에 등록된 1인 숙박비가 포함됩니다."
        : "운영진이 준비한 숙소를 이용합니다.",
      onChange: onLodging,
    },
  ];

  return (
    <div className="space-y-2 border-t border-brand-divider pt-3">
      <p className="brand-text-subtle text-xs font-bold">1박2일 추가 선택</p>
      {choices.map((choice) => (
        <button
          aria-checked={choice.checked}
          className={`brand-select-card flex min-h-12 w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left ${choice.checked ? "brand-select-card-active" : ""}`}
          disabled={disabled}
          key={choice.key}
          onClick={() => choice.onChange(!choice.checked)}
          role="checkbox"
          type="button"
        >
          <span className={`brand-choice-indicator flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${choice.checked ? "brand-check-active brand-choice-indicator-active" : ""}`}>
            {choice.checked ? <Icon className="text-[16px]" name="check" /> : null}
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-bold text-brand-text">{choice.label}</span>
            <span className="brand-text-subtle mt-0.5 block break-keep text-[11px]">{choice.description}</span>
          </span>
        </button>
      ))}
      <div
        aria-atomic="true"
        aria-live="polite"
        className="brand-highlight-panel flex items-end justify-between gap-4 rounded-xl px-3 py-3"
      >
        <span>
          <span className="block text-xs font-bold text-brand-text">현재 예상 금액</span>
          <span className="brand-text-subtle mt-0.5 block text-[11px]">선택한 참가·장비·숙박 비용 기준</span>
        </span>
        <strong className="brand-estimate-value shrink-0 text-lg font-extrabold tabular-nums text-brand-primary" key={estimate.totalAmount}>
          {formatWon(estimate.totalAmount)}
        </strong>
      </div>
    </div>
  );
}

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
  meetingId: number;
  isIrregularMeeting: boolean;
  isOvernight: boolean;
  overnightDay2Label: string;
  overnightLodgingFee: number;
  overnightDays?: MeetingGroupDaySummary[];
  linkedStatus: LinkedCompanionStatus;
  serverError: string;
  participantOptionPricingGuide: string;
  pricingPreview: SignupPricingPreview;
  updatingLinked: boolean;
  submittingLinked: boolean;
  hasBus: boolean;
  hasLesson: boolean;
  hasRental: boolean;
  day2HasRental: boolean;
  usesClubLodging: boolean;
  onSetMainBusChoice: (boarded: boolean) => void;
  onSetMainShopOption: (option: "lesson" | "rental" | null) => void;
  onSetMainDay2Rental: (value: boolean) => void;
  onSetMainLodging: (value: boolean) => void;
  onUpdateLinkedOption: (field: SignupOptionField, value: boolean) => void;
  onApplyLinkedCompanion: () => void;
};

export function CompanionSignupPanel({
  meetingId,
  isIrregularMeeting,
  isOvernight,
  overnightDay2Label,
  overnightLodgingFee,
  overnightDays,
  linkedStatus,
  serverError,
  participantOptionPricingGuide,
  pricingPreview,
  updatingLinked,
  submittingLinked,
  hasBus,
  hasLesson,
  hasRental,
  day2HasRental,
  usesClubLodging,
  onSetMainBusChoice,
  onSetMainShopOption,
  onSetMainDay2Rental,
  onSetMainLodging,
  onUpdateLinkedOption,
  onApplyLinkedCompanion,
}: CompanionPanelProps) {
  if (!linkedStatus.linked) {
    return (
      <div className="brand-panel-white rounded-xl p-5 text-sm space-y-2">
        <p className="font-semibold text-brand-text">동반인 연동 필요</p>
        <p className="brand-text-muted text-xs">프로필 페이지에서 정회원과 연동해주세요. 연동 후 참가 여부를 확인할 수 있습니다.</p>
        <a href="/profile" className="brand-link inline-block text-xs font-bold hover:underline">프로필로 이동 &rarr;</a>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {serverError ? (
        <div className="brand-alert-error rounded-xl p-4 text-sm">{serverError}</div>
      ) : null}

      <div className="brand-panel-white rounded-xl p-4 text-sm">
        <p className="brand-text-subtle mb-1 text-xs">정회원: {linkedStatus.companion?.owner.name ?? "알 수 없음"}</p>
        <p className="font-semibold text-brand-text">{linkedStatus.companion?.name}</p>
      </div>

      {linkedStatus.participant ? (
        <div className="space-y-3">
          <div className={`rounded-xl p-4 text-center ${linkedStatus.participant.status === "APPROVED" ? "brand-alert-success" : "brand-panel-white"}`}>
            <div className="mb-1 text-2xl">✓</div>
            <p className="text-sm font-bold text-brand-text">
              {linkedStatus.participant.status === "APPROVED" ? "참가 확정" : "대기 중"}
            </p>
          </div>

          {!isIrregularMeeting ? (
            <div className="brand-panel-white rounded-xl p-4">
              <div className="space-y-4 pl-0">
                <ShuttleBusChoice
                  boarded={linkedStatus.participant.hasBus}
                  onChange={(next) => onUpdateLinkedOption("hasBus", next)}
                  disabled={updatingLinked}
                />
                <ShopOptionChoice
                  value={
                    linkedStatus.participant.hasLesson
                      ? "lesson"
                      : linkedStatus.participant.hasRental
                        ? "rental"
                        : null
                  }
                  onChange={(next) => {
                    onUpdateLinkedOption("hasLesson", next === "lesson");
                    onUpdateLinkedOption("hasRental", next === "rental");
                  }}
                  disabled={updatingLinked}
                  trailing={<OptionPricingHelp guide={participantOptionPricingGuide} />}
                  burden={pricingPreview.companion}
                />
                {isOvernight ? (
                  <OvernightChoices
                    day2HasRental={linkedStatus.participant.day2HasRental ?? false}
                    day2Label={overnightDay2Label}
                    day1HasLesson={linkedStatus.participant.hasLesson}
                    day1HasRental={linkedStatus.participant.hasRental}
                    disabled={updatingLinked}
                    lodgingFee={overnightLodgingFee}
                    onDay2Rental={(value) => onUpdateLinkedOption("day2HasRental", value)}
                    onLodging={(value) => onUpdateLinkedOption("usesClubLodging", value)}
                    participantType="COMPANION"
                    pricingPreview={pricingPreview}
                    usesClubLodging={linkedStatus.participant.usesClubLodging ?? false}
                  />
                ) : null}
              </div>
            </div>
          ) : null}
          {linkedStatus.participant.status === "APPROVED" ? (
            <DailyMeetingActivity meetingId={meetingId} overnightDays={overnightDays} />
          ) : null}
        </div>
      ) : linkedStatus.ownerApplied ? (
        <div className="space-y-3">
          {!isIrregularMeeting ? (
            <div className="brand-panel-white rounded-xl p-4">
              <div className="space-y-4 pl-0">
                <ShuttleBusChoice
                  boarded={hasBus}
                  onChange={onSetMainBusChoice}
                  disabled={submittingLinked}
                />
                <ShopOptionChoice
                  value={hasLesson ? "lesson" : hasRental ? "rental" : null}
                  onChange={onSetMainShopOption}
                  disabled={submittingLinked}
                  trailing={<OptionPricingHelp guide={participantOptionPricingGuide} />}
                  burden={pricingPreview.companion}
                />
                {isOvernight ? (
                  <OvernightChoices
                    day2HasRental={day2HasRental}
                    day2Label={overnightDay2Label}
                    day1HasLesson={hasLesson}
                    day1HasRental={hasRental}
                    disabled={submittingLinked}
                    lodgingFee={overnightLodgingFee}
                    onDay2Rental={onSetMainDay2Rental}
                    onLodging={onSetMainLodging}
                    participantType="COMPANION"
                    pricingPreview={pricingPreview}
                    usesClubLodging={usesClubLodging}
                  />
                ) : null}
              </div>
            </div>
          ) : null}

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
      <div className={`rounded-xl p-5 text-center ${cancelResult.penalty ? "brand-alert-error" : "brand-panel-white"}`}>
        <div className="mb-3 text-3xl">{cancelResult.penalty ? "⚠️" : "✓"}</div>
        <p className="mb-2 font-bold text-brand-text">참가가 취소되었습니다</p>
        {cancelResult.cancelledCompanions > 0 ? (
          <p className="brand-text-muted mb-2 text-sm">동반인 {cancelResult.cancelledCompanions}명도 함께 취소되었습니다</p>
        ) : null}
        {cancelResult.penalty && cancelResult.penaltyMessage ? (
          <div className="brand-alert-error mt-3 rounded-lg p-3 text-sm">{cancelResult.penaltyMessage}</div>
        ) : null}
      </div>
      <button type="button" onClick={onReset} className="brand-button-primary w-full rounded-xl py-3 text-sm font-bold transition-colors">
        다시 신청하기
      </button>
    </div>
  );
}

type ExistingSignupPanelProps = {
  meetingId: number;
  isIrregularMeeting: boolean;
  isOvernight: boolean;
  overnightDay2Label: string;
  overnightLodgingFee: number;
  overnightDays?: MeetingGroupDaySummary[];
  meetingDisplay: string;
  participantOptionPricingGuide: string;
  pricingPreview: SignupPricingPreview;
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
  mySignupDay2HasRental: boolean;
  mySignupUsesClubLodging: boolean;
  companions: CompanionItem[];
  signedUpCompanionData: Record<number, SignedUpCompanionData>;
  companionOptions: Record<number, CompanionOption>;
  expandedManagedCompanions: Set<number>;
  selectedCompanionIdsForMeeting: Set<number>;
  savingMySignup: boolean;
  showCancelConfirm: boolean;
  cancelling: boolean;
  onOpenDetails: () => void;
  onCloseDetails: () => void;
  onMySignupNoteChange: (value: string) => void;
  onSetMySignupBusChoice: (boarded: boolean) => void;
  onSetMySignupShopOption: (option: "lesson" | "rental" | null) => void;
  onSetMySignupDay2Rental: (value: boolean) => void;
  onSetMySignupLodging: (value: boolean) => void;
  onToggleExpandedCompanion: (id: number) => void;
  onToggleCompanionForMeeting: (id: number) => void;
  onUpdateCompanionOption: (id: number, field: OptionField, value: boolean) => void;
  onSetCompanionOption: (id: number, field: OptionField, value: boolean) => void;
  onShowCancelConfirm: (show: boolean) => void;
  onSaveMySignup: () => void;
  onCancel: () => void;
};

export function ExistingSignupPanel({
  meetingId,
  isIrregularMeeting,
  isOvernight,
  overnightDay2Label,
  overnightLodgingFee,
  overnightDays,
  meetingDisplay,
  participantOptionPricingGuide,
  pricingPreview,
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
  mySignupDay2HasRental,
  mySignupUsesClubLodging,
  companions,
  signedUpCompanionData,
  companionOptions,
  expandedManagedCompanions,
  selectedCompanionIdsForMeeting,
  savingMySignup,
  showCancelConfirm,
  cancelling,
  onOpenDetails,
  onCloseDetails,
  onMySignupNoteChange,
  onSetMySignupBusChoice,
  onSetMySignupShopOption,
  onSetMySignupDay2Rental,
  onSetMySignupLodging,
  onToggleExpandedCompanion,
  onToggleCompanionForMeeting,
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
          <div className="brand-alert-success mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full">
            <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path d="M5 13l4 4L19 7" strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} />
            </svg>
          </div>
          <h3 className="mb-1 text-lg font-extrabold text-brand-text">신청이 완료되었습니다!</h3>
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
              <span className="font-semibold text-brand-text">{submissionResult.name}</span>
            </div>
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="brand-text-subtle">모임</span>
              <span className="font-semibold text-brand-text">{meetingDisplay}</span>
            </div>
            {submissionResult.companions > 0 ? (
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="brand-text-subtle">동반인</span>
                <span className="font-semibold text-brand-text">{submissionResult.companions}명 함께 신청</span>
              </div>
            ) : null}
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="brand-text-subtle">상태</span>
              <StatusBadge size="sm" status={submissionResult.status} waitlistPosition={submissionResult.waitlistPosition} />
            </div>
          </div>
        </div>
      ) : (
        <div className="brand-alert-success flex items-center gap-2 rounded-xl px-4 py-3">
          <span className="text-sm font-bold">✓</span>
          <span className="text-sm font-bold">
            {myParticipant.status === "APPROVED" ? "참가가 확정되었습니다" : `대기자 ${myParticipant.waitlistPosition}번째입니다`}
            {signedUpCount > 0 ? ` · 동반인 ${signedUpCount}명 포함` : ""}
          </span>
        </div>
      )}

      {serverError ? (
        <div className="brand-alert-error rounded-xl p-4 text-sm">{serverError}</div>
      ) : null}

      {myParticipant.status === "APPROVED" ? (
        <DailyMeetingActivity meetingId={meetingId} overnightDays={overnightDays} />
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
                <p className="mb-1.5 block text-sm font-semibold text-brand-text">이름</p>
                <div className="brand-input-dimmed rounded-lg px-4 py-2.5 text-sm font-semibold">{profileName}</div>
              </div>

              {!isIrregularMeeting ? (
                <div>
                  <div className="space-y-4 pl-0">
                    <ShuttleBusChoice
                      boarded={mySignupHasBus}
                      onChange={onSetMySignupBusChoice}
                      disabled={savingMySignup}
                    />
                    <ShopOptionChoice
                      value={mySignupHasLesson ? "lesson" : mySignupHasRental ? "rental" : null}
                      onChange={onSetMySignupShopOption}
                      disabled={savingMySignup}
                      trailing={<OptionPricingHelp guide={participantOptionPricingGuide} />}
                      burden={pricingPreview.regular}
                    />
                    {isOvernight ? (
                      <OvernightChoices
                        day2HasRental={mySignupDay2HasRental}
                        day2Label={overnightDay2Label}
                        day1HasLesson={mySignupHasLesson}
                        day1HasRental={mySignupHasRental}
                        disabled={savingMySignup}
                        lodgingFee={overnightLodgingFee}
                        onDay2Rental={onSetMySignupDay2Rental}
                        onLodging={onSetMySignupLodging}
                        participantType="REGULAR"
                        pricingPreview={pricingPreview}
                        usesClubLodging={mySignupUsesClubLodging}
                      />
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div>
                <label className="mb-1.5 block text-sm font-semibold text-brand-text" htmlFor="existing-signup-note">
                  비고 <span className="brand-text-subtle font-normal">(선택)</span>
                </label>
                <textarea
                  id="existing-signup-note"
                  className="brand-input w-full resize-none rounded-lg px-4 py-2.5 text-sm outline-none disabled:bg-brand-surface disabled:text-brand-text-subtle"
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

          <div className="brand-panel-white rounded-xl p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-text">
                <span className="text-base">👥</span> 동반인 참가 관리
              </p>
              <a href="/profile" className="brand-button-secondary rounded-lg px-2.5 py-1.5 text-xs font-bold">추가</a>
            </div>
            {companions.length > 0 ? (
              <div className="space-y-2">
                {companions.map((companion) => {
                  const companionData = signedUpCompanionData[companion.id];
                  const isSignedUp = !!companionData;
                  const isChecked = selectedCompanionIdsForMeeting.has(companion.id);
                  const isExpanded = expandedManagedCompanions.has(companion.id);
                  const options = companionOptions[companion.id] ?? emptyCompanionOption();

                  return (
                    <div key={companion.id} className="brand-list-item rounded-lg p-3">
                      <div className="flex items-center gap-3">
                        <button
                          className="flex flex-1 items-center gap-3 text-left"
                          disabled={savingMySignup}
                          onClick={() => onToggleCompanionForMeeting(companion.id)}
                          type="button"
                        >
                          <div className={`brand-choice-indicator flex h-5 w-5 shrink-0 items-center justify-center rounded-md transition-colors ${isChecked ? "brand-check-active brand-choice-indicator-active" : ""}`}>
                            {isChecked ? (
                              <svg className="h-3 w-3 text-brand-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                              </svg>
                            ) : null}
                          </div>
                          <span className="flex-1 text-sm font-semibold text-brand-text">{companion.name}</span>
                        </button>
                        {isSignedUp && !isIrregularMeeting ? (
                          <button
                            className="brand-text-subtle text-xs"
                            onClick={() => onToggleExpandedCompanion(companion.id)}
                            type="button"
                          >
                            {isExpanded ? "접기" : "옵션"}
                          </button>
                        ) : null}
                      </div>
                      {isExpanded && isSignedUp && !isIrregularMeeting ? (
                        <div className="mt-3 space-y-4 border-t border-brand-divider pt-3 pl-8">
                          <ShuttleBusChoice
                            boarded={companionData.hasBus ?? false}
                            onChange={(next) => onUpdateCompanionOption(companion.id, "hasBus", next)}
                            disabled={savingMySignup}
                          />
                          <ShopOptionChoice
                            value={companionData.hasLesson ? "lesson" : companionData.hasRental ? "rental" : null}
                            onChange={(next) => {
                              onUpdateCompanionOption(companion.id, "hasLesson", next === "lesson");
                              onUpdateCompanionOption(companion.id, "hasRental", next === "rental");
                            }}
                            disabled={savingMySignup}
                            burden={pricingPreview.companion}
                          />
                          {isOvernight ? (
                            <OvernightChoices
                              day2HasRental={companionData.day2HasRental ?? false}
                              day2Label={overnightDay2Label}
                              day1HasLesson={companionData.hasLesson}
                              day1HasRental={companionData.hasRental}
                              disabled={savingMySignup}
                              lodgingFee={overnightLodgingFee}
                              onDay2Rental={(value) => onUpdateCompanionOption(companion.id, "day2HasRental", value)}
                              onLodging={(value) => onUpdateCompanionOption(companion.id, "usesClubLodging", value)}
                              participantType="COMPANION"
                              pricingPreview={pricingPreview}
                              usesClubLodging={companionData.usesClubLodging ?? false}
                            />
                          ) : null}
                        </div>
                      ) : isChecked && !isSignedUp && !isIrregularMeeting ? (
                        <div className="mt-3 space-y-4 border-t border-brand-divider pt-3 pl-8">
                          <ShuttleBusChoice
                            boarded={options.hasBus}
                            onChange={(next) => onSetCompanionOption(companion.id, "hasBus", next)}
                            disabled={savingMySignup}
                          />
                          <ShopOptionChoice
                            value={options.hasLesson ? "lesson" : options.hasRental ? "rental" : null}
                            onChange={(next) => {
                              onSetCompanionOption(companion.id, "hasLesson", next === "lesson");
                              onSetCompanionOption(companion.id, "hasRental", next === "rental");
                            }}
                            disabled={savingMySignup}
                            burden={pricingPreview.companion}
                          />
                          {isOvernight ? (
                            <OvernightChoices
                              day2HasRental={options.day2HasRental}
                              day2Label={overnightDay2Label}
                              day1HasLesson={options.hasLesson}
                              day1HasRental={options.hasRental}
                              disabled={savingMySignup}
                              lodgingFee={overnightLodgingFee}
                              onDay2Rental={(value) => onSetCompanionOption(companion.id, "day2HasRental", value)}
                              onLodging={(value) => onSetCompanionOption(companion.id, "usesClubLodging", value)}
                              participantType="COMPANION"
                              pricingPreview={pricingPreview}
                              usesClubLodging={options.usesClubLodging}
                            />
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="brand-text-muted text-sm">등록된 동반인이 없습니다. 추가 버튼을 눌러 등록하세요.</p>
            )}
          </div>

          {showCancelConfirm ? (
            <div className="brand-alert-error rounded-xl p-5 space-y-3">
              <p className="text-sm font-semibold">정말 참가를 취소하시겠습니까?</p>
              <p className="text-xs opacity-80">화요일 18시 이후 취소 시 패널티가 부과될 수 있습니다.</p>
              {signedUpCount > 0 ? (
                <p className="text-xs font-bold">동반인 {signedUpCount}명의 참가도 함께 취소됩니다.</p>
              ) : null}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={onCancel}
                  disabled={cancelling}
                  className="brand-button-danger-solid flex-1 rounded-lg py-2.5 text-sm font-bold transition-colors hover:opacity-90 disabled:bg-brand-primary-soft disabled:text-brand-text-subtle"
                >
                  {cancelling ? "취소 중..." : signedUpCount > 0 ? `전체 취소 (동반 ${signedUpCount}명 포함)` : "취소 확인"}
                </button>
                <button type="button" onClick={() => onShowCancelConfirm(false)} className="brand-button-secondary rounded-lg px-4 py-2.5 text-sm transition-colors">
                  돌아가기
                </button>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-2 gap-2">
            <button
              className={`w-full rounded-xl py-3 text-sm font-bold transition-all ${
                savingMySignup
                  ? "bg-brand-primary-soft cursor-not-allowed text-brand-text-subtle"
                  : mySignupSaved
                    ? "brand-alert-success"
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
              type="button"
              onClick={() => onShowCancelConfirm(true)}
              className="brand-alert-error w-full rounded-xl border-2 py-3 text-sm font-bold transition-colors"
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
  isIrregularMeeting: boolean;
  isOvernight: boolean;
  overnightDay2Label: string;
  overnightLodgingFee: number;
  duplicate: boolean;
  serverError: string;
  name: string;
  profileName: string | null;
  nameError: string;
  note: string;
  hasBus: boolean;
  hasLesson: boolean;
  hasRental: boolean;
  day2HasRental: boolean;
  usesClubLodging: boolean;
  participantOptionPricingGuide: string;
  pricingPreview: SignupPricingPreview;
  companions: CompanionItem[];
  selectedCompanions: Set<number>;
  companionOptions: Record<number, CompanionOption>;
  newCompanionInput: string;
  newCompanions: NewCompanionEntry[];
  submitting: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onNameChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onSetMainBusChoice: (boarded: boolean) => void;
  onSetMainShopOption: (option: "lesson" | "rental" | null) => void;
  onSetMainDay2Rental: (value: boolean) => void;
  onSetMainLodging: (value: boolean) => void;
  onSelectCompanion: (id: number) => void;
  onSetCompanionOption: (id: number, field: OptionField, value: boolean) => void;
  onNewCompanionInputChange: (value: string) => void;
  onAddNewCompanion: () => void;
  onRemoveNewCompanion: (index: number) => void;
  onUpdateNewCompanion: (index: number, field: OptionField, value: boolean) => void;
};

export function RegularSignupPanel({
  isIrregularMeeting,
  isOvernight,
  overnightDay2Label,
  overnightLodgingFee,
  duplicate,
  serverError,
  name,
  profileName,
  nameError,
  note,
  hasBus,
  hasLesson,
  hasRental,
  day2HasRental,
  usesClubLodging,
  participantOptionPricingGuide,
  pricingPreview,
  companions,
  selectedCompanions,
  companionOptions,
  newCompanionInput,
  newCompanions,
  submitting,
  onSubmit,
  onNameChange,
  onNoteChange,
  onSetMainBusChoice,
  onSetMainShopOption,
  onSetMainDay2Rental,
  onSetMainLodging,
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
        <div className="brand-panel-white rounded-xl p-4 text-sm text-brand-text">이 모임에 이미 신청하셨습니다.</div>
      ) : null}
      {serverError ? (
        <div className="brand-alert-error rounded-xl p-4 text-sm">{serverError}</div>
      ) : null}

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-brand-text" htmlFor="signup-name">
          이름 <span className="brand-form-error">*</span>
          {profileName ? (
            <span className="brand-text-subtle ml-1 text-xs font-normal">(프로필에서 변경 가능)</span>
          ) : (
            <span className="brand-text-subtle ml-1 text-xs font-normal">(프로필에서 이름을 설정해 주세요)</span>
          )}
        </label>
        <input
          id="signup-name"
          type="text"
          value={name}
          readOnly={!!profileName}
          onChange={profileName ? undefined : (e) => onNameChange(e.target.value)}
          placeholder="홍길동"
          disabled={submitting}
          className={`w-full rounded-lg px-4 py-2.5 text-sm outline-none ${
            nameError ? "brand-input-error" : profileName ? "brand-input-dimmed" : "brand-input"
          } disabled:bg-brand-surface disabled:text-brand-text-subtle`}
        />
        {nameError ? <p className="brand-form-error">{nameError}</p> : null}
      </div>

      {!isIrregularMeeting ? (
        <div className="brand-panel-white rounded-xl p-3">
          <div className="space-y-4 pl-0">
            <ShuttleBusChoice
              boarded={hasBus}
              onChange={onSetMainBusChoice}
              disabled={submitting}
            />
            <ShopOptionChoice
              value={hasLesson ? "lesson" : hasRental ? "rental" : null}
              onChange={onSetMainShopOption}
              disabled={submitting}
              trailing={<OptionPricingHelp guide={participantOptionPricingGuide} />}
              burden={pricingPreview.regular}
            />
            {isOvernight ? (
              <OvernightChoices
                day2HasRental={day2HasRental}
                day2Label={overnightDay2Label}
                day1HasLesson={hasLesson}
                day1HasRental={hasRental}
                disabled={submitting}
                lodgingFee={overnightLodgingFee}
                onDay2Rental={onSetMainDay2Rental}
                onLodging={onSetMainLodging}
                participantType="REGULAR"
                pricingPreview={pricingPreview}
                usesClubLodging={usesClubLodging}
              />
            ) : null}
          </div>
        </div>
      ) : null}

      <div>
        <label className="mb-1.5 block text-sm font-semibold text-brand-text" htmlFor="signup-note">
          비고 <span className="brand-text-subtle font-normal">(선택)</span>
        </label>
        <textarea
          id="signup-note"
          value={note}
          onChange={(e) => onNoteChange(e.target.value.slice(0, 100))}
          placeholder={isIrregularMeeting ? "합류 시간, 준비물, 전달사항 등..." : "처음 참가합니다, 주차 문의 등..."}
          rows={2}
          disabled={submitting}
          className="brand-input w-full resize-none rounded-lg px-4 py-2.5 text-sm outline-none disabled:bg-brand-surface disabled:text-brand-text-subtle"
        />
        <p className="brand-text-subtle mt-1 text-right text-xs">{note.length}/100</p>
      </div>

      <div className="brand-panel-white rounded-xl p-3 space-y-3">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-brand-text">
          <span className="text-base">👥</span> 동반인 함께 신청
        </p>

        {companions.length > 0 ? (
          <div className="space-y-2">
            {companions.map((companion) => {
              const isSelected = selectedCompanions.has(companion.id);
              const options = companionOptions[companion.id] ?? emptyCompanionOption();

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
                        <svg className="h-3 w-3 text-brand-text" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : null}
                    </div>
                    <span className="flex-1 text-sm font-semibold text-brand-text">{companion.name}</span>
                  </button>
                  {isSelected && !isIrregularMeeting ? (
                    <div className="mt-2 space-y-4 pl-8">
                      <ShuttleBusChoice
                        boarded={options.hasBus}
                        onChange={(next) => onSetCompanionOption(companion.id, "hasBus", next)}
                        disabled={submitting}
                      />
                      <ShopOptionChoice
                        value={options.hasLesson ? "lesson" : options.hasRental ? "rental" : null}
                        onChange={(next) => {
                          onSetCompanionOption(companion.id, "hasLesson", next === "lesson");
                          onSetCompanionOption(companion.id, "hasRental", next === "rental");
                        }}
                        disabled={submitting}
                        burden={pricingPreview.companion}
                      />
                      {isOvernight ? (
                        <OvernightChoices
                          day2HasRental={options.day2HasRental}
                          day2Label={overnightDay2Label}
                          day1HasLesson={options.hasLesson}
                          day1HasRental={options.hasRental}
                          disabled={submitting}
                          lodgingFee={overnightLodgingFee}
                          onDay2Rental={(value) => onSetCompanionOption(companion.id, "day2HasRental", value)}
                          onLodging={(value) => onSetCompanionOption(companion.id, "usesClubLodging", value)}
                          participantType="COMPANION"
                          pricingPreview={pricingPreview}
                          usesClubLodging={options.usesClubLodging}
                        />
                      ) : null}
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
              className="brand-input min-w-0 rounded-lg px-3 py-2 text-sm outline-none disabled:bg-brand-surface"
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
                    <span className="flex-1 text-sm font-semibold text-brand-text">{newCompanion.name}</span>
                    <span className="rounded bg-brand-primary-soft-accent px-1.5 py-0.5 text-[10px] font-bold text-brand-primary-text">신규</span>
                    <button
                      type="button"
                      onClick={() => onRemoveNewCompanion(index)}
                      className="brand-text-subtle ml-1 text-xs transition-colors hover:text-brand-calendar-sun"
                    >
                      ✕
                    </button>
                  </div>
                  {!isIrregularMeeting ? (
                    <div className="space-y-4 pl-0">
                      <ShuttleBusChoice
                        boarded={newCompanion.hasBus}
                        onChange={(next) => onUpdateNewCompanion(index, "hasBus", next)}
                        disabled={submitting}
                      />
                      <ShopOptionChoice
                        value={newCompanion.hasLesson ? "lesson" : newCompanion.hasRental ? "rental" : null}
                        onChange={(next) => {
                          onUpdateNewCompanion(index, "hasLesson", next === "lesson");
                          onUpdateNewCompanion(index, "hasRental", next === "rental");
                        }}
                        disabled={submitting}
                        burden={pricingPreview.companion}
                      />
                      {isOvernight ? (
                        <OvernightChoices
                          day2HasRental={newCompanion.day2HasRental}
                          day2Label={overnightDay2Label}
                          day1HasLesson={newCompanion.hasLesson}
                          day1HasRental={newCompanion.hasRental}
                          disabled={submitting}
                          lodgingFee={overnightLodgingFee}
                          onDay2Rental={(value) => onUpdateNewCompanion(index, "day2HasRental", value)}
                          onLodging={(value) => onUpdateNewCompanion(index, "usesClubLodging", value)}
                          participantType="COMPANION"
                          pricingPreview={pricingPreview}
                          usesClubLodging={newCompanion.usesClubLodging}
                        />
                      ) : null}
                    </div>
                  ) : null}
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
