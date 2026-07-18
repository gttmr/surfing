import { Icon } from "@/components/ui/Icon";

type AdminSettingSectionHeaderProps = {
  readonly contentId: string;
  readonly disabled: boolean;
  readonly dirty: boolean;
  readonly editing: boolean;
  readonly onToggleEditing: () => void;
  readonly roleLabel: string;
  readonly summary: string;
  readonly title: string;
};

export function AdminSettingSectionHeader({
  contentId,
  disabled,
  dirty,
  editing,
  onToggleEditing,
  roleLabel,
  summary,
  title,
}: AdminSettingSectionHeaderProps) {
  return (
    <div className="brand-admin-section-header space-y-3 px-4 py-4" data-admin-setting-header={title}>
      <div className="flex flex-col items-stretch gap-3 min-[320px]:flex-row min-[320px]:items-start min-[320px]:justify-between">
        <div className="min-w-0 space-y-2" data-admin-setting-header-content>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-extrabold text-[var(--brand-text)]">{title}</h2>
            <span className="brand-chip-soft inline-flex max-w-full break-keep rounded-full px-2.5 py-1 text-center text-[11px] font-bold leading-4 [overflow-wrap:normal]" data-admin-role-label>{roleLabel}</span>
            {dirty ? (
              <span className="brand-chip-preparing rounded-full px-2.5 py-1 text-[11px] font-bold">초안 있음</span>
            ) : null}
          </div>
          <p className="brand-text-muted line-clamp-2 text-xs leading-5 max-[319px]:line-clamp-none max-[319px]:[overflow-wrap:anywhere]" data-admin-persisted-summary>
            <span className="font-bold text-[var(--brand-text)]">저장된 값</span> · {summary}
          </p>
        </div>
        <button
          aria-label={`${title} ${editing ? "편집 접기" : "편집"}`}
          aria-controls={contentId}
          aria-expanded={editing}
          className="brand-button-secondary inline-flex min-h-11 w-full shrink-0 items-center justify-center gap-1 rounded-xl px-3 text-xs font-bold min-[320px]:w-auto"
          disabled={disabled}
          onClick={onToggleEditing}
          type="button"
        >
          <Icon className="text-[18px]" name={editing ? "expand_less" : "edit"} />
          {editing ? "접기" : "편집"}
        </button>
      </div>
    </div>
  );
}

type AdminSettingActionBarProps = {
  readonly dirtySectionCount: number;
  readonly saving: boolean;
  readonly onDiscard: () => void;
};

export function AdminSettingActionBar({
  dirtySectionCount,
  saving,
  onDiscard,
}: AdminSettingActionBarProps) {
  if (dirtySectionCount === 0) return null;

  return (
    <aside
      aria-label="저장하지 않은 변경사항"
      className="brand-panel-white sticky bottom-[calc(var(--brand-dock-clearance)+var(--brand-safe-bottom)+0.5rem)] z-10 space-y-3 rounded-2xl p-3 shadow-brand"
    >
      <p aria-live="polite" className="text-center text-xs font-bold text-[var(--brand-text)]">
        {dirtySectionCount}개 섹션에 저장하지 않은 초안이 있습니다.
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button
          className="brand-button-secondary min-h-11 rounded-xl px-3 text-sm font-bold"
          disabled={saving}
          onClick={onDiscard}
          type="button"
        >
          변경 취소
        </button>
        <button
          className="brand-button-primary min-h-11 rounded-xl px-3 text-sm font-bold"
          disabled={saving}
          type="submit"
        >
          {saving ? "저장 중" : "변경사항 저장"}
        </button>
      </div>
    </aside>
  );
}

export function AdminSettingSaveError({ message }: { readonly message: string }) {
  return (
    <div className="brand-alert-error rounded-2xl p-4" role="alert">
      <p className="font-bold">저장되지 않았습니다</p>
      <p className="mt-1 text-sm">{message}</p>
      <p className="mt-2 text-xs font-semibold">서버에 저장된 값은 그대로이며 입력한 초안은 유지되었습니다.</p>
    </div>
  );
}

export function saveFailureMessage(status: number): string {
  if (status === 400) return "입력 내용을 확인한 뒤 다시 저장해 주세요.";
  if (status === 401) return "관리자 로그인이 만료되었습니다. 다시 로그인한 뒤 저장해 주세요.";
  if (status === 403) return "이 설정을 저장할 권한이 없습니다. 다른 관리자에게 확인해 주세요.";
  return "서버 문제로 저장하지 못했습니다. 잠시 후 다시 시도해 주세요.";
}
