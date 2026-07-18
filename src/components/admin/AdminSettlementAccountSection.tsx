import { AdminSettingSectionHeader } from "@/components/admin/AdminSettingControls";
import type { SettingsChangeHandler } from "@/components/admin/AdminPolicySettingsSections";
import type { SettingsInputErrors } from "@/lib/admin-pricing-settings";
import type { AdminSettingsFormData } from "@/lib/admin-page-data";

type SettlementAccountSectionProps = {
  readonly dirty: boolean;
  readonly disabled: boolean;
  readonly draft: AdminSettingsFormData;
  readonly editing: boolean;
  readonly errors: SettingsInputErrors;
  readonly onChange: SettingsChangeHandler;
  readonly onToggleEditing: () => void;
  readonly snapshot: AdminSettingsFormData;
};

function accountSummary(settings: AdminSettingsFormData): string {
  const values = [settings.settlementBankName, settings.settlementAccountNumber, settings.settlementAccountHolder]
    .filter((value) => value.trim());
  return values.length > 0 ? values.join(" · ") : "등록된 계좌 없음";
}

export function AdminSettlementAccountSection({
  dirty,
  disabled,
  draft,
  editing,
  errors,
  onChange,
  onToggleEditing,
  snapshot,
}: SettlementAccountSectionProps) {
  const accountStarted = [draft.settlementBankName, draft.settlementAccountNumber, draft.settlementAccountHolder]
    .some((value) => value.trim());
  const fields = [
    { key: "settlementBankName", label: "은행명", placeholder: "예: 카카오뱅크", inputMode: undefined },
    { key: "settlementAccountNumber", label: "계좌번호", placeholder: "예: 3333-12-1234567", inputMode: "numeric" },
    { key: "settlementAccountHolder", label: "예금주", placeholder: "예: 홍길동", inputMode: undefined },
  ] as const satisfies readonly {
    readonly key: "settlementBankName" | "settlementAccountNumber" | "settlementAccountHolder";
    readonly label: string;
    readonly placeholder: string;
    readonly inputMode: "numeric" | undefined;
  }[];

  return (
    <section className="brand-admin-section overflow-hidden">
      <AdminSettingSectionHeader
        contentId="settlement-account-editor"
        disabled={disabled}
        dirty={dirty}
        editing={editing}
        onToggleEditing={onToggleEditing}
        roleLabel="정산받는 회원에게 표시"
        summary={accountSummary(snapshot)}
        title="정산 계좌"
      />
      {editing ? (
        <div className="space-y-4 px-4 py-5" id="settlement-account-editor">
          <p className="brand-text-subtle text-xs">계좌를 사용하지 않으면 세 항목을 모두 비워 둘 수 있습니다. 하나를 입력하면 나머지도 필요합니다.</p>
          <div className="space-y-3">
            {fields.map((field) => {
              const error = errors[field.key];
              const descriptionId = `settings-${field.key}-description`;
              const errorId = `settings-${field.key}-error`;
              return (
                <label className="block" htmlFor={`settings-${field.key}`} key={field.key}>
                  <span className="mb-1 block text-sm font-bold text-[var(--brand-text)]">{field.label}</span>
                  <input
                    aria-describedby={`${descriptionId}${error ? ` ${errorId}` : ""}`}
                    aria-invalid={error ? "true" : undefined}
                    className={`brand-input min-h-11 w-full rounded-xl px-3 text-sm outline-none ${error ? "brand-input-error" : ""}`}
                    disabled={disabled}
                    id={`settings-${field.key}`}
                    inputMode={field.inputMode}
                    onChange={(event) => onChange(field.key, event.target.value)}
                    placeholder={field.placeholder}
                    required={accountStarted}
                    value={draft[field.key]}
                  />
                  <span className="brand-text-subtle mt-1 block text-xs" id={descriptionId}>{accountStarted ? "계좌 안내를 완성하려면 필수" : "계좌를 등록할 때 입력"}</span>
                  {error ? <span className="brand-form-error block" id={errorId}>{error}</span> : null}
                </label>
              );
            })}
          </div>
          <div aria-label="정산 계좌 초안 미리보기" className="brand-highlight-panel rounded-2xl p-4">
            <p className="text-sm font-bold text-[var(--brand-text)]">회원 화면 미리보기</p>
            <p className="brand-text-muted mt-2 text-sm">{accountSummary(draft)}</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
