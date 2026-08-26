"use client";

import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { meetingResponseError } from "@/components/admin/admin-meeting-response";
import { Icon } from "@/components/ui/Icon";
import type { AdminMeetingListItem } from "@/lib/admin-page-data";
import { getTodayInSeoul } from "@/lib/date";
import {
  addDaysToDate,
  validateOvernightMeetingSpan,
  type OvernightMeetingGroupSummary,
} from "@/lib/meeting-group";
import { validateMeetingCreate, type MeetingCreateErrors, type MeetingCreateField } from "@/lib/meeting-create-form";

type CreateFormProps = {
  readonly initialDate: string;
  readonly initialType: string;
  readonly onCancel: () => void;
  readonly onCreated: (meeting: AdminMeetingListItem) => void;
};

type MeetingMode = "SINGLE" | "OVERNIGHT";

type CreatedMeeting = {
  id: number;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  meetingType: string;
  isOpen: boolean;
  createdByKakaoId: string | null;
};

type CreatedOvernightGroup = {
  group: OvernightMeetingGroupSummary;
  meetings: CreatedMeeting[];
};

function isCreatedMeeting(value: unknown): value is CreatedMeeting {
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

function isCreatedOvernightGroup(value: unknown): value is CreatedOvernightGroup {
  if (typeof value !== "object" || value === null || !("group" in value) || !("meetings" in value)) return false;
  if (!Array.isArray(value.meetings) || value.meetings.length !== 2 || !value.meetings.every(isCreatedMeeting)) return false;
  const group = value.group;
  return typeof group === "object" && group !== null
    && "id" in group && typeof group.id === "number"
    && "kind" in group && group.kind === "OVERNIGHT"
    && "regularBaseFee" in group && typeof group.regularBaseFee === "number"
    && "companionBaseFee" in group && typeof group.companionBaseFee === "number"
    && "lodgingFee" in group && typeof group.lodgingFee === "number"
    && "days" in group && Array.isArray(group.days) && group.days.length === 2;
}

function won(value: string): number {
  return /^\d+$/.test(value) ? Number(value) : Number.NaN;
}

function createdListItem(meeting: CreatedMeeting, overnightGroup: OvernightMeetingGroupSummary | null): AdminMeetingListItem {
  return {
    ...meeting,
    overnightGroup,
    approvedCount: 0,
    workflowStage: "RECRUITING",
    workflowLabel: "모집 중",
    nextAction: "참가 현황 보기",
  };
}

export function AdminMeetingCreateForm({ initialDate, initialType, onCancel, onCreated }: CreateFormProps) {
  const [mode, setMode] = useState<MeetingMode>("SINGLE");
  const [date, setDate] = useState(initialDate);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [meetingType, setMeetingType] = useState(initialType);
  const [description, setDescription] = useState("");
  const [regularBaseFee, setRegularBaseFee] = useState("0");
  const [companionBaseFee, setCompanionBaseFee] = useState("0");
  const [lodgingFee, setLodgingFee] = useState("0");
  const [errors, setErrors] = useState<MeetingCreateErrors>({});
  const [baseFeeErrors, setBaseFeeErrors] = useState<{ regular?: string; companion?: string; lodging?: string }>({});
  const [submitError, setSubmitError] = useState("");
  const [creating, setCreating] = useState(false);
  const fieldRefs = useRef<Partial<Record<MeetingCreateField, HTMLInputElement | null>>>({});
  const secondDate = date ? addDaysToDate(date, 1) : "";

  function selectMode(nextMode: MeetingMode) {
    setMode(nextMode);
    setErrors({});
    setBaseFeeErrors({});
    setSubmitError("");
  }

  function updateDay1Field(field: MeetingCreateField, value: string) {
    if (field === "date") setDate(value);
    if (field === "startTime") setStartTime(value);
    if (field === "endTime") setEndTime(value);
    if (field === "location") setLocation(value);
    setErrors((current) => field === "startTime" || field === "endTime"
      ? { ...current, startTime: undefined, endTime: undefined }
      : { ...current, [field]: undefined });
    setSubmitError("");
  }

  function validateFields() {
    const fields = { date, startTime, endTime, location };
    const nextErrors = mode === "OVERNIGHT"
      ? validateOvernightMeetingSpan(fields)
      : validateMeetingCreate(fields);
    setErrors(nextErrors);
    const nextBaseErrors = mode === "OVERNIGHT" ? {
      regular: Number.isSafeInteger(won(regularBaseFee)) && won(regularBaseFee) >= 0 ? undefined : "0원 이상의 정수로 입력해 주세요.",
      companion: Number.isSafeInteger(won(companionBaseFee)) && won(companionBaseFee) >= 0 ? undefined : "0원 이상의 정수로 입력해 주세요.",
      lodging: Number.isSafeInteger(won(lodgingFee)) && won(lodgingFee) >= 0 ? undefined : "0원 이상의 정수로 입력해 주세요.",
    } : {};
    setBaseFeeErrors(nextBaseErrors);
    const firstInvalid = (["date", "startTime", "endTime", "location"] as const).find((field) => nextErrors[field]);
    if (firstInvalid) fieldRefs.current[firstInvalid]?.focus();
    return Object.keys(nextErrors).length === 0
      && !nextBaseErrors.regular
      && !nextBaseErrors.companion
      && !nextBaseErrors.lodging;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateFields()) return;

    setCreating(true);
    setSubmitError("");
    try {
      const response = await fetch(mode === "OVERNIGHT" ? "/api/admin/meeting-groups" : "/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(mode === "OVERNIGHT" ? {
          meetingType,
          regularBaseFee: won(regularBaseFee),
          companionBaseFee: won(companionBaseFee),
          lodgingFee: won(lodgingFee),
          startDate: date,
          startTime,
          endTime,
          location: location.trim(),
          description: description.trim() || null,
        } : {
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
      if (mode === "OVERNIGHT" && isCreatedOvernightGroup(value)) {
        const firstMeeting = [...value.meetings].sort((left, right) => left.date.localeCompare(right.date))[0];
        onCreated(createdListItem(firstMeeting, value.group));
        return;
      }
      if (mode === "SINGLE" && isCreatedMeeting(value)) {
        onCreated(createdListItem(value, null));
        return;
      }
      setSubmitError("생성된 모임 정보를 읽지 못했습니다. 목록에서 다시 확인해 주세요.");
    } catch {
      setSubmitError("네트워크 연결을 확인해 주세요. 입력 내용은 그대로 유지했습니다.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <section className="brand-admin-section overflow-hidden">
      <div className="brand-admin-section-header flex items-start justify-between gap-3 px-5 py-4">
        <div>
          <p className="brand-text-subtle text-xs font-bold">CREATE MEETING</p>
          <h2 className="mt-1 text-lg font-extrabold text-brand-text">새 모임 만들기</h2>
          <p className="brand-text-subtle mt-1 break-keep text-xs">당일 모임과 1박2일 일정을 구분해 등록합니다.</p>
        </div>
        <button aria-label="모임 만들기 닫기" className="brand-button-secondary flex h-11 w-11 items-center justify-center rounded-full" onClick={onCancel} type="button">
          <Icon className="text-[20px]" name="close" />
        </button>
      </div>
      <form className="space-y-4 px-5 py-5" noValidate onSubmit={handleSubmit}>
        <div aria-label="일정 기간" className="grid grid-cols-2 gap-1 rounded-2xl bg-brand-surface p-1" role="group">
          <button aria-pressed={mode === "SINGLE"} className={`rounded-xl px-3 py-2.5 text-sm font-bold ${mode === "SINGLE" ? "brand-filter-tab-active" : "brand-text-subtle"}`} onClick={() => selectMode("SINGLE")} type="button">당일</button>
          <button aria-pressed={mode === "OVERNIGHT"} className={`rounded-xl px-3 py-2.5 text-sm font-bold ${mode === "OVERNIGHT" ? "brand-filter-tab-active" : "brand-text-subtle"}`} onClick={() => selectMode("OVERNIGHT")} type="button">1박 2일</button>
        </div>

        {submitError ? <div className="brand-alert-error rounded-2xl p-4 text-sm font-semibold" role="alert">{submitError}</div> : null}

        {mode === "OVERNIGHT" ? (
          <>
            <OvernightFields
              date={date}
              description={description}
              endTime={endTime}
              errors={errors}
              location={location}
              meetingType={meetingType}
              onDescription={setDescription}
              onField={updateDay1Field}
              onFieldRef={(field, node) => { fieldRefs.current[field] = node; }}
              onMeetingType={setMeetingType}
              secondDate={secondDate}
              startTime={startTime}
            />
            <div>
              <p className="text-base font-extrabold text-brand-text">전체 참가비</p>
              <p className="brand-text-subtle mt-1 break-keep text-xs">기본 참가비는 이틀을 합쳐 한 번만 청구됩니다.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <WonField error={baseFeeErrors.regular} id="admin-overnight-regular-fee" label="회원 기본 참가비" onChange={(value) => { setRegularBaseFee(value); setBaseFeeErrors((current) => ({ ...current, regular: undefined })); }} value={regularBaseFee} />
              <WonField error={baseFeeErrors.companion} id="admin-overnight-companion-fee" label="동반인 기본 참가비" onChange={(value) => { setCompanionBaseFee(value); setBaseFeeErrors((current) => ({ ...current, companion: undefined })); }} value={companionBaseFee} />
            </div>
            <WonField error={baseFeeErrors.lodging} id="admin-overnight-lodging-fee" label="1인 숙박비" onChange={(value) => { setLodgingFee(value); setBaseFeeErrors((current) => ({ ...current, lodging: undefined })); }} value={lodgingFee} />
            <p className="brand-text-subtle -mt-2 break-keep text-xs">숙소를 선택한 정회원과 동반인에게 각각 한 번 청구됩니다.</p>
            <div className="brand-panel-soft rounded-2xl px-4 py-3 text-xs">
              <p className="font-extrabold text-brand-text">등록되는 일정</p>
              <p className="brand-text-muted mt-1 break-keep">{date || "시작일"} {startTime || "--:--"} 시작 · {secondDate || "종료일"} {endTime || "--:--"} 종료</p>
              <p className="brand-text-subtle mt-1 break-keep">참가 신청과 청구는 한 번, 실제 이용과 주문은 날짜별로 관리합니다.</p>
            </div>
          </>
        ) : (
          <DayOneFields
            date={date}
            description={description}
            endTime={endTime}
            errors={errors}
            location={location}
            meetingType={meetingType}
            onDescription={setDescription}
            onField={updateDay1Field}
            onFieldRef={(field, node) => { fieldRefs.current[field] = node; }}
            onMeetingType={setMeetingType}
            startTime={startTime}
          />
        )}

        <button className="brand-button-primary flex w-full items-center justify-center gap-2 rounded-2xl py-3 text-sm font-extrabold disabled:cursor-wait disabled:opacity-60" disabled={creating} type="submit">
          <Icon className={creating ? "animate-spin" : ""} name={creating ? "progress_activity" : "add_circle"} />
          {creating ? "생성 중" : mode === "OVERNIGHT" ? "1박 2일 모임 생성" : "모임 생성"}
        </button>
      </form>
    </section>
  );
}

type OvernightFieldsProps = DayOneFieldsProps & {
  readonly secondDate: string;
};

function OvernightFields({ date, startTime, endTime, location, meetingType, description, errors, onField, onFieldRef, onMeetingType, onDescription, secondDate }: OvernightFieldsProps) {
  return (
    <>
      <div>
        <p className="text-base font-extrabold text-brand-text">전체 일정</p>
        <p className="brand-text-subtle mt-1 break-keep text-xs">출발과 귀가 시각만 입력하면 이틀 일정으로 자동 연결됩니다.</p>
      </div>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <FormField error={errors.date} id="admin-meeting-date" label="시작일">
            <input aria-invalid={Boolean(errors.date)} className={`brand-input w-full rounded-xl px-3 py-2.5 text-sm ${errors.date ? "brand-input-error" : ""}`} id="admin-meeting-date" min={getTodayInSeoul()} onChange={(event) => onField("date", event.target.value)} ref={(node) => onFieldRef("date", node)} type="date" value={date} />
          </FormField>
          <FormField error={errors.startTime} id="admin-meeting-start" label="시작 시간">
            <input aria-invalid={Boolean(errors.startTime)} className={`brand-input w-full rounded-xl px-3 py-2.5 text-sm ${errors.startTime ? "brand-input-error" : ""}`} id="admin-meeting-start" onChange={(event) => onField("startTime", event.target.value)} ref={(node) => onFieldRef("startTime", node)} type="time" value={startTime} />
          </FormField>
        </div>
        <div aria-hidden className="flex items-center gap-2 px-1">
          <span className="h-px flex-1 bg-brand-divider" />
          <Icon className="brand-text-subtle text-[18px]" name="arrow_downward" />
          <span className="h-px flex-1 bg-brand-divider" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="mb-1.5 block text-sm font-semibold">종료일 <span aria-hidden className="text-brand-error">*</span></span>
            <output aria-label="종료일" className="brand-panel-soft flex min-h-11 w-full items-center rounded-xl px-3 py-2.5 text-sm font-bold text-brand-text">
              {secondDate || "시작일 선택"}
            </output>
            <p className="brand-text-subtle mt-1 text-[11px]">시작일의 다음 날</p>
          </div>
          <FormField error={errors.endTime} id="admin-meeting-end" label="종료 시간">
            <input aria-invalid={Boolean(errors.endTime)} className={`brand-input w-full rounded-xl px-3 py-2.5 text-sm ${errors.endTime ? "brand-input-error" : ""}`} id="admin-meeting-end" onChange={(event) => onField("endTime", event.target.value)} ref={(node) => onFieldRef("endTime", node)} type="time" value={endTime} />
          </FormField>
        </div>
      </div>
      <MeetingTypeField onChange={onMeetingType} value={meetingType} />
      <FormField error={errors.location} id="admin-meeting-location" label="공통 장소">
        <input aria-invalid={Boolean(errors.location)} className={`brand-input w-full rounded-xl px-4 py-2.5 text-sm ${errors.location ? "brand-input-error" : ""}`} id="admin-meeting-location" onChange={(event) => onField("location", event.target.value)} placeholder="예: 고성 송지호 비치" ref={(node) => onFieldRef("location", node)} type="text" value={location} />
      </FormField>
      <DescriptionField id="admin-meeting-description" onChange={onDescription} value={description} />
    </>
  );
}

type DayOneFieldsProps = {
  readonly date: string;
  readonly startTime: string;
  readonly endTime: string;
  readonly location: string;
  readonly meetingType: string;
  readonly description: string;
  readonly errors: MeetingCreateErrors;
  readonly onField: (field: MeetingCreateField, value: string) => void;
  readonly onFieldRef: (field: MeetingCreateField, node: HTMLInputElement | null) => void;
  readonly onMeetingType: (value: string) => void;
  readonly onDescription: (value: string) => void;
};

function DayOneFields({ date, startTime, endTime, location, meetingType, description, errors, onField, onFieldRef, onMeetingType, onDescription }: DayOneFieldsProps) {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <FormField error={errors.date} id="admin-meeting-date" label="날짜">
          <input aria-invalid={Boolean(errors.date)} className={`brand-input w-full rounded-xl px-3 py-2.5 text-sm ${errors.date ? "brand-input-error" : ""}`} id="admin-meeting-date" min={getTodayInSeoul()} onChange={(event) => onField("date", event.target.value)} ref={(node) => onFieldRef("date", node)} type="date" value={date} />
        </FormField>
        <MeetingTypeField onChange={onMeetingType} value={meetingType} />
        <FormField error={errors.startTime} id="admin-meeting-start" label="시작 시간">
          <input aria-invalid={Boolean(errors.startTime)} className={`brand-input w-full rounded-xl px-3 py-2.5 text-sm ${errors.startTime ? "brand-input-error" : ""}`} id="admin-meeting-start" onChange={(event) => onField("startTime", event.target.value)} ref={(node) => onFieldRef("startTime", node)} type="time" value={startTime} />
        </FormField>
        <FormField error={errors.endTime} id="admin-meeting-end" label="종료 시간">
          <input aria-invalid={Boolean(errors.endTime)} className={`brand-input w-full rounded-xl px-3 py-2.5 text-sm ${errors.endTime ? "brand-input-error" : ""}`} id="admin-meeting-end" onChange={(event) => onField("endTime", event.target.value)} ref={(node) => onFieldRef("endTime", node)} type="time" value={endTime} />
        </FormField>
      </div>
      <FormField error={errors.location} id="admin-meeting-location" label="장소">
        <input aria-invalid={Boolean(errors.location)} className={`brand-input w-full rounded-xl px-4 py-2.5 text-sm ${errors.location ? "brand-input-error" : ""}`} id="admin-meeting-location" onChange={(event) => onField("location", event.target.value)} placeholder="예: 고성 송지호 비치" ref={(node) => onFieldRef("location", node)} type="text" value={location} />
      </FormField>
      <DescriptionField id="admin-meeting-description" onChange={onDescription} value={description} />
    </>
  );
}

function MeetingTypeField({ onChange, value }: { readonly onChange: (value: string) => void; readonly value: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold" htmlFor="admin-meeting-type">모임 유형</label>
      <select className="brand-input w-full rounded-xl px-3 py-2.5 text-sm" id="admin-meeting-type" onChange={(event) => onChange(event.target.value)} value={value}>
        <option value="정기">정기</option>
        <option value="비정기">비정기</option>
      </select>
    </div>
  );
}

function DescriptionField({ id, onChange, value }: { readonly id: string; readonly onChange: (value: string) => void; readonly value: string }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label className="text-sm font-semibold" htmlFor={id}>설명 <span className="brand-text-subtle font-normal">선택</span></label>
        <span className="brand-text-subtle text-xs">{value.length}/300</span>
      </div>
      <textarea className="brand-input mt-1.5 w-full resize-none rounded-xl px-4 py-3 text-sm" id={id} onChange={(event) => onChange(event.target.value.slice(0, 300))} placeholder="준비물이나 운영 메모를 입력하세요." rows={3} value={value} />
    </div>
  );
}

function WonField({ error, id, label, onChange, value }: { readonly error?: string; readonly id: string; readonly label: string; readonly onChange: (value: string) => void; readonly value: string }) {
  return (
    <FormField error={error} id={id} label={label}>
      <div className="relative">
        <input className={`brand-input w-full rounded-xl px-3 py-2.5 pr-8 text-right text-sm ${error ? "brand-input-error" : ""}`} id={id} inputMode="numeric" min="0" onChange={(event) => onChange(event.target.value.replace(/\D/g, ""))} pattern="[0-9]*" type="text" value={value} />
        <span className="brand-text-subtle pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs">원</span>
      </div>
    </FormField>
  );
}

function FormField({ children, error, id, label }: { readonly children: ReactNode; readonly error?: string; readonly id: string; readonly label: string }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold" htmlFor={id}>{label} <span aria-hidden className="text-brand-error">*</span></label>
      {children}
      {error ? <p className="brand-form-error font-semibold" id={`${id}-error`}>{error}</p> : null}
    </div>
  );
}
