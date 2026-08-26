import { AdminSettingSectionHeader } from "@/components/admin/AdminSettingControls";
import {
  MAX_PRICING_COMPONENT,
  parsePricingAmount,
  type PricingInputErrors,
} from "@/lib/admin-pricing-settings";
import type { AdminPricingState } from "@/lib/admin-page-data";
import { PRICING_SETTING_KEYS, type PricingSettingKey } from "@/lib/settings";

const PRICING_FIELDS = [
  {
    title: "기본 참가비",
    description: "모임 참가 자체에 반영되는 금액",
    regularKey: PRICING_SETTING_KEYS.regularBaseFee,
    companionKey: PRICING_SETTING_KEYS.companionBaseFee,
  },
  {
    title: "강습비",
    description: "강습을 선택했을 때 추가되는 금액",
    regularKey: PRICING_SETTING_KEYS.regularLessonFee,
    companionKey: PRICING_SETTING_KEYS.companionLessonFee,
  },
  {
    title: "장비 대여비",
    description: "장비 대여를 선택했을 때 추가되는 금액",
    regularKey: PRICING_SETTING_KEYS.regularRentalFee,
    companionKey: PRICING_SETTING_KEYS.companionRentalFee,
  },
] as const;

function formatWon(value: string): string {
  const amount = parsePricingAmount(value);
  return amount === null ? "입력 확인" : `${amount.toLocaleString("ko-KR")}원`;
}

type PricingInputProps = {
  readonly description: string;
  readonly disabled: boolean;
  readonly error: string | undefined;
  readonly label: string;
  readonly name: PricingSettingKey | "foodOrderSupportCap";
  readonly onChange: (key: PricingSettingKey | "foodOrderSupportCap", value: string) => void;
  readonly value: string;
};

function PricingInput({ description, disabled, error, label, name, onChange, value }: PricingInputProps) {
  const descriptionId = `pricing-${name}-description`;
  const errorId = `pricing-${name}-error`;
  return (
    <label className="block" htmlFor={`pricing-${name}`}>
      <span className="mb-1 block text-xs font-bold text-brand-text">{label}</span>
      <input
        aria-describedby={`${descriptionId}${error ? ` ${errorId}` : ""}`}
        aria-invalid={error ? "true" : undefined}
        className={`brand-input min-h-11 w-full rounded-xl px-3 text-sm outline-none ${error ? "brand-input-error" : ""}`}
        disabled={disabled}
        id={`pricing-${name}`}
        inputMode="numeric"
        max={MAX_PRICING_COMPONENT}
        min="0"
        name={name}
        onChange={(event) => onChange(name, event.target.value)}
        required
        step="1"
        type="number"
        value={value}
      />
      <span className="brand-text-subtle mt-1 block text-[11px]" id={descriptionId}>
        {description} · 현재 초안 {formatWon(value)}
      </span>
      {error ? <span className="brand-form-error block" id={errorId}>{error}</span> : null}
    </label>
  );
}

type MemberFeesSectionProps = {
  readonly dirty: boolean;
  readonly disabled: boolean;
  readonly draft: AdminPricingState;
  readonly editing: boolean;
  readonly errors: PricingInputErrors;
  readonly onChange: PricingInputProps["onChange"];
  readonly onToggleEditing: () => void;
  readonly snapshot: AdminPricingState;
};

export function AdminMemberFeesSection({
  dirty,
  disabled,
  draft,
  editing,
  errors,
  onChange,
  onToggleEditing,
  snapshot,
}: MemberFeesSectionProps) {
  return (
    <section className="brand-admin-section overflow-hidden">
      <AdminSettingSectionHeader
        contentId="member-fees-editor"
        disabled={disabled}
        dirty={dirty}
        editing={editing}
        onToggleEditing={onToggleEditing}
        roleLabel="회원 청구에 반영"
        summary={`정회원 참가 ${formatWon(snapshot[PRICING_SETTING_KEYS.regularBaseFee])} · 동반인 참가 ${formatWon(snapshot[PRICING_SETTING_KEYS.companionBaseFee])}`}
        title="참가비와 옵션 비용"
      />
      {editing ? (
        <div className="space-y-4 px-4 py-5" id="member-fees-editor">
          {PRICING_FIELDS.map((field) => (
            <fieldset className="brand-list-item rounded-2xl p-4" key={field.title}>
              <legend className="text-sm font-extrabold text-brand-text">{field.title}</legend>
              <p className="brand-text-subtle mt-1 text-xs">{field.description}</p>
              <div className="mt-3 grid grid-cols-2 gap-3">
                <PricingInput description="정회원 기준" disabled={disabled} error={errors[field.regularKey]} label="정회원" name={field.regularKey} onChange={onChange} value={draft[field.regularKey]} />
                <PricingInput description="동반인 기준" disabled={disabled} error={errors[field.companionKey]} label="동반인" name={field.companionKey} onChange={onChange} value={draft[field.companionKey]} />
              </div>
            </fieldset>
          ))}
          <div aria-label="저장 비용 항목 초안 미리보기" className="brand-highlight-panel rounded-2xl p-4">
            <p className="text-xs font-bold text-brand-text">저장되는 비용 항목</p>
            <div className="mt-3 space-y-3 text-sm">
              {PRICING_FIELDS.map((field) => (
                <p className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-3" key={field.title}>
                  <span className="brand-text-subtle">{field.title}</span>
                  <strong>정회원 {formatWon(draft[field.regularKey])}</strong>
                  <strong>동반인 {formatWon(draft[field.companionKey])}</strong>
                </p>
              ))}
            </div>
            <p className="brand-text-subtle mt-3 text-xs leading-5">실제 회원 청구는 확정된 강습·장비 대여 이용 여부에 따라 해당 비용 항목만 반영됩니다.</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}

type FoodSupportSectionProps = Omit<MemberFeesSectionProps, "errors"> & {
  readonly error: string | undefined;
};

export function AdminFoodSupportSection({
  dirty,
  disabled,
  draft,
  editing,
  error,
  onChange,
  onToggleEditing,
  snapshot,
}: FoodSupportSectionProps) {
  return (
    <section className="brand-admin-section overflow-hidden">
      <AdminSettingSectionHeader
        contentId="food-support-editor"
        disabled={disabled}
        dirty={dirty}
        editing={editing}
        onToggleEditing={onToggleEditing}
        roleLabel="식음료 청구에 반영"
        summary={`1인당 최대 ${formatWon(snapshot.foodOrderSupportCap)}`}
        title="식음료 지원 한도"
      />
      {editing ? (
        <div className="space-y-4 px-4 py-5" id="food-support-editor">
          <PricingInput description="참가자별 식음료 주문에서 차감되는 최대 금액" disabled={disabled} error={error} label="1인당 지원 한도" name="foodOrderSupportCap" onChange={onChange} value={draft.foodOrderSupportCap} />
          <div aria-label="식음료 지원 초안 미리보기" className="brand-highlight-panel rounded-2xl p-4">
            <p className="text-xs font-bold text-brand-text">회원 부담 미리보기</p>
            <p className="brand-text-muted mt-2 text-sm">참가자별 식음료 주문 금액에서 최대 <strong className="text-brand-text">{formatWon(draft.foodOrderSupportCap)}</strong>까지 지원됩니다.</p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
