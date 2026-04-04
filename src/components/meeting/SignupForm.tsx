"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { MeetingWithCounts } from "@/lib/types";
import { kakaoLogin } from "@/lib/kakao";
import {
  DEFAULT_PARTICIPANT_OPTION_PRICING_GUIDE,
  PARTICIPANT_OPTION_PRICING_GUIDE_KEY,
} from "@/lib/settings";

interface SessionUser {
  kakaoId: string;
  nickname: string;
  profileImage?: string;
}

interface UserProfile {
  memberType: string;
  name: string | null;
}

interface CompanionItem {
  id: number;
  name: string;
}

interface CompanionOption {
  hasLesson: boolean;
  hasBus: boolean;
  hasRental: boolean;
}

interface NewCompanionEntry {
  name: string;
  hasLesson: boolean;
  hasBus: boolean;
  hasRental: boolean;
}

// 참가 후 동반인 관리용 (participantId 포함)
interface SignedUpCompanionData {
  participantId: number;
  hasLesson: boolean;
  hasBus: boolean;
  hasRental: boolean;
}

interface SignupFormProps {
  meeting: MeetingWithCounts;
}

function KakaoIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
      <path d="M12 3C6.477 3 2 6.477 2 10.857c0 2.713 1.584 5.1 3.988 6.577L5 21l4.29-2.287C10.145 18.9 11.058 19 12 19c5.523 0 10-3.477 10-7.143C22 6.477 17.523 3 12 3z" />
    </svg>
  );
}

function OptionPricingHelp({ guide }: { guide: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="참가 옵션 가격 안내"
        onClick={() => setOpen((value) => !value)}
        className={`flex h-5 w-5 items-center justify-center rounded-full border text-[11px] font-bold transition-colors ${
          open
            ? "border-[var(--brand-primary)] bg-[var(--brand-primary-soft-strong)] text-[var(--brand-primary-text)]"
            : "border-slate-300 bg-white text-slate-500 hover:border-slate-400"
        }`}
      >
        <span aria-hidden="true" className="material-symbols-outlined text-[14px] leading-none">info</span>
      </button>
      {open ? (
        <div className="absolute right-0 top-full z-20 mt-2 w-64 rounded-2xl border border-[var(--brand-primary-border)] bg-white p-3 text-left shadow-[0_12px_30px_rgba(26,28,28,0.08)]">
          <p className="mb-2 text-xs font-bold text-[#1a1c1c]">가격 안내</p>
          <p className="whitespace-pre-line text-xs leading-5 text-[#4b4732]/80">{guide}</p>
        </div>
      ) : null}
    </div>
  );
}

function RadioOptionItem({
  label,
  icon,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  icon?: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:border-slate-300 disabled:opacity-50"
    >
      <div className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 border-slate-300 bg-white">
        {checked ? <div className="h-2 w-2 rounded-full bg-[var(--brand-primary)]" /> : null}
      </div>
      <span className="flex items-center gap-1.5">
        {icon ? <span aria-hidden="true" className="text-base leading-none">{icon}</span> : null}
        <span>{label}</span>
      </span>
    </button>
  );
}

function CheckboxOptionItem({
  label,
  icon,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  icon?: string;
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      disabled={disabled}
      className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-semibold text-slate-700 transition-all hover:border-slate-300 disabled:opacity-50"
    >
      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-slate-100 text-xs font-bold text-slate-500 transition-colors">
        {checked ? (
          <svg className="h-2.5 w-2.5 text-[#000000]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <span>+</span>
        )}
      </div>
      <span className="flex items-center gap-1.5">
        {icon ? <span aria-hidden="true" className="text-base leading-none">{icon}</span> : null}
        <span>{label}</span>
      </span>
    </button>
  );
}

