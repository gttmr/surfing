"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface SessionUser {
  kakaoId: string;
  nickname: string;
}

export default function CreateMeetingPage() {
  const router = useRouter();
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);

  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((data) => setUser(data?.kakaoId ? data : null))
      .catch(() => setUser(null));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!date || !startTime || !endTime || !location.trim()) {
      setError("필수 항목을 모두 입력해주세요");
      return;
    }
    if (startTime >= endTime) {
      setError("종료 시간은 시작 시간보다 늦어야 합니다");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          startTime,
          endTime,
          location: location.trim(),
          description: description.trim() || null,
          meetingType: "비정기",
          isOpen: true,
        }),
      });

      if (res.ok) {
        const meeting = await res.json();
        router.push(`/meeting/${meeting.id}`);
      } else {
        const data = await res.json();
        setError(data.error ?? "모임 등록에 실패했습니다");
      }
    } catch {
      setError("네트워크 오류가 발생했습니다");
    } finally {
      setSubmitting(false);
    }
  }

  if (user === undefined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-on-surface-variant text-sm">불러오는 중...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <header className="fixed top-0 w-full z-50 bg-white/70 backdrop-blur-xl shadow-[0_8px_24px_rgba(26,28,28,0.06)] flex items-center gap-4 px-6 py-2 h-16">
          <Link href="/" className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface-container-low hover:bg-surface-container-high transition-colors">
            <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
          </Link>
          <h1 className="font-bold text-lg font-headline">비정기 모임 등록</h1>
        </header>
        <main className="pt-24 max-w-md mx-auto px-6 py-12 text-center">
          <div className="text-5xl mb-4">🔒</div>
          <p className="text-on-surface-variant font-medium mb-6">로그인이 필요합니다</p>
          <Link
            href="/api/auth/kakao?returnTo=/meeting/create"
            className="inline-flex items-center gap-2 px-6 py-3 bg-black hover:bg-neutral-800 text-white font-bold rounded-xl transition-colors"
          >
            로그인하기
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Stitch 헤더 */}
      <header className="fixed top-0 w-full z-50 bg-white/70 backdrop-blur-xl shadow-[0_8px_24px_rgba(26,28,28,0.06)] flex items-center gap-4 px-6 py-2 h-16">
        <Link href="/" className="w-9 h-9 flex items-center justify-center rounded-xl bg-surface-container-low hover:bg-surface-container-high transition-colors">
          <span className="material-symbols-outlined text-on-surface-variant">arrow_back</span>
        </Link>
        <div>
          <h1 className="font-bold text-lg font-headline leading-tight">비정기 모임 등록</h1>
          <p className="text-xs text-on-surface-variant">회원이 직접 모임을 만들 수 있습니다</p>
        </div>
      </header>

      <main className="pt-20 max-w-md mx-auto px-6 py-6">
        {/* 안내 배너 */}
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 flex items-start gap-2">
          <span className="text-amber-500 text-sm mt-0.5">ℹ️</span>
          <p className="text-sm text-amber-800">
            비정기 모임은 회원 누구나 등록할 수 있습니다. 등록 후 다른 회원들이 참가 신청을 할 수 있습니다.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="bg-surface-container-lowest rounded-xl border border-outline-variant/10 shadow-sm p-5 space-y-5">
          <h2 className="text-base font-bold font-headline text-on-surface">모임 정보</h2>

          {error && (
            <div className="bg-error-container border border-error/20 rounded-xl p-3 text-sm text-error">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-on-surface mb-1.5">
              날짜 <span className="text-error">*</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={new Date().toISOString().split("T")[0]}
              required
              className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface text-sm outline-none focus:border-primary transition-colors"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-semibold text-on-surface mb-1.5">
                시작 시간 <span className="text-error">*</span>
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface text-sm outline-none focus:border-primary transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-on-surface mb-1.5">
                종료 시간 <span className="text-error">*</span>
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface text-sm outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-on-surface mb-1.5">
              장소 <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="예: 양양 서피비치, 제주 중문 색달해변"
              required
              className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface text-sm outline-none focus:border-primary transition-colors"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-on-surface mb-1.5">
              설명 <span className="text-on-surface-variant/40 font-normal">(선택)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 300))}
              placeholder="모임 목적, 준비물, 참고사항 등..."
              rows={3}
              className="w-full px-4 py-2.5 rounded-xl border border-outline-variant bg-surface text-sm outline-none focus:border-primary transition-colors resize-none"
            />
            <p className="text-xs text-on-surface-variant/40 text-right mt-1">{description.length}/300</p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-4 rounded-xl bg-primary hover:bg-primary/90 disabled:bg-surface-container text-on-primary disabled:text-on-surface-variant font-extrabold font-headline transition-all active:scale-[0.98] flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined">add_circle</span>
            {submitting ? "등록 중..." : "비정기 모임 등록하기"}
          </button>
        </form>
      </main>
    </div>
  );
}
