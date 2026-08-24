"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { getTodayInSeoul } from "@/lib/date";
import { validateMeetingCreate, type MeetingCreateErrors, type MeetingCreateField } from "@/lib/meeting-create-form";
import { Icon } from "@/components/ui/Icon";

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
    <main aria-live="polite" className="mx-auto flex min-h-dvh w-full max-w-[430px] items-center justify-center px-4">
      <div className="brand-card-soft flex items-center gap-3 rounded-2xl px-5 py-4 text-sm font-bold">
        <Icon className="animate-spin" name="progress_activity" />
        로그인 상태를 확인하는 중입니다.
      </div>
    </main>
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
  const [submitError, setSubmitError] = useState("");
  const [fieldErrors, setFieldErrors] = useState<MeetingCreateErrors>({});
  const fieldRefs = useRef<Partial<Record<MeetingCreateField, HTMLInputElement | null>>>({});
  const initialValues = useMemo(() => ({ date: requestedDate, startTime: "", endTime: "", location: "고성 송지호 비치", description: "" }), [requestedDate]);
  const dirty = date !== initialValues.date || startTime !== initialValues.startTime || endTime !== initialValues.endTime || location !== initialValues.location || description !== initialValues.description;

  useEffect(() => {
    fetch("/api/auth/me")
      .then((response) => response.json())
      .then((data) => setUser(data?.kakaoId ? data : null))
      .catch(() => setUser(null));
  }, []);

  function updateField(field: MeetingCreateField, value: string) {
    if (field === "date") setDate(value);
    if (field === "startTime") setStartTime(value);
    if (field === "endTime") setEndTime(value);
    if (field === "location") setLocation(value);
    setFieldErrors((current) => field === "startTime" || field === "endTime"
      ? { ...current, startTime: undefined, endTime: undefined }
      : { ...current, [field]: undefined });
    setSubmitError("");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const errors = validateMeetingCreate({ date, startTime, endTime, location });
    setFieldErrors(errors);
    const firstInvalid = (Object.keys(errors) as MeetingCreateField[])[0];
    if (firstInvalid) {
      fieldRefs.current[firstInvalid]?.focus();
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    try {
      const response = await fetch("/api/meetings", {
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
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setSubmitError(typeof data.error === "string" ? data.error : "모임 등록에 실패했습니다. 입력 내용은 그대로 유지했습니다.");
        return;
      }
      const createdDate = typeof data.date === "string" ? data.date : date;
      router.push(`/?date=${encodeURIComponent(createdDate)}`);
    } catch {
      setSubmitError("네트워크 연결을 확인해 주세요. 입력 내용은 그대로 유지했습니다.");
    } finally {
      setSubmitting(false);
    }
  }

  if (user === undefined) return <CreateMeetingPageFallback />;

  if (!user) {
    return (
      <div className="min-h-dvh bg-brand-page">
        <CreateHeader />
        <main className="mx-auto flex min-h-dvh w-full max-w-[430px] items-center px-4 pb-12 pt-24 text-center">
          <section className="brand-card-soft w-full rounded-3xl p-6">
            <span className="brand-chip-soft mx-auto flex h-14 w-14 items-center justify-center rounded-2xl"><Icon className="text-[28px]" name="lock" /></span>
            <h2 className="mt-4 text-lg font-extrabold">로그인 후 모임을 만들 수 있어요</h2>
            <p className="brand-text-muted mt-2 text-sm leading-6">선택한 날짜를 유지한 채 카카오 로그인 화면으로 이동합니다.</p>
            <a className="brand-button-primary mt-5 inline-flex min-h-11 items-center justify-center rounded-2xl px-5 text-sm font-bold" href={`/api/auth/kakao?returnTo=${encodeURIComponent(createReturnTo)}`}>
              카카오로 로그인
            </a>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-brand-page pb-12">
      <CreateHeader />
      <main className="mx-auto w-full max-w-[430px] px-4 pb-12 pt-24">
        <section className="mb-5">
          <p className="brand-text-subtle text-xs font-bold">회원 모임</p>
          <h2 className="mt-1 font-headline text-2xl font-extrabold tracking-[-0.04em]">필요한 정보만 입력해 주세요</h2>
          <p className="brand-text-muted mt-2 text-sm leading-6">등록 후 선택한 날짜의 홈으로 돌아갑니다.</p>
        </section>

        <form className="brand-card-soft space-y-5 rounded-3xl p-5" noValidate onSubmit={handleSubmit}>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-extrabold">모임 정보</h3>
            {dirty ? <span className="brand-chip-soft rounded-full px-3 py-1 text-xs font-bold">작성 중</span> : null}
          </div>

          {submitError ? <div className="brand-alert-error rounded-2xl p-4 text-sm font-semibold" role="alert">{submitError}</div> : null}

          <FormField error={fieldErrors.date} id="meeting-date" label="날짜">
            <input aria-describedby={fieldErrors.date ? "meeting-date-error" : undefined} aria-invalid={Boolean(fieldErrors.date)} className="brand-input w-full rounded-xl px-4 py-2.5 text-sm" id="meeting-date" min={getTodayInSeoul()} onChange={(event) => updateField("date", event.target.value)} ref={(node) => { fieldRefs.current.date = node; }} type="date" value={date} />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField error={fieldErrors.startTime} id="meeting-start" label="시작 시간">
              <input aria-describedby={fieldErrors.startTime ? "meeting-start-error" : undefined} aria-invalid={Boolean(fieldErrors.startTime)} className="brand-input w-full rounded-xl px-3 py-2.5 text-sm" id="meeting-start" onChange={(event) => updateField("startTime", event.target.value)} ref={(node) => { fieldRefs.current.startTime = node; }} type="time" value={startTime} />
            </FormField>
            <FormField error={fieldErrors.endTime} id="meeting-end" label="종료 시간">
              <input aria-describedby={fieldErrors.endTime ? "meeting-end-error" : undefined} aria-invalid={Boolean(fieldErrors.endTime)} className="brand-input w-full rounded-xl px-3 py-2.5 text-sm" id="meeting-end" onChange={(event) => updateField("endTime", event.target.value)} ref={(node) => { fieldRefs.current.endTime = node; }} type="time" value={endTime} />
            </FormField>
          </div>

          <FormField error={fieldErrors.location} id="meeting-location" label="장소">
            <input aria-describedby={fieldErrors.location ? "meeting-location-error" : undefined} aria-invalid={Boolean(fieldErrors.location)} className="brand-input w-full rounded-xl px-4 py-2.5 text-sm" id="meeting-location" onChange={(event) => updateField("location", event.target.value)} placeholder="예: 고성 송지호 비치" ref={(node) => { fieldRefs.current.location = node; }} type="text" value={location} />
          </FormField>

          <div>
            <div className="flex items-center justify-between gap-3">
              <label className="text-sm font-semibold" htmlFor="meeting-description">설명 <span className="brand-text-subtle font-normal">선택</span></label>
              <span className="brand-text-subtle text-xs">{description.length}/300</span>
            </div>
            <textarea className="brand-input mt-1.5 w-full resize-none rounded-xl px-4 py-3 text-sm" id="meeting-description" onChange={(event) => { setDescription(event.target.value.slice(0, 300)); setSubmitError(""); }} placeholder="준비물이나 만날 위치를 알려주세요." rows={4} value={description} />
          </div>

          <button className="brand-button-primary flex w-full items-center justify-center gap-2 rounded-2xl py-4 font-headline font-extrabold disabled:cursor-wait disabled:opacity-60" disabled={submitting} type="submit">
            <Icon className={submitting ? "animate-spin" : ""} name={submitting ? "progress_activity" : "add_circle"} />
            {submitting ? "등록 중" : "비정기 모임 등록"}
          </button>
        </form>
      </main>
    </div>
  );
}

function CreateHeader() {
  return (
    <header className="brand-header-surface fixed inset-x-0 top-0 z-50">
      <div className="mx-auto flex h-16 w-full max-w-[430px] items-center gap-3 px-4">
        <Link aria-label="홈으로 돌아가기" className="brand-button-secondary flex h-11 w-11 items-center justify-center rounded-xl" href="/"><Icon name="arrow_back" /></Link>
        <h1 className="font-headline text-lg font-extrabold">비정기 모임 등록</h1>
      </div>
    </header>
  );
}

function FormField({ children, error, id, label }: { children: React.ReactNode; error?: string; id: string; label: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold" htmlFor={id}>{label} <span aria-hidden className="text-brand-error">*</span></label>
      {children}
      {error ? <p className="mt-1.5 text-xs font-semibold text-brand-danger-text" id={`${id}-error`}>{error}</p> : null}
    </div>
  );
}
