"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { MeetingWithCounts } from "@/lib/types";
import { kakaoLogin } from "@/lib/kakao";

interface SessionUser {
  kakaoId: string;
  nickname: string;
  profileImage?: string;
}

interface CompanionItem {
  id: number;
  name: string;
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

export function SignupForm({ meeting }: SignupFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isClosed = !meeting.isOpen;

  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [profileName, setProfileName] = useState<string | null>(null);
  const [note, setNote] = useState("");
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

  // 이 모임에 신청된 동반인 ID 목록
  const [signedUpCompanionIds, setSignedUpCompanionIds] = useState<Set<number>>(new Set());
  const [companionActionLoading, setCompanionActionLoading] = useState<number | null>(null);

  // 취소 관련
  const [cancelling, setCancelling] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelResult, setCancelResult] = useState<{
    penalty: boolean;
    penaltyMessage: string | null;
    cancelledCompanions: number;
  } | null>(null);

  // 동반인 관련
  const [companions, setCompanions] = useState<CompanionItem[]>([]);
  const [selectedCompanions, setSelectedCompanions] = useState<Set<number>>(new Set());

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => {
        setUser(data);
        if (data?.kakaoId) {
          fetch("/api/profile")
            .then((r) => r.ok ? r.json() : null)
            .then((profile) => {
              if (profile?.name) {
                setName(profile.name);
                setProfileName(profile.name);
              } else if (data?.nickname) {
                setName(data.nickname);
              }
            })
            .catch(() => {
              if (data?.nickname) setName(data.nickname);
            });
        }
      })
      .catch(() => setUser(null));
  }, []);

  // 내 동반인 목록 로드
  useEffect(() => {
    if (!user?.kakaoId) return;
    fetch("/api/companions")
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setCompanions(data))
      .catch(() => {});
  }, [user]);

  // 내 참가 상태 확인 + 동반인 참가 상태
  const refreshParticipants = useCallback(() => {
    if (!user?.kakaoId) return;
    fetch(`/api/meetings/${meeting.id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.participants) {
          const mine = data.participants.find(
            (p: { kakaoId: string; status: string; companionId: number | null }) =>
              p.kakaoId === user.kakaoId && p.status !== "CANCELLED" && p.companionId === null
          );
          if (mine) {
            setMyParticipant({ id: mine.id, status: mine.status, waitlistPosition: mine.waitlistPosition });
          } else {
            setMyParticipant(null);
          }
          // 동반인들의 참가 상태 확인
          const signedUp = new Set<number>();
          for (const p of data.participants as { kakaoId: string; status: string; companionId: number | null }[]) {
            if (p.kakaoId === user.kakaoId && p.companionId !== null && p.status !== "CANCELLED") {
              signedUp.add(p.companionId);
            }
          }
          setSignedUpCompanionIds(signedUp);
        }
      })
      .catch(() => {});
  }, [user, meeting.id]);

  useEffect(() => {
    refreshParticipants();
  }, [refreshParticipants]);

  useEffect(() => {
    const authError = searchParams.get("auth_error");
    if (authError) {
      alert(`카카오 로그인 중 오류가 발생했습니다.\n에러 코드: ${authError}`);
      window.history.replaceState({}, "", `/meeting/${meeting.id}`);
    }
  }, [searchParams, meeting.id]);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUser(null);
    setName("");
    setMyParticipant(null);
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
          companionIds: Array.from(selectedCompanions),
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
    try {
      const res = await fetch("/api/participants/companions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingId: meeting.id, companionId }),
      });
      if (res.ok) {
        setSignedUpCompanionIds((prev) => new Set(prev).add(companionId));
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
        setSignedUpCompanionIds((prev) => {
          const next = new Set(prev);
          next.delete(companionId);
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

  async function handleCancel() {
    if (!myParticipant) return;
    setCancelling(true);

    try {
      const res = await fetch(`/api/participants/${myParticipant.id}`, { method: "DELETE" });
      const data = await res.json();

      if (res.ok) {
        setCancelResult({
          penalty: data.penalty,
          penaltyMessage: data.penaltyMessage,
          cancelledCompanions: data.cancelledCompanions ?? 0,
        });
        setMyParticipant(null);
        setSignedUpCompanionIds(new Set());
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

  // 비로그인 상태
  if (!user) {
    const returnTo = `/meeting/${meeting.id}`;
    return (
      <div className="space-y-4">
        <div className="bg-slate-50 border border-slate-100 rounded-xl p-5 text-center space-y-3">
          <p className="text-sm text-slate-600">카카오 계정으로 간편하게 신청할 수 있습니다</p>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => kakaoLogin(returnTo)}
              className="w-full h-12 inline-flex items-center gap-2 bg-[#FEE500] hover:bg-[#f0d800] text-[#3C1E1E] font-bold rounded-xl transition-colors justify-center text-sm"
            >
              <KakaoIcon />
              카카오로 로그인하여 신청하기
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 취소 완료 결과
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
            <div className="bg-red-100 rounded-lg p-3 mt-3 text-sm text-red-700">
              {cancelResult.penaltyMessage}
            </div>
          )}
        </div>
        <button
          onClick={() => { setCancelResult(null); router.refresh(); }}
          className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm transition-colors"
        >
          다시 신청하기
        </button>
      </div>
    );
  }

  // 이미 신청한 상태 → 동반인 관리 + 취소 가능
  if (myParticipant) {
    const signedUpCount = signedUpCompanionIds.size;
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
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
            {serverError}
          </div>
        )}

        {/* 동반인 관리 */}
        {companions.length > 0 ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5 mb-3">
              <span className="text-base">👥</span> 동반인 참가 관리
            </label>
            <div className="space-y-2">
              {companions.map((c) => {
                const isSignedUp = signedUpCompanionIds.has(c.id);
                const isLoading = companionActionLoading === c.id;
                return (
                  <div
                    key={c.id}
                    className={`flex items-center gap-3 p-3 rounded-lg ${
                      isSignedUp ? "bg-green-50 border border-green-200" : "bg-white border border-slate-200"
                    }`}
                  >
                    <div className="w-7 h-7 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
                      <span className="text-orange-400 text-xs font-bold">+</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-800 flex-1">{c.name}</span>
                    {isSignedUp ? (
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleCancelCompanion(c.id)}
                        className="text-xs font-bold text-red-500 hover:text-red-600 px-2.5 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        {isLoading ? "..." : "취소"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => handleAddCompanionToMeeting(c.id)}
                        className="text-xs font-bold text-blue-600 hover:text-blue-700 px-2.5 py-1.5 rounded-lg border border-blue-200 hover:bg-blue-50 transition-colors disabled:opacity-50"
                      >
                        {isLoading ? "..." : "추가"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500">등록된 동반인이 없습니다</span>
              <a href="/profile" className="text-xs text-blue-600 hover:text-blue-700 font-semibold">
                동반인 등록 &rarr;
              </a>
            </div>
          </div>
        )}

        {showCancelConfirm ? (
          <div className="bg-red-50 border border-red-200 rounded-xl p-5 space-y-3">
            <p className="text-sm font-semibold text-red-800">정말 참가를 취소하시겠습니까?</p>
            <p className="text-xs text-red-600">일정 2일 이내 취소 시 패널티가 부과될 수 있습니다.</p>
            {signedUpCount > 0 && (
              <p className="text-xs font-bold text-red-700">동반인 {signedUpCount}명의 참가도 함께 취소됩니다.</p>
            )}
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors disabled:bg-slate-300"
              >
                {cancelling ? "취소 중..." : signedUpCount > 0 ? `전체 취소 (동반 ${signedUpCount}명 포함)` : "취소 확인"}
              </button>
              <button
                onClick={() => setShowCancelConfirm(false)}
                className="px-4 py-2.5 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors"
              >
                돌아가기
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowCancelConfirm(true)}
            className="w-full py-3 rounded-xl border-2 border-red-200 text-red-600 hover:bg-red-50 font-bold text-sm transition-colors"
          >
            참가 취소하기
          </button>
        )}
      </div>
    );
  }

  // 로그인 상태 - 신청 폼
  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {duplicate && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          이 모임에 이미 신청하셨습니다.
        </div>
      )}

      {serverError && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {serverError}
        </div>
      )}

      {/* 이름 */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
          이름 <span className="text-red-500">*</span>
          {profileName ? (
            <span className="font-normal text-slate-400 ml-1 text-xs">(프로필에서 변경 가능)</span>
          ) : (
            <span className="font-normal text-amber-500 ml-1 text-xs">(프로필에서 이름을 설정해 주세요)</span>
          )}
        </label>
        <input
          type="text"
          value={name}
          readOnly={!!profileName}
          onChange={profileName ? undefined : (e) => { setName(e.target.value); setNameError(""); }}
          placeholder="홍길동"
          disabled={submitting}
          className={`w-full px-4 py-2.5 rounded-lg border text-sm outline-none transition-colors
            ${nameError ? "border-red-400 bg-red-50" : profileName ? "border-slate-200 bg-slate-50 text-slate-600" : "border-slate-200 focus:border-blue-500"}
            disabled:bg-slate-50 disabled:text-slate-400`}
        />
        {nameError && <p className="mt-1 text-xs text-red-500">{nameError}</p>}
      </div>

      {/* 메모 */}
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-1.5">
          메모 <span className="text-slate-400 font-normal">(선택)</span>
        </label>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 100))}
          placeholder="처음 참가합니다, 주차 문의 등..."
          rows={3}
          disabled={submitting}
          className="w-full px-4 py-2.5 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-500 transition-colors resize-none disabled:bg-slate-50 disabled:text-slate-400"
        />
        <p className="mt-1 text-xs text-slate-400 text-right">{note.length}/100</p>
      </div>

      {/* 동반인 함께 신청 */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
            <span className="text-base">👥</span> 동반인 함께 신청
          </label>
          {companions.length === 0 && (
            <a
              href="/profile"
              className="text-xs text-blue-600 hover:text-blue-700 font-semibold"
            >
              동반인 등록 &rarr;
            </a>
          )}
        </div>

        {companions.length === 0 ? (
          <p className="text-xs text-slate-400">
            등록된 동반인이 없습니다. 프로필 페이지에서 동반인을 먼저 등록해주세요.
          </p>
        ) : (
          <div className="space-y-2 mt-2">
            {companions.map((c) => {
              const isSelected = selectedCompanions.has(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setSelectedCompanions((prev) => {
                      const next = new Set(prev);
                      if (next.has(c.id)) next.delete(c.id);
                      else next.add(c.id);
                      return next;
                    });
                  }}
                  disabled={submitting}
                  className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all text-left ${
                    isSelected
                      ? "bg-blue-50 border-2 border-blue-400"
                      : "bg-white border-2 border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-colors ${
                    isSelected ? "bg-blue-500 border-blue-500" : "border-slate-300"
                  }`}>
                    {isSelected && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                  <div className="w-7 h-7 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
                    <span className="text-orange-400 text-xs font-bold">+</span>
                  </div>
                  <span className="text-sm font-semibold text-slate-800 flex-1">{c.name}</span>
                  <span className="text-[10px] bg-orange-100 text-orange-600 px-1.5 py-0.5 rounded font-bold shrink-0">동반</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={submitting || !name.trim()}
        className={`w-full py-3 rounded-xl font-bold text-white text-sm transition-all
          ${submitting || !name.trim()
            ? "bg-slate-300 cursor-not-allowed"
            : "bg-blue-600 hover:bg-blue-700 active:scale-[0.99]"
          }`}
      >
        {submitting ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            처리 중...
          </span>
        ) : selectedCompanions.size > 0
          ? `참가 신청하기 (동반 ${selectedCompanions.size}명 포함)`
          : "참가 신청하기"}
      </button>
    </form>
  );
}
