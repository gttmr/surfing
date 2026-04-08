"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getTodayInSeoul } from "@/lib/date";

interface SessionUser {
  kakaoId: string;
  nickname: string;
}

export default function CreateMeetingPage() {
  return (
    <Suspense fallback={<CreateMeetingPageFallback />}>
      <CreateMeetingPageContent />
    </Suspense>
  );
}

function CreateMeetingPageFallback() {
  return (
    <div className="min-h-screen bg-[var(--brand-page)] flex items-center justify-center">
      <div className="brand-text-muted text-sm">불러오는 중...</div>
    </div>
  );
}

function CreateMeetingPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedDate = searchParams.get("date") ?? "";
  const createReturnTo = requestedDate ? `/meeting/create?date=${encodeURIComponent(requestedDate)}` : "/meeting/create";
  const [user, setUser] = useState<SessionUser | null | undefined>(undefined);

  const [date, setDate] = useState(requestedDate);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("고성 송지호 비치");
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
        router.push(`/?date=${encodeURIComponent(meeting.date)}`);
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

  if (user === undefined) return <CreateMeetingPageFallback />;

  if (!user) {
    return (
      <div className="min-h-screen bg-[var(--brand-page)]">
        <header className="brand-header-surface fixed top-0 z-50 flex h-16 w-full items-center gap-4 px-6 py-2 backdrop-blur-xl">
          <Link href="/" className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-surface)] transition-colors hover:bg-[var(--brand-surface-hover)]">
            <span className="material-symbols-outlined text-[var(--brand-text-subtle)]">arrow_back</span>
          </Link>
          <h1 className="font-headline text-lg font-bold">비정기 모임 등록</h1>
        </header>
        <main className="mx-auto max-w-md px-6 py-12 pt-24 text-center">
          <div className="mb-4 text-5xl">🔒</div>
          <p className="brand-text-muted mb-6 font-medium">로그인이 필요합니다</p>
          <Link
            href={`/api/auth/kakao?returnTo=${encodeURIComponent(createReturnTo)}`}
            className="brand-button-primary inline-flex items-center gap-2 rounded-xl px-6 py-3 font-bold"
          >
            카카오로 로그인
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--brand-page)] pb-24">
      <header className="brand-header-surface fixed top-0 z-50 flex h-16 w-full items-center gap-4 px-6 py-2 backdrop-blur-xl">
        <Link href="/" className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--brand-surface)] transition-colors hover:bg-[var(--brand-surface-hover)]">
          <span className="material-symbols-outlined text-[var(--brand-text-subtle)]">arrow_back</span>
        </Link>
        <div>
          <h1 className="font-headline text-lg font-bold leading-tight">비정기 모임 등록</h1>
          <p className="brand-text-subtle text-xs">회원이 직접 모임을 만들 수 있습니다</p>
        </div>
      </header>

      <main className="mx-auto max-w-md px-6 py-6 pt-20">
        <div className="brand-alert-info mb-6 rounded-xl p-4 text-sm">
          비정기 모임은 회원 누구나 등록할 수 있습니다. 등록 후 다른 회원들이 참가 신청을 할 수 있습니다.
        </div>

        <form onSubmit={handleSubmit} className="brand-card-soft space-y-5 rounded-xl p-5">
          <h2 className="font-headline text-base font-bold text-[var(--brand-text)]">모임 정보</h2>

          {error && (
            <div className="brand-alert-error rounded-xl p-3 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-[var(--brand-text)]">
              날짜 <span className="text-[var(--brand-error)]">*</span>
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={getTodayInSeoul()}
              required
              className="brand-input w-full rounded-xl px-4 py-2.5 text-sm outline-none"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[var(--brand-text)]">
                시작 시간 <span className="text-[var(--brand-error)]">*</span>
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="brand-input w-full rounded-xl px-4 py-2.5 text-sm outline-none"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-[var(--brand-text)]">
                종료 시간 <span className="text-[var(--brand-error)]">*</span>
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                required
                className="brand-input w-full rounded-xl px-4 py-2.5 text-sm outline-none"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-[var(--brand-text)]">
              장소 <span className="text-[var(--brand-error)]">*</span>
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="예: 고성 송지호 비치, 제주 중문 색달해변"
              required
              className="brand-input w-full rounded-xl px-4 py-2.5 text-sm outline-none"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-semibold text-[var(--brand-text)]">
              설명 <span className="brand-text-subtle font-normal">(선택)</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value.slice(0, 300))}
              placeholder="모임 목적, 준비물, 참고사항 등..."
              rows={3}
              className="brand-input w-full resize-none rounded-xl px-4 py-2.5 text-sm outline-none"
            />
            <p className="brand-text-subtle mt-1 text-right text-xs">{description.length}/300</p>
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="brand-button-primary flex w-full items-center justify-center gap-2 rounded-xl py-4 font-headline font-extrabold transition-all active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="material-symbols-outlined text-base">add_circle</span>
            {submitting ? "등록 중..." : "비정기 모임 등록하기"}
          </button>
        </form>
      </main>
    </div>
  );
}
