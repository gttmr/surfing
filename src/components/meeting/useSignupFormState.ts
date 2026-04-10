"use client";

import { useState, useEffect, useCallback } from "react";
import { DEFAULT_PARTICIPANT_OPTION_PRICING_GUIDE } from "@/lib/settings";
import type {
  CompanionItem,
  DetailedMeeting,
  HomeUser,
  LinkedCompanionStatus,
  MyParticipantData,
  SignedUpCompanionData,
  SignupInitialData,
} from "@/lib/landing-types";

export interface CompanionOption {
  hasLesson: boolean;
  hasBus: boolean;
  hasRental: boolean;
}

export interface NewCompanionEntry {
  name: string;
  hasLesson: boolean;
  hasBus: boolean;
  hasRental: boolean;
}

export interface SubmissionResult {
  status: "APPROVED" | "WAITLISTED" | "CANCELLED";
  waitlistPosition: number | null;
  name: string;
  companions: number;
}

export function deriveRegularParticipantState(meeting: DetailedMeeting, kakaoId: string) {
  const myParticipant = meeting.participantsList.find(
    (participant) =>
      participant.kakaoId === kakaoId &&
      participant.companionId === null &&
      participant.status !== "CANCELLED"
  );

  const signedUpCompanionData = meeting.participantsList.reduce<Record<number, SignedUpCompanionData>>((acc, participant) => {
    if (
      participant.kakaoId === kakaoId &&
      participant.companionId !== null &&
      participant.status !== "CANCELLED"
    ) {
      acc[participant.companionId] = {
        participantId: participant.id,
        hasLesson: participant.hasLesson,
        hasBus: participant.hasBus,
        hasRental: participant.hasRental,
      };
    }
    return acc;
  }, {});

  return {
    myParticipant: myParticipant
      ? {
          id: myParticipant.id,
          status: myParticipant.status,
          waitlistPosition: myParticipant.waitlistPosition ?? null,
          note: myParticipant.note ?? "",
          hasLesson: !!myParticipant.hasLesson,
          hasBus: !!myParticipant.hasBus,
          hasRental: !!myParticipant.hasRental,
        }
      : null,
    signedUpCompanionData,
  };
}

export function deriveLinkedStatusFromMeeting(
  baseLinkedStatus: LinkedCompanionStatus | null,
  meeting: DetailedMeeting
): LinkedCompanionStatus | null {
  if (!baseLinkedStatus?.linked || !baseLinkedStatus.companion) return baseLinkedStatus;

  const participant = meeting.participantsList.find(
    (item) => item.companionId === baseLinkedStatus.companion?.id && item.status !== "CANCELLED"
  );

  return {
    ...baseLinkedStatus,
    ownerApplied: meeting.participantsList.some(
      (item) =>
        item.kakaoId === baseLinkedStatus.companion?.owner.kakaoId &&
        item.companionId === null &&
        item.status !== "CANCELLED"
    ),
    participant: participant
      ? {
          id: participant.id,
          status: participant.status,
          hasLesson: participant.hasLesson,
          hasBus: participant.hasBus,
          hasRental: participant.hasRental,
        }
      : null,
  };
}

type UseSignupFormStateArgs = {
  meeting: DetailedMeeting;
  currentUser: HomeUser | null;
  initialGuide: string;
  initialData?: SignupInitialData;
  onMeetingChange?: () => Promise<DetailedMeeting | null>;
};

