"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import type {
  DetailedMeeting,
  HomeUser,
  SignupInitialData,
} from "@/lib/landing-types";
import { kakaoLogin } from "@/lib/kakao";
import {
  CancelResultPanel,
  CompanionSignupPanel,
  ExistingSignupPanel,
  GuestSignupPanel,
  RegularSignupPanel,
} from "@/components/meeting/signup-form-panels";
import { useSignupFormState } from "@/components/meeting/useSignupFormState";

interface SignupFormProps {
  meeting: DetailedMeeting;
  currentUser: HomeUser | null;
  participantOptionPricingGuide: string;
  initialData?: SignupInitialData;
  onMeetingChange?: () => Promise<DetailedMeeting | null>;
}

export function SignupForm({
  meeting,
  currentUser,
  participantOptionPricingGuide: initialGuide,
  initialData,
  onMeetingChange,
}: SignupFormProps) {
  const searchParams = useSearchParams();
  const isClosed = !meeting.isOpen;
  const meetingHomeUrl = `/?date=${encodeURIComponent(meeting.date)}`;
  const {
    state: {
      user,
      userProfile,
      bootstrapLoading,
      hydrated,
      name,
      profileName,
      note,
      hasLesson,
      hasBus,
      hasRental,
      participantOptionPricingGuide,
      nameError,
      submitting,
      serverError,
      duplicate,
      myParticipant,
      submissionResult,
      showMySignupDetails,
      savingMySignup,
      mySignupSaved,
      mySignupNote,
      mySignupHasLesson,
      mySignupHasBus,
      mySignupHasRental,
      expandedManagedCompanions,
      companions,
      selectedCompanions,
      companionOptions,
      newCompanionInput,
      newCompanions,
      signedUpCompanionData,
      companionActionLoading,
      cancelling,
      showCancelConfirm,
      cancelResult,
      linkedStatus,
      updatingLinked,
      submittingLinked,
    },
    actions: {
      setName,
      setNote,
      setNameError,
      setServerError,
      setShowMySignupDetails,
      setSubmissionResult,
      setMySignupNote,
      setExpandedManagedCompanions,
      setSelectedCompanions,
      setNewCompanionInput,
      setNewCompanions,
      setShowCancelConfirm,
      setCancelResult,
      toggleMainOption,
      toggleMySignupOption,
      setCompanionOpt,
      handleAddNewCompanion,
      updateNewCompanion,
      closeMySignupDetails,
      handleSubmit,
      handleAddCompanionToMeeting,
      handleCancelCompanion,
      handleUpdateCompanionOption,
      handleUpdateLinkedOption,
      handleApplyLinkedCompanion,
      handleCancel,
      handleSaveMySignup,
      syncFromUpdatedMeeting,
    },
  } = useSignupFormState({
    meeting,
    currentUser,
    initialGuide,
    initialData,
    onMeetingChange,
  });

  useEffect(() => {
    const authError = searchParams.get("auth_error");
    if (authError) {
      alert(`카카오 로그인 중 오류가 발생했습니다.\n에러 코드: ${authError}`);
      window.history.replaceState({}, "", meetingHomeUrl);
    }
  }, [meetingHomeUrl, searchParams]);

  // ───────────────────────────────────────────── render ─────────────────────────────────────────────

  if (isClosed) {
    return (
      <div className="brand-panel-white rounded-xl p-6 text-center brand-text-muted">
        이 모임의 신청이 마감되었습니다.
      </div>
    );
  }

  if (user === undefined || bootstrapLoading || (user && !hydrated)) {
    return <div className="brand-text-subtle py-8 text-center text-sm">불러오는 중...</div>;
  }

  if (!user) {
    return <GuestSignupPanel onLogin={() => kakaoLogin(meetingHomeUrl)} />;
  }
  // ─── COMPANION 계정 뷰 ─────────────────────────────────────────────────────────────────────────────
  if (userProfile?.memberType === "COMPANION") {
    if (!linkedStatus) {
      return <div className="brand-text-subtle py-4 text-center text-sm">불러오는 중...</div>;
    }

    return (
      <CompanionSignupPanel
        linkedStatus={linkedStatus}
        serverError={serverError}
        participantOptionPricingGuide={participantOptionPricingGuide}
        updatingLinked={updatingLinked}
        submittingLinked={submittingLinked}
        hasBus={hasBus}
        hasLesson={hasLesson}
        hasRental={hasRental}
        onToggleMainOption={toggleMainOption}
        onUpdateLinkedOption={(field, value) => {
          void handleUpdateLinkedOption(field, value);
        }}
        onApplyLinkedCompanion={() => {
          void handleApplyLinkedCompanion();
        }}
      />
    );
  }

  // ─── 취소 완료 결과 ────────────────────────────────────────────────────────────────────────────────
  if (cancelResult) {
    return (
      <CancelResultPanel
        cancelResult={cancelResult}
        onReset={() => {
          setCancelResult(null);
          void syncFromUpdatedMeeting();
        }}
      />
    );
  }

  // ─── 이미 신청한 상태 (정회원) ────────────────────────────────────────────────────────────────────
  if (myParticipant) {
    const signedUpCount = Object.keys(signedUpCompanionData).length;
    const dateObj = new Date(`${meeting.date}T00:00:00`);
    const dayName = ["일", "월", "화", "수", "목", "금", "토"][dateObj.getDay()];
    const [, month, day] = meeting.date.split("-");
    const meetingDisplay = `${parseInt(month, 10)}월 ${parseInt(day, 10)}일 (${dayName}) ${meeting.startTime}`;
    return (
      <ExistingSignupPanel
        meetingDisplay={meetingDisplay}
        participantOptionPricingGuide={participantOptionPricingGuide}
        profileName={profileName ?? name}
        serverError={serverError}
        myParticipant={myParticipant}
        submissionResult={submissionResult}
        showMySignupDetails={showMySignupDetails}
        mySignupSaved={mySignupSaved}
        mySignupNote={mySignupNote}
        mySignupHasBus={mySignupHasBus}
        mySignupHasLesson={mySignupHasLesson}
        mySignupHasRental={mySignupHasRental}
        companions={companions}
        signedUpCompanionData={signedUpCompanionData}
        companionOptions={companionOptions}
        expandedManagedCompanions={expandedManagedCompanions}
        companionActionLoading={companionActionLoading}
        savingMySignup={savingMySignup}
        showCancelConfirm={showCancelConfirm}
        cancelling={cancelling}
        onOpenDetails={() => {
          setSubmissionResult(null);
          setShowCancelConfirm(false);
          setServerError("");
          setShowMySignupDetails(true);
        }}
        onCloseDetails={closeMySignupDetails}
        onMySignupNoteChange={setMySignupNote}
        onToggleMySignupOption={toggleMySignupOption}
        onToggleExpandedCompanion={(id) => {
          setExpandedManagedCompanions((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
          });
        }}
        onAddCompanionToMeeting={(id) => {
          void handleAddCompanionToMeeting(id);
        }}
        onCancelCompanion={(id) => {
          void handleCancelCompanion(id);
        }}
        onUpdateCompanionOption={(id, field, value) => {
          void handleUpdateCompanionOption(id, field, value);
        }}
        onSetCompanionOption={setCompanionOpt}
        onShowCancelConfirm={setShowCancelConfirm}
        onSaveMySignup={() => {
          void handleSaveMySignup();
        }}
        onCancel={() => {
          void handleCancel();
        }}
      />
    );
  }

  // ─── 신청 폼 (정회원) ─────────────────────────────────────────────────────────────────────────────
  return (
    <RegularSignupPanel
      duplicate={duplicate}
      serverError={serverError}
      name={name}
      profileName={profileName}
      nameError={nameError}
      note={note}
      hasBus={hasBus}
      hasLesson={hasLesson}
      hasRental={hasRental}
      participantOptionPricingGuide={participantOptionPricingGuide}
      companions={companions}
      selectedCompanions={selectedCompanions}
      companionOptions={companionOptions}
      newCompanionInput={newCompanionInput}
      newCompanions={newCompanions}
      submitting={submitting}
      onSubmit={(event) => {
        void handleSubmit(event);
      }}
      onNameChange={(value) => {
        setName(value);
        setNameError("");
      }}
      onNoteChange={setNote}
      onToggleMainOption={toggleMainOption}
      onSelectCompanion={(id) => {
        setSelectedCompanions((prev) => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id);
          else next.add(id);
          return next;
        });
      }}
      onSetCompanionOption={setCompanionOpt}
      onNewCompanionInputChange={setNewCompanionInput}
      onAddNewCompanion={handleAddNewCompanion}
      onRemoveNewCompanion={(index) => {
        setNewCompanions((prev) => prev.filter((_, currentIndex) => currentIndex !== index));
      }}
      onUpdateNewCompanion={updateNewCompanion}
    />
  );
}
