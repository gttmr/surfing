import type { FormEvent } from "react";

export type NoticeDraft = {
  readonly title: string;
  readonly body: string;
  readonly isPinned: boolean;
};

export type NoticeFieldErrors = {
  readonly title?: string;
  readonly body?: string;
};

type AdminNoticeEditorProps = {
  readonly draft: NoticeDraft;
  readonly errors: NoticeFieldErrors;
  readonly mode: "create" | "edit";
  readonly saving: boolean;
  readonly submitError: string;
  readonly onCancel: () => void;
  readonly onChange: (draft: NoticeDraft) => void;
  readonly onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function AdminNoticeEditor({
  draft,
  errors,
  mode,
  saving,
  submitError,
  onCancel,
  onChange,
  onSubmit,
}: AdminNoticeEditorProps) {
  const editing = mode === "edit";

  return (
    <section aria-labelledby="notice-editor-title" className="brand-admin-section overflow-hidden">
      <div className="brand-admin-section-header px-5 py-4">
        <p className="brand-text-subtle text-xs font-semibold">{editing ? "EDIT NOTICE" : "NEW NOTICE"}</p>
        <h2 className="mt-1 text-lg font-extrabold text-[var(--brand-text)]" id="notice-editor-title">
          {editing ? "공지 수정" : "새 공지 작성"}
        </h2>
        <p className="brand-text-subtle mt-1 text-xs">내용을 확인한 뒤 저장하면 알림센터에 바로 반영됩니다.</p>
      </div>

      <form className="space-y-5 px-5 py-5" noValidate onSubmit={onSubmit}>
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-[var(--brand-text)]" htmlFor="notice-title">공지 제목</label>
          <input
            aria-describedby={errors.title ? "notice-title-error" : undefined}
            aria-invalid={Boolean(errors.title)}
            autoFocus
            className={`brand-input w-full rounded-2xl px-4 py-3 text-sm outline-none ${errors.title ? "brand-input-error" : ""}`}
            id="notice-title"
            maxLength={80}
            onChange={(event) => onChange({ ...draft, title: event.target.value })}
            placeholder="예: 이번 주 송지호 모임 안내"
            value={draft.title}
          />
          {errors.title ? <p className="brand-form-error mt-1.5" id="notice-title-error">{errors.title}</p> : null}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <label className="text-sm font-semibold text-[var(--brand-text)]" htmlFor="notice-body">공지 내용</label>
            <span className="brand-text-subtle text-xs">{draft.body.length}자</span>
          </div>
          <textarea
            aria-describedby={errors.body ? "notice-body-error" : undefined}
            aria-invalid={Boolean(errors.body)}
            className={`brand-input min-h-40 w-full resize-y rounded-2xl px-4 py-3 text-sm leading-6 outline-none ${errors.body ? "brand-input-error" : ""}`}
            id="notice-body"
            maxLength={2000}
            onChange={(event) => onChange({ ...draft, body: event.target.value })}
            placeholder="회원들이 알아야 할 내용을 간단히 적어 주세요."
            value={draft.body}
          />
          {errors.body ? <p className="brand-form-error mt-1.5" id="notice-body-error">{errors.body}</p> : null}
        </div>

        <label className="brand-panel-white flex cursor-pointer items-center justify-between gap-4 rounded-2xl px-4 py-3">
          <span>
            <span className="block text-sm font-semibold text-[var(--brand-text)]">알림센터 최상단 고정</span>
            <span className="brand-text-subtle mt-0.5 block text-xs">새 고정 공지를 저장하면 이전 고정은 자동으로 해제됩니다.</span>
          </span>
          <input
            checked={draft.isPinned}
            className="h-5 w-5 shrink-0 accent-[var(--brand-primary)]"
            onChange={(event) => onChange({ ...draft, isPinned: event.target.checked })}
            type="checkbox"
          />
        </label>

        {submitError ? <p aria-live="assertive" className="brand-alert-error rounded-2xl px-4 py-3 text-sm">{submitError}</p> : null}

        <div className="flex gap-3">
          <button className="brand-button-secondary flex-1 rounded-2xl px-4 py-3 text-sm font-bold" onClick={onCancel} type="button">취소</button>
          <button className="brand-button-primary flex-1 rounded-2xl px-4 py-3 text-sm font-bold" disabled={saving} type="submit">
            {saving ? "저장 중..." : editing ? "수정 저장" : "공지 등록"}
          </button>
        </div>
      </form>
    </section>
  );
}
