"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { meetingResponseError } from "@/components/admin/admin-meeting-response";
import { Icon } from "@/components/ui/Icon";
import type { AdminMeetingListItem } from "@/lib/admin-page-data";
import { getTodayInSeoul } from "@/lib/date";
import { validateMeetingCreate, type MeetingCreateErrors, type MeetingCreateField } from "@/lib/meeting-create-form";

type CreateFormProps = {
  readonly initialDate: string;
  readonly initialType: string;
  readonly onCancel: () => void;
  readonly onCreated: (meeting: AdminMeetingListItem) => void;
};

function isCreatedMeeting(value: unknown): value is Omit<AdminMeetingListItem, "approvedCount"> {
  return typeof value === "object" && value !== null
    && "id" in value && typeof value.id === "number"
    && "date" in value && typeof value.date === "string"
    && "startTime" in value && typeof value.startTime === "string"
    && "endTime" in value && typeof value.endTime === "string"
    && "location" in value && typeof value.location === "string"
    && "meetingType" in value && typeof value.meetingType === "string"
    && "isOpen" in value && typeof value.isOpen === "boolean"
    && "createdByKakaoId" in value
    && (typeof value.createdByKakaoId === "string" || value.createdByKakaoId === null);
}

export function AdminMeetingCreateForm({ initialDate, initialType, onCancel, onCreated }: CreateFormProps) {
  const [date, setDate] = useState(initialDate);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [meetingType, setMeetingType] = useState(initialType);
  const [description, setDescription] = useState("");
  const [errors, setErrors] = useState<MeetingCreateErrors>({});
  const [submitError, setSubmitError] = useState("");
  const [creating, setCreating] = useState(false);
  const fieldRefs = useRef<Partial<Record<MeetingCreateField, HTMLInputElement | null>>>({});

  function updateField(field: MeetingCreateField, value: string) {
    switch (field) {
      case "date": setDate(value); break;
      case "startTime": setStartTime(value); break;
      case "endTime": setEndTime(value); break;
      case "location": setLocation(value); break;
      default: {
        const exhaustive: never = field;
        return exhaustive;
      }
    }
    setErrors((current) => field === "startTime" || field === "endTime"
      ? { ...current, startTime: undefined, endTime: undefined }
      : { ...current, [field]: undefined });
    setSubmitError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validateMeetingCreate({ date, startTime, endTime, location });
    setErrors(nextErrors);
    const fieldOrder = ["date", "startTime", "endTime", "location"] as const satisfies readonly MeetingCreateField[];
    const firstInvalid = fieldOrder.find((field) => nextErrors[field]);
    if (firstInvalid) {
      fieldRefs.current[firstInvalid]?.focus();
      return;
    }

    setCreating(true);
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
          meetingType,
          description: description.trim() || null,
        }),
      });
      if (!response.ok) {
        setSubmitError(await meetingResponseError(response, "모임을 만들지 못했습니다. 입력 내용은 그대로 유지했습니다."));
        return;
      }
      const value: unknown = await response.json();
      if (!isCreatedMeeting(value)) {
        setSubmitError("생성된 모임 정보를 읽지 못했습니다. 목록에서 다시 확인해 주세요.");
        return;
      }
      onCreated({ ...value, approvedCount: 0 });
    } catch (error) {
      setSubmitError(error instanceof Error
        ? "네트워크 연결을 확인해 주세요. 입력 내용은 그대로 유지했습니다."
        : "모임을 만들지 못했습니다. 입력 내용은 그대로 유지했습니다.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="brand-admin-section overflow-hidden">
      <div className="brand-admin-section-header flex items-start justify-between gap-3 px-5 py-4">
        <div>
          <p className="brand-text-subtle text-xs font-bold">CREATE MEETING</p>
          <h2 className="mt-1 text-lg font-extrabold text-[var(--brand-text)]">새 모임 만들기</h2>
          <p className="brand-text-subtle mt-1 text-xs">필수 일정부터 입력하고 등록 전에 바로 확인합니다.</p>
        </div>
        <button className="brand-button-secondary flex h-11 w-11 items-center justify-center rounded-full" onClick={onCancel} type="button" aria-label="모임 만들기 닫기">
          <Icon className="text-[20px]" name="close" />
        </button>
      </div>
      <form className="space-y-4 px-5 py-5" noValidate onSubmit={handleSubmit}>
        {submitError ? <div className="brand-alert-error rounded-2xl p-4 text-sm font-semibold" role="alert">{submitError}</div> : null}
        <div className="grid grid-cols-2 gap-3">
          <FormField error={errors.date} id="admin-meeting-date" label="날짜">
            <input aria-describedby={errors.date ? "admin-meeting-date-error" : undefined} aria-invalid={Boolean(errors.date)} className={`brand-input w-full rounded-xl px-3 py-2.5 text-sm ${errors.date ? "brand-input-error" : ""}`} id="admin-meeting-date" min={getTodayInSeoul()} onChange={(event) => updateField("date", event.target.value)} ref={(node) => { fieldRefs.current.date = node; }} type="date" value={date} />
          </FormField>
          <div>
            <label className="mb-1.5 block text-sm font-semibold" htmlFor="admin-meeting-type">모임 유형</label>
            <select className="brand-input w-full rounded-xl px-3 py-2.5 text-sm" id="admin-meeting-type" onChange={(event) => { setMeetingType(event.target.value); setSubmitError(""); }} value={meetingType}>
              <option value="정기">정기</option>
              <option value="비정기">비정기</option>
            </select>
          </div>
          <FormField error={errors.startTime} id="admin-meeting-start" label="시작 시간">
            <input aria-describedby={errors.startTime ? "admin-meeting-start-error" : undefined} aria-invalid={Boolean(errors.startTime)} className={`brand-input w-full rounded-xl px-3 py-2.5 text-sm ${errors.startTime ? "brand-input-error" : ""}`} id="admin-meeting-start" onChange={(event) => updateField("startTime", event.target.value)} ref={(node) => { fieldRefs.current.startTime = node; }} type="time" value={startTime} />
          </FormField>
          <FormField error={errors.endTime} id="admin-meeting-end" label="종료 시간">
            <input aria-describedby={errors.endTime ? "admin-meeting-end-error" : undefined} aria-invalid={Boolean(errors.endTime)} className={`brand-input w-full rounded-xl px-3 py-2.5 text-sm ${errors.endTime ? "brand-input-error" : ""}`} id="admin-meeting-end" onChange={(event) => updateField("endTime", event.target.value)} ref={(node) => { fieldRefs.current.endTime = node; }} type="time" value={endTime} />
          </FormField>
        </div>
        <FormField error={errors.location} id="admin-meeting-location" label="장소">
          <input aria-describedby={errors.location ? "admin-meeting-location-error" : undefined} aria-invalid={Boolean(errors.location)} className={`brand-input w-full rounded-xl px-4 py-2.5 text-sm ${errors.location ? "brand-input-error" : ""}`} id="admin-meeting-location" onChange={(event) => updateField("location", event.target.value)} placeholder="예: 고성 송지호 비치" ref={(node) => { fieldRefs.current.location = node; }} type="text" value={location} />
        </FormField>
        <div>
          <div className="flex items-center justify-between gap-3">
            <label className="text-sm font-semibold" htmlFor="admin-meeting-description">설명 <span className="brand-text-subtle font-normal">선택</span></label>
            <span className="brand-text-subtle text-xs">{description.length}/300</span>
          </div>
          <textarea className="brand-input mt-1.5 w-full resize-none rounded-xl px-4 py-3 text-sm" id="admin-meeting-description" onChange={(event) => { setDescription(event.target.value.slice(0, 300)); setSubmitError(""); }} placeholder="준비물이나 운영 메모를 입력하세요." rows={3} value={description} />
        </div>
        <button className="brand-button-primary flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-extrabold disabled:cursor-wait disabled:opacity-60" disabled={creating} type="submit">
          <Icon className={creating ? "animate-spin" : ""} name={creating ? "progress_activity" : "add_circle"} />
          {creating ? "생성 중" : "모임 생성"}
        </button>
      </form>
    </section>
  );
}

function FormField({ children, error, id, label }: { readonly children: ReactNode; readonly error?: string; readonly id: string; readonly label: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold" htmlFor={id}>{label} <span aria-hidden className="text-[var(--brand-error)]">*</span></label>
      {children}
      {error ? <p className="brand-form-error font-semibold" id={`${id}-error`}>{error}</p> : null}
    </div>
  );
}