export function useSignupFormState({
  meeting,
  currentUser,
  initialGuide,
  initialData,
  onMeetingChange,
}: UseSignupFormStateArgs) {
  const initialRegularState = currentUser?.kakaoId
    ? deriveRegularParticipantState(meeting, currentUser.kakaoId)
    : null;
  const initialLinkedState = initialData?.linkedStatus
    ? deriveLinkedStatusFromMeeting(initialData.linkedStatus, meeting)
    : null;

  const [user, setUser] = useState<HomeUser | null | undefined>(currentUser ?? undefined);
  const [userProfile, setUserProfile] = useState<SignupInitialData["userProfile"]>(initialData?.userProfile ?? null);
  const [bootstrapLoading, setBootstrapLoading] = useState(currentUser ? false : true);
  const [hydrated, setHydrated] = useState(false);
  const [name, setName] = useState(initialData?.userProfile?.name ?? currentUser?.nickname ?? "");
  const [profileName, setProfileName] = useState<string | null>(initialData?.userProfile?.name ?? null);
  const [note, setNote] = useState("");
  const [hasLesson, setHasLesson] = useState(false);
  const [hasBus, setHasBus] = useState(true);
  const [hasRental, setHasRental] = useState(false);
  const [participantOptionPricingGuide, setParticipantOptionPricingGuide] = useState(
    initialData?.participantOptionPricingGuide ?? initialGuide ?? DEFAULT_PARTICIPANT_OPTION_PRICING_GUIDE
  );
  const [nameError, setNameError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [duplicate, setDuplicate] = useState(false);

  const [myParticipant, setMyParticipant] = useState<MyParticipantData | null>(
    initialData?.myParticipant ?? initialRegularState?.myParticipant ?? null
  );
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(null);
  const [showMySignupDetails, setShowMySignupDetails] = useState(false);
  const [savingMySignup, setSavingMySignup] = useState(false);
  const [mySignupSaved, setMySignupSaved] = useState(false);
  const [mySignupNote, setMySignupNote] = useState("");
  const [mySignupHasLesson, setMySignupHasLesson] = useState(false);
  const [mySignupHasBus, setMySignupHasBus] = useState(false);
  const [mySignupHasRental, setMySignupHasRental] = useState(false);
  const [expandedManagedCompanions, setExpandedManagedCompanions] = useState<Set<number>>(new Set());

  const [companions, setCompanions] = useState<CompanionItem[]>(initialData?.companions ?? []);
  const [selectedCompanions, setSelectedCompanions] = useState<Set<number>>(new Set());
  const [companionOptions, setCompanionOptions] = useState<Record<number, CompanionOption>>({});
  const [newCompanionInput, setNewCompanionInput] = useState("");
  const [newCompanions, setNewCompanions] = useState<NewCompanionEntry[]>([]);
  const [signedUpCompanionData, setSignedUpCompanionData] = useState<Record<number, SignedUpCompanionData>>(
    initialData?.signedUpCompanionData ?? initialRegularState?.signedUpCompanionData ?? {}
  );
  const [companionActionLoading, setCompanionActionLoading] = useState<number | null>(null);
  const [selectedCompanionIdsForMeeting, setSelectedCompanionIdsForMeeting] = useState<Set<number>>(
    new Set(Object.keys(initialData?.signedUpCompanionData ?? initialRegularState?.signedUpCompanionData ?? {}).map(Number))
  );
  const [newProfileCompanionInput, setNewProfileCompanionInput] = useState("");
  const [addingCompanionToProfile, setAddingCompanionToProfile] = useState(false);

  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelResult, setCancelResult] = useState<{
    penalty: boolean;
    penaltyMessage: string | null;
    cancelledCompanions: number;
  } | null>(null);

  const [linkedStatus, setLinkedStatus] = useState<LinkedCompanionStatus | null>(initialLinkedState);
  const [updatingLinked, setUpdatingLinked] = useState(false);
  const [submittingLinked, setSubmittingLinked] = useState(false);

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (initialData && currentUser) {
        setUser(currentUser);
        setUserProfile(initialData.userProfile);
        setParticipantOptionPricingGuide(initialData.participantOptionPricingGuide);
        setCompanions(initialData.companions);
        setMyParticipant(initialData.myParticipant);
        setSignedUpCompanionData(initialData.signedUpCompanionData);
        setLinkedStatus(initialData.linkedStatus);

        const resolvedName = initialData.userProfile?.name ?? currentUser.nickname ?? "";
        setName(resolvedName);
        setProfileName(initialData.userProfile?.name ?? null);
        setBootstrapLoading(false);
        return;
      }

      setBootstrapLoading(true);

      try {
        const me = currentUser ?? await fetch("/api/auth/me").then((r) => r.json());
        if (cancelled) return;

        setUser(me);
        if (!me?.kakaoId) {
          setUserProfile(null);
          setBootstrapLoading(false);
          return;
        }

        const [profile, settings] = await Promise.all([
          fetch("/api/profile").then((r) => r.ok ? r.json() : null),
          fetch("/api/settings/public").then((r) => r.ok ? r.json() : null),
        ]);

        if (cancelled) return;

        setUserProfile(profile);
        setParticipantOptionPricingGuide(settings?.participant_option_pricing_guide ?? initialGuide ?? DEFAULT_PARTICIPANT_OPTION_PRICING_GUIDE);

        if (profile?.name) {
          setName(profile.name);
          setProfileName(profile.name);
        } else if (me?.nickname) {
          setName(me.nickname);
          setProfileName(null);
        }

        if (profile?.memberType === "REGULAR") {
          const companionList = await fetch("/api/companions").then((r) => r.ok ? r.json() : []);
          if (cancelled) return;
          setCompanions(companionList);
          setLinkedStatus(null);
        } else if (profile?.memberType === "COMPANION") {
          const nextLinkedStatus = await fetch(`/api/participants/linked-companion?meetingId=${meeting.id}`)
            .then((r) => r.ok ? r.json() : null);
          if (cancelled) return;
          setLinkedStatus(deriveLinkedStatusFromMeeting(nextLinkedStatus, meeting));
          setCompanions([]);
        } else {
          setCompanions([]);
          setLinkedStatus(null);
        }
      } catch {
        if (!cancelled) {
          setUser(currentUser ?? null);
          setUserProfile(initialData?.userProfile ?? null);
        }
      } finally {
        if (!cancelled) setBootstrapLoading(false);
      }
    }

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [currentUser, initialData, initialGuide, meeting]);

  useEffect(() => {
    if (!user?.kakaoId) return;

    if (userProfile?.memberType === "REGULAR") {
      const regularState = deriveRegularParticipantState(meeting, user.kakaoId);
      setMyParticipant(regularState.myParticipant);
      setSignedUpCompanionData(regularState.signedUpCompanionData);
      return;
    }

    if (userProfile?.memberType === "COMPANION") {
      setLinkedStatus((prev) => deriveLinkedStatusFromMeeting(prev, meeting));
      return;
    }

    setMyParticipant(null);
    setSignedUpCompanionData({});
    setLinkedStatus(null);
  }, [meeting, user?.kakaoId, userProfile?.memberType]);

  useEffect(() => {
    setSelectedCompanionIdsForMeeting(new Set(Object.keys(signedUpCompanionData).map(Number)));
  }, [signedUpCompanionData]);

  useEffect(() => {
    if (!myParticipant) {
      setShowMySignupDetails(false);
      setMySignupNote("");
      setMySignupHasLesson(false);
      setMySignupHasBus(false);
      setMySignupHasRental(false);
      return;
    }

    setMySignupNote(myParticipant.note ?? "");
    setMySignupHasLesson(myParticipant.hasLesson);
    setMySignupHasBus(myParticipant.hasBus);
    setMySignupHasRental(myParticipant.hasRental);
  }, [myParticipant]);

  const syncFromUpdatedMeeting = useCallback(async () => {
    const updatedMeeting = await onMeetingChange?.();
    if (!updatedMeeting || !user?.kakaoId) return updatedMeeting;

    if (userProfile?.memberType === "REGULAR") {
      const regularState = deriveRegularParticipantState(updatedMeeting, user.kakaoId);
      setMyParticipant(regularState.myParticipant);
      setSignedUpCompanionData(regularState.signedUpCompanionData);
      return updatedMeeting;
    }

    if (userProfile?.memberType === "COMPANION") {
      setLinkedStatus((prev) => deriveLinkedStatusFromMeeting(prev, updatedMeeting));
    }

    return updatedMeeting;
  }, [onMeetingChange, user, userProfile]);

  function setCompanionOpt(companionId: number, field: "hasLesson" | "hasBus" | "hasRental", value: boolean) {
    setCompanionOptions((prev) => ({
      ...prev,
      [companionId]: {
        ...(prev[companionId] ?? { hasLesson: false, hasBus: false, hasRental: false }),
        ...(field === "hasLesson" && value ? { hasRental: false } : {}),
        ...(field === "hasRental" && value ? { hasLesson: false } : {}),
        [field]: value,
      },
    }));
  }

  function handleAddNewCompanion() {
    const trimmed = newCompanionInput.trim();
    if (!trimmed) return;
    setNewCompanions((prev) => [...prev, { name: trimmed, hasLesson: false, hasBus: false, hasRental: false }]);
    setNewCompanionInput("");
  }

  function updateNewCompanion(idx: number, field: "hasLesson" | "hasBus" | "hasRental", value: boolean) {
    setNewCompanions((prev) => prev.map((companion, index) => {
      if (index !== idx) return companion;
      return {
        ...companion,
        ...(field === "hasLesson" && value ? { hasRental: false } : {}),
        ...(field === "hasRental" && value ? { hasLesson: false } : {}),
        [field]: value,
      };
    }));
  }

  function setMainBusChoice(boarded: boolean) {
    setHasBus(boarded);
  }

  function setMainShopOption(option: "lesson" | "rental" | null) {
    setHasLesson(option === "lesson");
    setHasRental(option === "rental");
  }

  function setMySignupBusChoice(boarded: boolean) {
    setMySignupHasBus(boarded);
  }

  function setMySignupShopOption(option: "lesson" | "rental" | null) {
    setMySignupHasLesson(option === "lesson");
    setMySignupHasRental(option === "rental");
  }

  function closeMySignupDetails() {
    if (myParticipant) {
      setMySignupNote(myParticipant.note ?? "");
      setMySignupHasLesson(myParticipant.hasLesson);
      setMySignupHasBus(myParticipant.hasBus);
      setMySignupHasRental(myParticipant.hasRental);
    }
    setShowCancelConfirm(false);
    setMySignupSaved(false);
    setServerError("");
    setSubmissionResult(null);
    setExpandedManagedCompanions(new Set());
    setShowMySignupDetails(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setNameError("이름을 입력해주세요");
      return;
    }
    setNameError("");
    setSubmitting(true);
    setServerError("");
    setDuplicate(false);

    try {
      const res = await fetch("/api/participants", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingId: meeting.id,
          name,
          note,
          hasLesson,
          hasBus,
          hasRental,
          companionIds: Array.from(selectedCompanions),
          companionOptions: Object.fromEntries(
            Array.from(selectedCompanions).map((id) => [id, companionOptions[id] ?? { hasLesson: false, hasBus: false, hasRental: false }])
          ),
          newCompanions,
        }),
      });

      if (res.status === 409) {
        setDuplicate(true);
        setSubmitting(false);
        return;
      }
      if (!res.ok) {
        const data = await res.json();
        setServerError(data.error ?? "신청 중 오류가 발생했습니다.");
        setSubmitting(false);
        return;
      }

      const data = await res.json();
      const companionCount = data.companions?.length ?? 0;
      setMyParticipant({
        id: data.id,
        status: data.status,
        waitlistPosition: data.waitlistPosition ?? null,
        note,
        hasLesson,
        hasBus,
        hasRental,
      });
      setSubmissionResult({
        status: data.status,
        waitlistPosition: data.waitlistPosition ?? null,
        name,
        companions: companionCount,
      });
      setShowMySignupDetails(false);
      setShowCancelConfirm(false);
      setSelectedCompanions(new Set());
      setCompanionOptions({});
      setNewCompanions([]);
      setNewCompanionInput("");
      setNote("");
      setHasLesson(false);
      setHasBus(true);
      setHasRental(false);
      await syncFromUpdatedMeeting();
      setSubmitting(false);
      return;
    } catch {
      setServerError("네트워크 오류가 발생했습니다.");
      setSubmitting(false);
    }
  }

  async function handleAddCompanionToMeeting(companionId: number) {
    setCompanionActionLoading(companionId);
    const options = companionOptions[companionId] ?? { hasLesson: false, hasBus: false, hasRental: false };
    try {
      const res = await fetch("/api/participants/companions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId: meeting.id, companionId, ...options }),
      });
      if (res.ok) {
        const created = await res.json();
        setSignedUpCompanionData((prev) => ({
          ...prev,
          [companionId]: { participantId: created.id, hasLesson: created.hasLesson, hasBus: created.hasBus, hasRental: created.hasRental },
        }));
        await syncFromUpdatedMeeting();
      } else {
        const data = await res.json();
        setServerError(data.error ?? "동반인 추가 중 오류가 발생했습니다.");
      }
    } catch {
      setServerError("네트워크 오류가 발생했습니다.");
    } finally {
      setCompanionActionLoading(null);
    }
  }

  async function handleCancelCompanion(companionId: number) {
    setCompanionActionLoading(companionId);
    try {
      const res = await fetch("/api/participants/companions", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId: meeting.id, companionId }),
      });
      if (res.ok) {
        setSignedUpCompanionData((prev) => {
          const next = { ...prev };
          delete next[companionId];
          return next;
        });
        await syncFromUpdatedMeeting();
      } else {
        const data = await res.json();
        setServerError(data.error ?? "동반인 취소 중 오류가 발생했습니다.");
      }
    } catch {
      setServerError("네트워크 오류가 발생했습니다.");
    } finally {
      setCompanionActionLoading(null);
    }
  }

  async function handleUpdateCompanionOption(companionId: number, field: "hasLesson" | "hasBus" | "hasRental", value: boolean) {
    const companionData = signedUpCompanionData[companionId];
    if (!companionData) return;
    setSignedUpCompanionData((prev) => ({
      ...prev,
      [companionId]: {
        ...prev[companionId],
        ...(field === "hasLesson" && value ? { hasRental: false } : {}),
        ...(field === "hasRental" && value ? { hasLesson: false } : {}),
        [field]: value,
      },
    }));
    await fetch(`/api/participants/${companionData.participantId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(field === "hasLesson" && value ? { hasRental: false } : {}),
        ...(field === "hasRental" && value ? { hasLesson: false } : {}),
        [field]: value,
      }),
    });
    await syncFromUpdatedMeeting();
  }

  async function handleUpdateLinkedOption(field: "hasLesson" | "hasBus" | "hasRental", value: boolean) {
    if (!linkedStatus?.participant) return;
    setUpdatingLinked(true);
    setLinkedStatus((prev) => prev ? {
      ...prev,
      participant: prev.participant ? {
        ...prev.participant,
        ...(field === "hasLesson" && value ? { hasRental: false } : {}),
        ...(field === "hasRental" && value ? { hasLesson: false } : {}),
        [field]: value,
      } : null,
    } : null);
    await fetch(`/api/participants/${linkedStatus.participant.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(field === "hasLesson" && value ? { hasRental: false } : {}),
        ...(field === "hasRental" && value ? { hasLesson: false } : {}),
        [field]: value,
      }),
    });
    setUpdatingLinked(false);
    await syncFromUpdatedMeeting();
  }

  async function handleApplyLinkedCompanion() {
    setSubmittingLinked(true);
    setServerError("");

    try {
      const res = await fetch("/api/participants/linked-companion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          meetingId: meeting.id,
          hasLesson,
          hasBus,
          hasRental,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setServerError(data.error ?? "신청 중 오류가 발생했습니다.");
        return;
      }

      setHasLesson(false);
      setHasBus(true);
      setHasRental(false);
      await syncFromUpdatedMeeting();
    } catch {
      setServerError("네트워크 오류가 발생했습니다.");
    } finally {
      setSubmittingLinked(false);
    }
  }

  async function handleAddCompanionToProfile() {
    const trimmed = newProfileCompanionInput.trim();
    if (!trimmed) return;
    setAddingCompanionToProfile(true);
    setServerError("");
    try {
      const res = await fetch("/api/companions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        setServerError(data.error ?? "동반인 추가 중 오류가 발생했습니다.");
        return;
      }
      setCompanions((prev) => [...prev, data as CompanionItem]);
      setSelectedCompanionIdsForMeeting((prev) => new Set([...prev, (data as CompanionItem).id]));
      setNewProfileCompanionInput("");
    } catch {
      setServerError("네트워크 오류가 발생했습니다.");
    } finally {
      setAddingCompanionToProfile(false);
    }
  }

  async function handleCancel() {
    if (!myParticipant) return;
    setCancelling(true);
    try {
      const res = await fetch(`/api/participants/${myParticipant.id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok) {
        setCancelResult({ penalty: data.penalty, penaltyMessage: data.penaltyMessage, cancelledCompanions: data.cancelledCompanions ?? 0 });
        setMyParticipant(null);
        setSignedUpCompanionData({});
        setShowCancelConfirm(false);
        await syncFromUpdatedMeeting();
      } else {
        setServerError(data.error ?? "취소 중 오류가 발생했습니다.");
      }
    } catch {
      setServerError("네트워크 오류가 발생했습니다.");
    } finally {
      setCancelling(false);
    }
  }

  async function handleSaveMySignup() {
    if (!myParticipant) return;

    setSavingMySignup(true);
    setMySignupSaved(false);
    setServerError("");

    try {
      // 1. Save main participant options
      const res = await fetch(`/api/participants/${myParticipant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          note: mySignupNote,
          hasLesson: mySignupHasLesson,
          hasBus: mySignupHasBus,
          hasRental: mySignupHasRental,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setServerError(data.error ?? "신청 정보 저장 중 오류가 발생했습니다.");
        setSavingMySignup(false);
        return;
      }

      const updated = await res.json();
      setMyParticipant((prev) => prev ? {
        ...prev,
        note: updated.note ?? "",
        hasLesson: !!updated.hasLesson,
        hasBus: !!updated.hasBus,
        hasRental: !!updated.hasRental,
      } : prev);

      // 2. Batch register/cancel companions based on checkbox state
      const currentSignedUpIds = new Set(Object.keys(signedUpCompanionData).map(Number));
      const toAdd = [...selectedCompanionIdsForMeeting].filter((id) => !currentSignedUpIds.has(id));
      const toRemove = [...currentSignedUpIds].filter((id) => !selectedCompanionIdsForMeeting.has(id));

      for (const companionId of toAdd) {
        const options = companionOptions[companionId] ?? { hasLesson: false, hasBus: false, hasRental: false };
        const addRes = await fetch("/api/participants/companions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ meetingId: meeting.id, companionId, ...options }),
        });
        if (addRes.ok) {
          const created = await addRes.json();
          setSignedUpCompanionData((prev) => ({
            ...prev,
            [companionId]: { participantId: created.id, hasLesson: created.hasLesson, hasBus: created.hasBus, hasRental: created.hasRental },
          }));
        } else {
          const data = await addRes.json();
          setServerError(data.error ?? "동반인 추가 중 오류가 발생했습니다.");
          setSavingMySignup(false);
          return;
        }
      }

      for (const companionId of toRemove) {
        const delRes = await fetch("/api/participants/companions", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ meetingId: meeting.id, companionId }),
        });
        if (delRes.ok) {
          setSignedUpCompanionData((prev) => {
            const next = { ...prev };
            delete next[companionId];
            return next;
          });
        } else {
          const data = await delRes.json();
          setServerError(data.error ?? "동반인 취소 중 오류가 발생했습니다.");
          setSavingMySignup(false);
          return;
        }
      }

      setMySignupSaved(true);
      setTimeout(() => setMySignupSaved(false), 2500);
      await syncFromUpdatedMeeting();
    } catch {
      setServerError("네트워크 오류가 발생했습니다.");
    } finally {
      setSavingMySignup(false);
    }
  }

  return {
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
      selectedCompanionIdsForMeeting,
      newProfileCompanionInput,
      addingCompanionToProfile,
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
      setMainBusChoice,
      setMainShopOption,
      setMySignupBusChoice,
      setMySignupShopOption,
      setSelectedCompanionIdsForMeeting,
      setNewProfileCompanionInput,
      setCompanionOpt,
      handleAddNewCompanion,
      updateNewCompanion,
      closeMySignupDetails,
      handleSubmit,
      handleAddCompanionToMeeting,
      handleCancelCompanion,
      handleAddCompanionToProfile,
      handleUpdateCompanionOption,
      handleUpdateLinkedOption,
      handleApplyLinkedCompanion,
      handleCancel,
      handleSaveMySignup,
      syncFromUpdatedMeeting,
    },
  };
}
