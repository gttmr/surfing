import { AdminSettingSectionHeader } from "@/components/admin/AdminSettingControls";
import { Icon } from "@/components/ui/Icon";
import type { SettingsInputErrors } from "@/lib/admin-pricing-settings";
import type { AdminSettingsFormData } from "@/lib/admin-page-data";

type SettingsChangeHandler = (key: keyof AdminSettingsFormData, value: string) => void;

type PolicySectionProps = {
  readonly dirty: boolean;
  readonly disabled: boolean;
  readonly draft: AdminSettingsFormData;
  readonly editing: boolean;
  readonly errors: SettingsInputErrors;
  readonly onChange: SettingsChangeHandler;
  readonly onToggleEditing: () => void;
  readonly snapshot: AdminSettingsFormData;
};

export function AdminCancellationPolicySection({
  dirty,
  disabled,
  draft,
  editing,
  errors,
  onChange,
  onToggleEditing,
  snapshot,
}: PolicySectionProps) {
  return (
    <section className="brand-admin-section overflow-hidden">
      <AdminSettingSectionHeader
        contentId="cancellation-settings-editor"
        disabled={disabled}
        dirty={dirty}
        editing={editing}
        onToggleEditing={onToggleEditing}
        roleLabel="취소하는 회원에게 표시"
        summary={`${snapshot.penaltyDays || "미입력"}일 이내 · ${snapshot.penaltyMessage || "안내 없음"}`}
        title="취소 안내"
      />
      {editing ? (
        <div className="space-y-4 px-4 py-5" id="cancellation-settings-editor">
          <label className="block" htmlFor="settings-penaltyDays">
            <span className="mb-1 block text-sm font-bold text-brand-text">패널티 기준 일수</span>
            <input
              aria-describedby={`settings-penaltyDays-description${errors.penaltyDays ? " settings-penaltyDays-error" : ""}`}
              aria-invalid={errors.penaltyDays ? "true" : undefined}
              className={`brand-input min-h-11 w-28 rounded-xl px-3 text-center text-sm outline-none ${errors.penaltyDays ? "brand-input-error" : ""}`}
              disabled={disabled}
              id="settings-penaltyDays"
              inputMode="numeric"
              max="30"
              min="0"
              onChange={(event) => onChange("penaltyDays", event.target.value)}
              required
              step="1"
              type="number"
              value={draft.penaltyDays}
            />
            <span className="brand-text-subtle mt-1 block text-xs" id="settings-penaltyDays-description">모임 날짜 기준 0일부터 30일까지 입력</span>
            {errors.penaltyDays ? <span className="brand-form-error block" id="settings-penaltyDays-error">{errors.penaltyDays}</span> : null}
          </label>

          <label className="block" htmlFor="settings-penaltyMessage">
            <span className="mb-1 block text-sm font-bold text-brand-text">취소 안내 문구</span>
            <textarea
              aria-describedby={`settings-penaltyMessage-description${errors.penaltyMessage ? " settings-penaltyMessage-error" : ""}`}
              aria-invalid={errors.penaltyMessage ? "true" : undefined}
              className={`brand-input w-full resize-none rounded-2xl px-4 py-3 text-sm outline-none ${errors.penaltyMessage ? "brand-input-error" : ""}`}
              disabled={disabled}
              id="settings-penaltyMessage"
              onChange={(event) => onChange("penaltyMessage", event.target.value)}
              placeholder="취소 시 회원에게 안내할 내용을 입력하세요"
              required
              rows={4}
              value={draft.penaltyMessage}
            />
            <span className="brand-text-subtle mt-1 flex justify-between gap-2 text-xs" id="settings-penaltyMessage-description"><span>패널티가 적용될 때 회원에게 표시</span><span>{draft.penaltyMessage.length}자</span></span>
            {errors.penaltyMessage ? <span className="brand-form-error block" id="settings-penaltyMessage-error">{errors.penaltyMessage}</span> : null}
          </label>

          <div aria-label="취소 안내 초안 미리보기" className="brand-alert-error rounded-2xl p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-brand-text"><Icon name="event_busy" /> 회원 화면 미리보기</div>
            <p className="brand-inline-danger mt-3 whitespace-pre-line rounded-xl p-3 text-sm">{draft.penaltyMessage || "안내 문구를 입력해 주세요."}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function AdminParticipantGuideSection({
  dirty,
  disabled,
  draft,
  editing,
  errors,
  onChange,
  onToggleEditing,
  snapshot,
}: PolicySectionProps) {
  return (
    <section className="brand-admin-section overflow-hidden">
      <AdminSettingSectionHeader
        contentId="participant-guide-editor"
        disabled={disabled}
        dirty={dirty}
        editing={editing}
        onToggleEditing={onToggleEditing}
        roleLabel="신청하는 회원에게 표시"
        summary={snapshot.participantOptionPricingGuide || "안내 없음"}
        title="참가 옵션 안내"
      />
      {editing ? (
        <div className="space-y-4 px-4 py-5" id="participant-guide-editor">
          <label className="block" htmlFor="settings-participantOptionPricingGuide">
            <span className="mb-1 block text-sm font-bold text-brand-text">참가 옵션 가격 안내 문구</span>
            <textarea
              aria-describedby={`settings-participantOptionPricingGuide-description${errors.participantOptionPricingGuide ? " settings-participantOptionPricingGuide-error" : ""}`}
              aria-invalid={errors.participantOptionPricingGuide ? "true" : undefined}
              className={`brand-input w-full resize-none rounded-2xl px-4 py-3 text-sm outline-none ${errors.participantOptionPricingGuide ? "brand-input-error" : ""}`}
              disabled={disabled}
              id="settings-participantOptionPricingGuide"
              onChange={(event) => onChange("participantOptionPricingGuide", event.target.value)}
              placeholder="신청 화면의 가격 안내를 입력하세요"
              required
              rows={4}
              value={draft.participantOptionPricingGuide}
            />
            <span className="brand-text-subtle mt-1 flex justify-between gap-2 text-xs" id="settings-participantOptionPricingGuide-description"><span>참가 신청 화면의 정보 버튼에서 표시</span><span>{draft.participantOptionPricingGuide.length}자</span></span>
            {errors.participantOptionPricingGuide ? <span className="brand-form-error block" id="settings-participantOptionPricingGuide-error">{errors.participantOptionPricingGuide}</span> : null}
          </label>
          <div aria-label="참가 옵션 안내 초안 미리보기" className="brand-highlight-panel rounded-2xl p-4">
            <div className="flex items-center gap-2 text-sm font-bold text-brand-text"><Icon name="info" /> 회원 화면 미리보기</div>
            <p className="mt-3 whitespace-pre-line text-sm">{draft.participantOptionPricingGuide || "안내 문구를 입력해 주세요."}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export type { SettingsChangeHandler };
