import type { FormEvent } from "react";
import { Icon } from "@/components/ui/Icon";
import type { AdminMemberDraft } from "@/lib/admin-members";

export type AdminMemberDraftErrors = Partial<Record<keyof AdminMemberDraft, string>>;

type AdminMemberEditFormProps = {
  readonly dirty: boolean;
  readonly draft: AdminMemberDraft;
  readonly errors: AdminMemberDraftErrors;
  readonly onCancel: () => void;
  readonly onChange: (draft: AdminMemberDraft) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  readonly saveError: string | null;
  readonly saving: boolean;
};

export function AdminMemberEditForm({
  dirty,
  draft,
  errors,
  onCancel,
  onChange,
  onSubmit,
  saveError,
  saving,
}: AdminMemberEditFormProps) {
  return (
    <form className="space-y-4" noValidate onSubmit={onSubmit}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-extrabold text-[var(--brand-text)]">회원 정보 편집</h3>
          <p className="brand-text-subtle mt-1 text-xs">변경사항은 저장하기 전까지 반영되지 않습니다.</p>
        </div>
        <span aria-live="polite" className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${dirty ? "brand-chip-preparing" : "brand-chip-success"}`}>
          {dirty ? "초안 있음" : "저장된 값"}
        </span>
      </div>

      {saveError ? (
        <div className="brand-alert-error rounded-2xl p-4" role="alert">
          <p className="font-bold">저장되지 않았습니다</p>
          <p className="mt-1 text-sm">{saveError}</p>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <div className="text-xs font-bold text-[var(--brand-text)]">
          <label className="mb-1.5 block" htmlFor="admin-member-role">회원 등급</label>
          <select
            aria-describedby={errors.role ? "admin-member-role-error" : undefined}
            aria-invalid={errors.role ? true : undefined}
            className={`min-h-11 w-full rounded-xl px-3 text-sm ${errors.role ? "brand-input-error" : "brand-input"}`}
            disabled={saving}
            id="admin-member-role"
            onChange={(event) => onChange({ ...draft, role: event.target.value })}
            value={draft.role}
          >
            <option value="MEMBER">일반 회원</option>
            <option value="SHOP_OWNER">샵 운영자</option>
            <option value="ADMIN">관리자</option>
            <option value="BANNED">차단</option>
          </select>
          {errors.role ? <span className="brand-form-error block" id="admin-member-role-error">{errors.role}</span> : null}
        </div>

        <div className="text-xs font-bold text-[var(--brand-text)]">
          <label className="mb-1.5 block" htmlFor="admin-member-type">회원 유형</label>
          <select
            aria-describedby={errors.memberType ? "admin-member-type-error" : undefined}
            aria-invalid={errors.memberType ? true : undefined}
            className={`min-h-11 w-full rounded-xl px-3 text-sm ${errors.memberType ? "brand-input-error" : "brand-input"}`}
            disabled={saving}
            id="admin-member-type"
            onChange={(event) => onChange({ ...draft, memberType: event.target.value })}
            value={draft.memberType}
          >
            <option value="REGULAR">정회원</option>
            <option value="COMPANION">동반인</option>
          </select>
          {errors.memberType ? <span className="brand-form-error block" id="admin-member-type-error">{errors.memberType}</span> : null}
        </div>
      </div>

      <div className="text-xs font-bold text-[var(--brand-text)]">
        <label className="mb-1.5 block" htmlFor="admin-member-phone">연락처</label>
        <input
          aria-describedby={errors.phoneNumber ? "admin-member-phone-error" : "admin-member-phone-help"}
          aria-invalid={errors.phoneNumber ? true : undefined}
          autoComplete="tel"
          className={`min-h-11 w-full rounded-xl px-3 text-sm ${errors.phoneNumber ? "brand-input-error" : "brand-input"}`}
          disabled={saving}
          id="admin-member-phone"
          inputMode="tel"
          onChange={(event) => onChange({ ...draft, phoneNumber: event.target.value })}
          placeholder="010-0000-0000"
          type="tel"
          value={draft.phoneNumber}
        />
        <span className="brand-text-subtle mt-1 block text-[11px]" id="admin-member-phone-help">비워 두면 연락처 없음으로 저장됩니다.</span>
        {errors.phoneNumber ? <span className="brand-form-error block" id="admin-member-phone-error">{errors.phoneNumber}</span> : null}
      </div>

      <div className="text-xs font-bold text-[var(--brand-text)]">
        <label className="mb-1.5 block" htmlFor="admin-member-penalty">패널티 횟수</label>
        <input
          aria-describedby={errors.penaltyCount ? "admin-member-penalty-error" : undefined}
          aria-invalid={errors.penaltyCount ? true : undefined}
          className={`min-h-11 w-full rounded-xl px-3 text-sm ${errors.penaltyCount ? "brand-input-error" : "brand-input"}`}
          disabled={saving}
          id="admin-member-penalty"
          inputMode="numeric"
          max="999"
          min="0"
          onChange={(event) => onChange({ ...draft, penaltyCount: event.target.value })}
          type="number"
          value={draft.penaltyCount}
        />
        {errors.penaltyCount ? <span className="brand-form-error block" id="admin-member-penalty-error">{errors.penaltyCount}</span> : null}
      </div>

      <div className="brand-panel-white sticky bottom-0 z-10 grid grid-cols-2 gap-2 rounded-2xl p-3 shadow-brand">
        <button className="brand-button-secondary min-h-11 rounded-xl px-3 text-sm font-bold" disabled={saving} onClick={onCancel} type="button">
          변경 취소
        </button>
        <button className="brand-button-primary inline-flex min-h-11 items-center justify-center gap-1 rounded-xl px-3 text-sm font-bold" disabled={saving || !dirty} type="submit">
          <Icon className={`text-[18px] ${saving ? "animate-spin" : ""}`} name={saving ? "progress_activity" : "save"} />
          {saving ? "저장 중" : "변경사항 저장"}
        </button>
      </div>
    </form>
  );
}