export function SignupForm({ meeting }: SignupFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isClosed = !meeting.isOpen;
  const meetingHomeUrl = `/?date=${encodeURIComponent(meeting.date)}`;

  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [name, setName] = useState("");
  const [profileName, setProfileName] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [hasLesson, setHasLesson] = useState(false);
  const [hasBus, setHasBus] = useState(false);
  const [hasRental, setHasRental] = useState(false);
  const [participantOptionPricingGuide, setParticipantOptionPricingGuide] = useState(DEFAULT_PARTICIPANT_OPTION_PRICING_GUIDE);
  const [nameError, setNameError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [duplicate, setDuplicate] = useState(false);

  // 이미 신청한 참가 정보
  const [myParticipant, setMyParticipant] = useState<{
    id: number;
    status: string;
    waitlistPosition: number | null;
  } | null>(null);

  // 동반인 관련
  const [companions, setCompanions] = useState<CompanionItem[]>([]);
  const [selectedCompanions, setSelectedCompanions] = useState<Set<number>>(new Set());
  const [companionOptions, setCompanionOptions] = useState<Record<number, CompanionOption>>({});

  // 신규 동반인 (인라인 입력)
  const [newCompanionInput, setNewCompanionInput] = useState("");
  const [newCompanions, setNewCompanions] = useState<NewCompanionEntry[]>([]);

  // 이미 이 모임에 신청된 동반인 데이터 (participantId + options)
  const [signedUpCompanionData, setSignedUpCompanionData] = useState<Record<number, SignedUpCompanionData>>({});
  const [companionActionLoading, setCompanionActionLoading] = useState<number | null>(null);

  // 취소 관련
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelResult, setCancelResult] = useState<{
    penalty: boolean;
    penaltyMessage: string | null;
    cancelledCompanions: number;
  } | null>(null);

  // 연동된 동반인(COMPANION 계정) 상태
  const [linkedStatus, setLinkedStatus] = useState<{
    linked: boolean;
    companion?: { id: number; name: string; owner: { name: string | null; kakaoId: string } };
    participant?: { id: number; status: string; hasLesson: boolean; hasBus: boolean; hasRental: boolean } | null;
  } | null>(null);
  const [updatingLinked, setUpdatingLinked] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        setUser(data);
        if (data?.kakaoId) {
          fetch("/api/profile")
            .then((r) => r.ok ? r.json() : null)
            .then((profile) => {
              if (profile) {
                setUserProfile(profile);
                if (profile.name) {
                  setName(profile.name);
                  setProfileName(profile.name);
                } else if (data?.nickname) {
                  setName(data.nickname);
                }
              } else if (data?.nickname) {
                setName(data.nickname);
              }
            })
            .catch(() => { if (data?.nickname) setName(data.nickname); });
        }
      })
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    fetch("/api/settings/public")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.[PARTICIPANT_OPTION_PRICING_GUIDE_KEY]) {
          setParticipantOptionPricingGuide(data[PARTICIPANT_OPTION_PRICING_GUIDE_KEY]);
        }
      })
      .catch(() => {});
  }, []);

  // 동반인 계정인 경우 연동 상태 조회
  useEffect(() => {
    if (!user?.kakaoId || userProfile?.memberType !== "COMPANION") return;
    fetch(`/api/participants/linked-companion?meetingId=${meeting.id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setLinkedStatus(data))
      .catch(() => {});
  }, [user, userProfile, meeting.id]);

  // 내 동반인 목록 로드 (정회원만)
  useEffect(() => {
    if (!user?.kakaoId || userProfile?.memberType !== "REGULAR") return;
    fetch("/api/companions")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setCompanions(data))
      .catch(() => {});
  }, [user, userProfile]);

  // 참가 상태 + 동반인 참가 데이터
  const refreshParticipants = useCallback(() => {
    if (!user?.kakaoId) return;
    fetch(`/api/meetings/${meeting.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (!data.participants) return;
        const mine = data.participants.find(
          (p: { kakaoId: string; status: string; companionId: number | null }) =>
            p.kakaoId === user.kakaoId && p.status !== "CANCELLED" && p.companionId === null
        );
        setMyParticipant(mine ? { id: mine.id, status: mine.status, waitlistPosition: mine.waitlistPosition } : null);

        // 동반인 참가 데이터 (participantId + hasLesson/hasBus)
        const data2: Record<number, SignedUpCompanionData> = {};
        for (const p of data.participants as { kakaoId: string; status: string; companionId: number | null; id: number; hasLesson: boolean; hasBus: boolean; hasRental: boolean }[]) {
          if (p.kakaoId === user.kakaoId && p.companionId !== null && p.status !== "CANCELLED") {
            data2[p.companionId] = { participantId: p.id, hasLesson: p.hasLesson, hasBus: p.hasBus, hasRental: p.hasRental };
          }
        }
        setSignedUpCompanionData(data2);
      })
      .catch(() => {});
  }, [user, meeting.id]);

  // 연동 동반인 모임 상태 새로고침
  const refreshLinkedStatus = useCallback(() => {
    if (!user?.kakaoId || userProfile?.memberType !== "COMPANION") return;
    fetch(`/api/participants/linked-companion?meetingId=${meeting.id}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => setLinkedStatus(data))
      .catch(() => {});
  }, [user, userProfile, meeting.id]);

  useEffect(() => { refreshParticipants(); }, [refreshParticipants]);

  useEffect(() => {
    const authError = searchParams.get("auth_error");
    if (authError) {
      alert(`카카오 로그인 중 오류가 발생했습니다.\n에러 코드: ${authError}`);
      window.history.replaceState({}, "", meetingHomeUrl);
    }
  }, [meetingHomeUrl, searchParams]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setName("");
    setMyParticipant(null);
  }

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
    setNewCompanions((prev) => prev.map((c, i) => {
      if (i !== idx) return c;
      return {
        ...c,
        ...(field === "hasLesson" && value ? { hasRental: false } : {}),
        ...(field === "hasRental" && value ? { hasLesson: false } : {}),
        [field]: value,
      };
    }));
  }

  function toggleMainOption(field: "hasLesson" | "hasBus" | "hasRental") {
    if (field === "hasLesson") {
      setHasLesson((current) => {
        const next = !current;
        if (next) setHasRental(false);
        return next;
      });
      return;
    }
    if (field === "hasRental") {
      setHasRental((current) => {
        const next = !current;
        if (next) setHasLesson(false);
        return next;
      });
      return;
    }
    setHasBus((current) => !current);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setNameError("이름을 입력해주세요"); return; }
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

      if (res.status === 409) { setDuplicate(true); setSubmitting(false); return; }
      if (!res.ok) {
        const data = await res.json();
        setServerError(data.error ?? "신청 중 오류가 발생했습니다.");
        setSubmitting(false);
        return;
      }

      const data = await res.json();
      const compCount = data.companions?.length ?? 0;
      router.push(
        `/signup/confirm?status=${data.status}&waitlist=${data.waitlistPosition ?? ""}&meetingId=${meeting.id}&name=${encodeURIComponent(name)}&companions=${compCount}`
      );
    } catch {
      setServerError("네트워크 오류가 발생했습니다.");
      setSubmitting(false);
    }
  }

  async function handleAddCompanionToMeeting(companionId: number) {
    setCompanionActionLoading(companionId);
    const opts = companionOptions[companionId] ?? { hasLesson: false, hasBus: false, hasRental: false };
    try {
      const res = await fetch("/api/participants/companions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId: meeting.id, companionId, ...opts }),
      });
      if (res.ok) {
        const created = await res.json();
        setSignedUpCompanionData((prev) => ({
          ...prev,
          [companionId]: { participantId: created.id, hasLesson: created.hasLesson, hasBus: created.hasBus, hasRental: created.hasRental },
        }));
        router.refresh();
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
        router.refresh();
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
    const cData = signedUpCompanionData[companionId];
    if (!cData) return;
    setSignedUpCompanionData((prev) => ({
      ...prev,
      [companionId]: {
        ...prev[companionId],
        ...(field === "hasLesson" && value ? { hasRental: false } : {}),
        ...(field === "hasRental" && value ? { hasLesson: false } : {}),
        [field]: value,
      },
    }));
    await fetch(`/api/participants/${cData.participantId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(field === "hasLesson" && value ? { hasRental: false } : {}),
        ...(field === "hasRental" && value ? { hasLesson: false } : {}),
        [field]: value,
      }),
    });
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
    refreshLinkedStatus();
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
      } else {
        setServerError(data.error ?? "취소 중 오류가 발생했습니다.");
      }
    } catch {
      setServerError("네트워크 오류가 발생했습니다.");
    } finally {
      setCancelling(false);
    }
  }

  // ───────────────────────────────────────────── render ─────────────────────────────────────────────

  if (isClosed) {
    return (
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 text-center text-slate-500">
        이 모임의 신청이 마감되었습니다.
      </div>
    );
  }

  if (user === undefined) {
    return <div className="py-8 text-center text-slate-400 text-sm">불러오는 중...</div>;
  }

  if (!user) {
    return (
      <div className="space-y-4">
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-5 text-center space-y-3">
          <p className="text-sm text-slate-600">카카오 계정으로 간편하게 신청할 수 있습니다</p>
          <button
            type="button"
            onClick={() => kakaoLogin(meetingHomeUrl)}
            className="brand-button-primary w-full h-12 inline-flex items-center justify-center gap-2 rounded-xl text-sm font-bold transition-colors"
          >
            <KakaoIcon />
            카카오로 로그인하여 신청하기
          </button>
        </div>
      </div>
    );
  }

  // ─── COMPANION 계정 뷰 ─────────────────────────────────────────────────────────────────────────────
  if (userProfile?.memberType === "COMPANION") {
    if (!linkedStatus) {
      return <div className="py-4 text-center text-slate-400 text-sm">불러오는 중...</div>;
    }

    if (!linkedStatus.linked) {
      return (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-800 space-y-2">
          <p className="font-semibold">동반인 연동 필요</p>
          <p className="text-xs">프로필 페이지에서 정회원과 연동해주세요. 연동 후 참가 여부를 확인할 수 있습니다.</p>
          <a href="/profile" className="brand-link inline-block text-xs font-bold hover:underline">프로필로 이동 &rarr;</a>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm">
          <p className="text-xs text-slate-400 mb-1">정회원: {linkedStatus.companion?.owner.name ?? "알 수 없음"}</p>
          <p className="font-semibold text-slate-800">{linkedStatus.companion?.name}</p>
        </div>

        {linkedStatus.participant ? (
          <div className="space-y-3">
            <div className={`rounded-xl p-4 text-center ${linkedStatus.participant.status === "APPROVED" ? "bg-green-50 border border-green-200" : "brand-panel"}`}>
              <div className="text-2xl mb-1">✓</div>
              <p className="font-bold text-slate-800 text-sm">
                {linkedStatus.participant.status === "APPROVED" ? "참가 확정" : "대기 중"}
              </p>
            </div>

            <div className="brand-panel rounded-xl p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-slate-700">내 참가 옵션 변경 <span className="text-xs font-normal text-slate-400">(선택)</span></p>
                <OptionPricingHelp guide={participantOptionPricingGuide} />
              </div>
              <div className="space-y-2">
                <RadioOptionItem
                  label="강습+장비대여"
                  icon="🏄‍♂️"
                  checked={linkedStatus.participant.hasLesson}
                  onChange={() => handleUpdateLinkedOption("hasLesson", !linkedStatus.participant!.hasLesson)}
                  disabled={updatingLinked}
                />
                <RadioOptionItem
                  label="장비 대여만"
                  icon="🩳"
                  checked={linkedStatus.participant.hasRental}
                  onChange={() => handleUpdateLinkedOption("hasRental", !linkedStatus.participant!.hasRental)}
                  disabled={updatingLinked}
                />
                <div className="ml-6 rounded-xl border border-dashed border-slate-200 bg-white/80 p-2">
                  <CheckboxOptionItem
                    label="셔틀 버스"
                    icon="🚌"
                    checked={linkedStatus.participant.hasBus}
                    onChange={() => handleUpdateLinkedOption("hasBus", !linkedStatus.participant!.hasBus)}
                    disabled={updatingLinked}
                  />
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-sm text-slate-500 text-center">
            아직 이 모임에 신청되지 않았습니다.<br />
            <span className="text-xs text-slate-400">정회원이 동반인 추가 시 자동 등록됩니다.</span>
          </div>
        )}
      </div>
    );
  }

  // ─── 취소 완료 결과 ────────────────────────────────────────────────────────────────────────────────
  if (cancelResult) {
    return (
      <div className="space-y-4">
        <div className={`rounded-xl p-5 text-center ${cancelResult.penalty ? "bg-red-50 border border-red-200" : "bg-slate-50 border border-slate-200"}`}>
          <div className="text-3xl mb-3">{cancelResult.penalty ? "⚠️" : "✓"}</div>
          <p className="font-bold text-slate-800 mb-2">참가가 취소되었습니다</p>
          {cancelResult.cancelledCompanions > 0 && (
            <p className="text-sm text-slate-600 mb-2">동반인 {cancelResult.cancelledCompanions}명도 함께 취소되었습니다</p>
          )}
          {cancelResult.penalty && cancelResult.penaltyMessage && (
            <div className="bg-red-100 rounded-lg p-3 mt-3 text-sm text-red-700">{cancelResult.penaltyMessage}</div>
          )}
        </div>
        <button
          onClick={() => { setCancelResult(null); router.refresh(); }}
          className="brand-button-primary w-full rounded-xl py-3 text-sm font-bold transition-colors"
        >
          다시 신청하기
        </button>
      </div>
    );
  }

  // ─── 이미 신청한 상태 (정회원) ────────────────────────────────────────────────────────────────────
  if (myParticipant) {
    const signedUpCount = Object.keys(signedUpCompanionData).length;
    return (
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
          <div className="text-3xl mb-2">✓</div>
          <p className="font-bold text-green-800">
            {myParticipant.status === "APPROVED" ? "참가가 확정되었습니다" : `대기자 ${myParticipant.waitlistPosition}번째입니다`}
          </p>
          {signedUpCount > 0 && (
            <p className="text-sm text-green-600 mt-1">동반인 {signedUpCount}명도 함께 신청되었습니다</p>
          )}
        </div>

        {serverError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{serverError}</div>
        )}

        {/* 동반인 참가 관리 */}
        {companions.length > 0 ? (
          <div className="brand-panel rounded-xl p-4">
            <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-3">
              <span className="text-base">👥</span> 동반인 참가 관리
            </p>
            <div className="space-y-3">
              {companions.map((c) => {
                const cData = signedUpCompanionData[c.id];
                const isSignedUp = !!cData;
                const isLoading = companionActionLoading === c.id;
                const opts = companionOptions[c.id] ?? { hasLesson: false, hasBus: false, hasRental: false };
                return (
                  <div key={c.id} className={`p-3 rounded-lg border ${isSignedUp ? "bg-green-50 border-green-200" : "bg-white border-slate-200"}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-6 h-6 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
                        <span className="text-orange-400 text-xs font-bold">+</span>
                      </div>
                      <span className="text-sm font-semibold text-slate-800 flex-1">{c.name}</span>
                      {isSignedUp ? (
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => handleCancelCompanion(c.id)}
                          className="text-xs font-bold text-red-500 hover:text-red-600 px-2 py-1 rounded-lg border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
                        >
                          {isLoading ? "..." : "취소"}
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => handleAddCompanionToMeeting(c.id)}
                          className="brand-button-secondary rounded-lg px-2 py-1 text-xs font-bold transition-colors disabled:opacity-50"
                        >
                          {isLoading ? "..." : "추가"}
                        </button>
                      )}
                    </div>
                    {/* 옵션 토글 */}
                    <div className="space-y-2 pl-8">
                      <RadioOptionItem
                        label="강습+장비대여"
                        icon="🏄‍♂️"
                        checked={isSignedUp ? (cData?.hasLesson ?? false) : opts.hasLesson}
                        onChange={() => isSignedUp
                          ? handleUpdateCompanionOption(c.id, "hasLesson", !(cData?.hasLesson ?? false))
                          : setCompanionOpt(c.id, "hasLesson", !opts.hasLesson)
                        }
                        disabled={isLoading}
                      />
                      <RadioOptionItem
                        label="장비 대여만"
                        icon="🩳"
                        checked={isSignedUp ? (cData?.hasRental ?? false) : opts.hasRental}
                        onChange={() => isSignedUp
                          ? handleUpdateCompanionOption(c.id, "hasRental", !(cData?.hasRental ?? false))
                          : setCompanionOpt(c.id, "hasRental", !opts.hasRental)
                        }
                        disabled={isLoading}
                      />
                      <div className="ml-6 rounded-xl border border-dashed border-slate-200 bg-white/80 p-2">
                        <CheckboxOptionItem
                          label="셔틀 버스"
                          icon="🚌"
                          checked={isSignedUp ? (cData?.hasBus ?? false) : opts.hasBus}
                          onChange={() => isSignedUp
                            ? handleUpdateCompanionOption(c.id, "hasBus", !(cData?.hasBus ?? false))
                            : setCompanionOpt(c.id, "hasBus", !opts.hasBus)
                          }
                          disabled={isLoading}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="brand-panel rounded-xl p-4 flex items-center justify-between">
            <span className="text-sm text-slate-500">등록된 동반인이 없습니다</span>
            <a href="/profile" className="brand-link text-xs font-semibold">동반인 등록 &rarr;</a>
          </div>
        )}

        {showCancelConfirm ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 space-y-3">
            <p className="text-sm font-semibold text-red-800">정말 참가를 취소하시겠습니까?</p>
            <p className="text-xs text-red-600">화요일 18시 이후 취소 시 패널티가 부과될 수 있습니다.</p>
            {signedUpCount > 0 && (
              <p className="text-xs font-bold text-red-700">동반인 {signedUpCount}명의 참가도 함께 취소됩니다.</p>
            )}
            <div className="flex gap-2">
              <button onClick={handleCancel} disabled={cancelling}
                className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors disabled:bg-slate-300">
                {cancelling ? "취소 중..." : signedUpCount > 0 ? `전체 취소 (동반 ${signedUpCount}명 포함)` : "취소 확인"}
              </button>
              <button onClick={() => setShowCancelConfirm(false)}
                className="px-4 py-2.5 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors">
                돌아가기
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => setShowCancelConfirm(true)}
            className="w-full py-3 rounded-xl border-2 border-red-200 text-red-600 hover:bg-red-50 font-bold text-sm transition-colors">
            참가 취소하기
          </button>
        )}
      </div>
    );
  }

  // ─── 신청 폼 (정회원) ─────────────────────────────────────────────────────────────────────────────
  const totalCompanionCount = selectedCompanions.size + newCompanions.length;
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {duplicate && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          이 모임에 이미 신청하셨습니다.
        </div>
      )}
      {serverError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">{serverError}</div>
      )}

      {/* 이름 */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
          이름 <span className="text-red-500">*</span>
          {profileName
            ? <span className="font-normal text-slate-400 ml-1 text-xs">(프로필에서 변경 가능)</span>
            : <span className="font-normal text-amber-500 ml-1 text-xs">(프로필에서 이름을 설정해 주세요)</span>
          }
        </label>
        <input
          type="text"
          value={name}
          readOnly={!!profileName}
          onChange={profileName ? undefined : (e) => { setName(e.target.value); setNameError(""); }}
          placeholder="홍길동"
          disabled={submitting}
          className={`w-full px-4 py-2.5 rounded-lg text-sm outline-none
            ${nameError ? "border border-red-400 bg-red-50" : profileName ? "border border-slate-200 bg-slate-50 text-slate-600" : "brand-input"}
            disabled:bg-slate-50 disabled:text-slate-400`}
        />
        {nameError && <p className="mt-1 text-xs text-red-500">{nameError}</p>}
      </div>

      {/* 내 참가 옵션 */}
      <div className="brand-panel rounded-xl p-3">
        <div className="mb-2.5 flex items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-700">내 참가 옵션 <span className="text-xs font-normal text-slate-400">(선택)</span></p>
          <OptionPricingHelp guide={participantOptionPricingGuide} />
        </div>
        <div className="space-y-2">
          <RadioOptionItem label="강습+장비대여" icon="🏄‍♂️" checked={hasLesson} onChange={() => toggleMainOption("hasLesson")} disabled={submitting} />
          <RadioOptionItem label="장비 대여만" icon="🩳" checked={hasRental} onChange={() => toggleMainOption("hasRental")} disabled={submitting} />
          <div className="ml-6 rounded-xl border border-dashed border-slate-200 bg-white/80 p-2">
            <CheckboxOptionItem label="셔틀 버스" icon="🚌" checked={hasBus} onChange={() => toggleMainOption("hasBus")} disabled={submitting} />
          </div>
        </div>
      </div>

      {/* 비고 */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
          비고 <span className="text-slate-400 font-normal">(선택)</span>
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 100))}
          placeholder="처음 참가합니다, 주차 문의 등..."
          rows={2}
          disabled={submitting}
          className="brand-input w-full resize-none rounded-lg px-4 py-2.5 text-sm outline-none disabled:bg-slate-50 disabled:text-slate-400"
        />
        <p className="mt-1 text-xs text-slate-400 text-right">{note.length}/100</p>
      </div>

      {/* 동반인 신청 */}
      <div className="brand-panel rounded-xl p-3 space-y-3">
        <p className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
          <span className="text-base">👥</span> 동반인 함께 신청
        </p>

        {/* 기존 동반인 */}
        {companions.length > 0 && (
          <div className="space-y-2">
            {companions.map((c) => {
              const isSelected = selectedCompanions.has(c.id);
              const opts = companionOptions[c.id] ?? { hasLesson: false, hasBus: false, hasRental: false };
              return (
                <div key={c.id} className={`rounded-lg border-2 p-2.5 transition-all ${isSelected ? "brand-panel-strong" : "bg-white border-slate-200"}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCompanions((prev) => {
                        const next = new Set(prev);
                        if (next.has(c.id)) next.delete(c.id); else next.add(c.id);
                        return next;
                      });
                    }}
                    disabled={submitting}
                    className="w-full flex items-center gap-3 text-left"
                  >
                    <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${isSelected ? "brand-check-active" : "border-slate-300"}`}>
                      {isSelected && (
                        <svg className="w-3 h-3 text-[#000000]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </div>
                    <div className="w-6 h-6 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
                      <span className="text-orange-400 text-xs font-bold">+</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-800 flex-1">{c.name}</span>
                  </button>
                  {isSelected && (
                    <div className="mt-2 space-y-2 pl-14">
                      <RadioOptionItem label="강습+장비대여" icon="🏄‍♂️" checked={opts.hasLesson} onChange={() => setCompanionOpt(c.id, "hasLesson", !opts.hasLesson)} disabled={submitting} />
                      <RadioOptionItem label="장비 대여만" icon="🩳" checked={opts.hasRental} onChange={() => setCompanionOpt(c.id, "hasRental", !opts.hasRental)} disabled={submitting} />
                      <div className="ml-6 rounded-xl border border-dashed border-slate-200 bg-white/80 p-2">
                        <CheckboxOptionItem label="셔틀 버스" icon="🚌" checked={opts.hasBus} onChange={() => setCompanionOpt(c.id, "hasBus", !opts.hasBus)} disabled={submitting} />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* 새 동반인 입력 */}
        <div>
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-stretch gap-2">
            <input
              type="text"
              value={newCompanionInput}
              onChange={(e) => setNewCompanionInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddNewCompanion(); } }}
              placeholder="동반인 이름"
              disabled={submitting}
              className="brand-input min-w-0 rounded-lg px-3 py-2 text-sm outline-none disabled:bg-slate-50"
            />
            <button
              type="button"
              onClick={handleAddNewCompanion}
              disabled={submitting || !newCompanionInput.trim()}
              className="brand-button-primary shrink-0 whitespace-nowrap rounded-lg px-3 py-2 text-sm font-bold transition-colors"
            >
              추가
            </button>
          </div>

          {newCompanions.length > 0 && (
            <div className="mt-2 space-y-2">
              {newCompanions.map((nc, idx) => (
                <div key={idx} className="brand-panel-strong rounded-lg p-2.5">
                  <div className="mb-2 flex items-center gap-2">
                    <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--brand-primary-soft-accent)]">
                      <span className="text-xs font-bold text-[var(--brand-primary-text)]">+</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-800 flex-1">{nc.name}</span>
                    <span className="rounded bg-[var(--brand-primary-soft-accent)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--brand-primary-text)]">신규</span>
                    <button type="button" onClick={() => setNewCompanions((prev) => prev.filter((_, i) => i !== idx))}
                      className="text-xs text-slate-400 hover:text-red-500 transition-colors ml-1">✕</button>
                  </div>
                  <div className="space-y-2 pl-8">
                    <RadioOptionItem label="강습+장비대여" icon="🏄‍♂️" checked={nc.hasLesson} onChange={() => updateNewCompanion(idx, "hasLesson", !nc.hasLesson)} disabled={submitting} />
                    <RadioOptionItem label="장비 대여만" icon="🩳" checked={nc.hasRental} onChange={() => updateNewCompanion(idx, "hasRental", !nc.hasRental)} disabled={submitting} />
                    <div className="ml-6 rounded-xl border border-dashed border-slate-200 bg-white/80 p-2">
                      <CheckboxOptionItem label="셔틀 버스" icon="🚌" checked={nc.hasBus} onChange={() => updateNewCompanion(idx, "hasBus", !nc.hasBus)} disabled={submitting} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <button
        type="submit"
        disabled={submitting || !name.trim()}
        className="brand-button-primary w-full rounded-xl py-2.5 text-sm font-bold transition-all active:scale-[0.99] disabled:cursor-not-allowed"
      >
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
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
