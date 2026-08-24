import type { AdminPricingState, AdminSettingsFormData } from "@/lib/admin-page-data";
import { PRICING_SETTING_KEYS, type PricingSettingKey } from "@/lib/settings";

export type PricingInputKey = PricingSettingKey | "foodOrderSupportCap";
export type PricingInputErrors = Partial<Record<PricingInputKey, string>>;
export type SettingsInputErrors = Partial<Record<keyof AdminSettingsFormData, string>>;

export const PRICING_AMOUNT_KEYS = [
  PRICING_SETTING_KEYS.regularBaseFee,
  PRICING_SETTING_KEYS.companionBaseFee,
  PRICING_SETTING_KEYS.regularLessonFee,
  PRICING_SETTING_KEYS.companionLessonFee,
  PRICING_SETTING_KEYS.regularRentalFee,
  PRICING_SETTING_KEYS.companionRentalFee,
  "foodOrderSupportCap",
] as const satisfies readonly PricingInputKey[];

export const MEMBER_FEE_KEYS = [
  PRICING_SETTING_KEYS.regularBaseFee,
  PRICING_SETTING_KEYS.companionBaseFee,
  PRICING_SETTING_KEYS.regularLessonFee,
  PRICING_SETTING_KEYS.companionLessonFee,
  PRICING_SETTING_KEYS.regularRentalFee,
  PRICING_SETTING_KEYS.companionRentalFee,
] as const satisfies readonly PricingSettingKey[];
export const SETTINGS_INPUT_KEYS = [
  "penaltyDays",
  "penaltyMessage",
  "participantOptionPricingGuide",
  "settlementBankName",
  "settlementAccountNumber",
  "settlementAccountHolder",
] as const satisfies readonly (keyof AdminSettingsFormData)[];
export const MAX_PRICING_COMPONENT = Math.floor(Number.MAX_SAFE_INTEGER / 3);

type PricingValidationResult =
  | { readonly valid: true; readonly value: AdminPricingState }
  | { readonly valid: false; readonly errors: PricingInputErrors; readonly firstKey: PricingInputKey };

type SettingsValidationResult =
  | { readonly valid: true; readonly value: AdminSettingsFormData }
  | {
      readonly valid: false;
      readonly errors: SettingsInputErrors;
      readonly firstKey: keyof AdminSettingsFormData;
    };

export function parsePricingAmount(value: string): number | null {
  const compact = value.replaceAll(",", "").trim();
  if (!/^\d+$/.test(compact)) return null;
  const amount = Number(compact);
  return Number.isSafeInteger(amount) && amount <= MAX_PRICING_COMPONENT ? amount : null;
}

function pricingInputError(value: string): string | null {
  const compact = value.replaceAll(",", "").trim();
  if (!compact) return "금액을 입력해 주세요.";
  if (/^-/.test(compact) && Number(compact) < 0) return "0원 이상으로 입력해 주세요.";
  if (!/^\d+$/.test(compact)) return "숫자만 입력해 주세요.";
  if (parsePricingAmount(value) === null) return "금액이 너무 큽니다.";
  return null;
}

export function validatePricingDraft(draft: AdminPricingState): PricingValidationResult {
  const errors: PricingInputErrors = {};
  for (const key of PRICING_AMOUNT_KEYS) {
    const error = pricingInputError(draft[key]);
    if (error) errors[key] = error;
  }

  const firstKey = PRICING_AMOUNT_KEYS.find((key) => errors[key] !== undefined);
  if (firstKey) return { valid: false, errors, firstKey };

  const regularBaseFee = parsePricingAmount(draft[PRICING_SETTING_KEYS.regularBaseFee]);
  const companionBaseFee = parsePricingAmount(draft[PRICING_SETTING_KEYS.companionBaseFee]);
  const regularLessonFee = parsePricingAmount(draft[PRICING_SETTING_KEYS.regularLessonFee]);
  const companionLessonFee = parsePricingAmount(draft[PRICING_SETTING_KEYS.companionLessonFee]);
  const regularRentalFee = parsePricingAmount(draft[PRICING_SETTING_KEYS.regularRentalFee]);
  const companionRentalFee = parsePricingAmount(draft[PRICING_SETTING_KEYS.companionRentalFee]);
  const foodOrderSupportCap = parsePricingAmount(draft.foodOrderSupportCap);

  if (
    regularBaseFee === null ||
    companionBaseFee === null ||
    regularLessonFee === null ||
    companionLessonFee === null ||
    regularRentalFee === null ||
    companionRentalFee === null ||
    foodOrderSupportCap === null
  ) {
    return {
      valid: false,
      errors: { foodOrderSupportCap: "금액을 확인해 주세요." },
      firstKey: "foodOrderSupportCap",
    };
  }

  return {
    valid: true,
    value: {
      [PRICING_SETTING_KEYS.regularBaseFee]: String(regularBaseFee),
      [PRICING_SETTING_KEYS.companionBaseFee]: String(companionBaseFee),
      [PRICING_SETTING_KEYS.regularLessonFee]: String(regularLessonFee),
      [PRICING_SETTING_KEYS.companionLessonFee]: String(companionLessonFee),
      [PRICING_SETTING_KEYS.regularRentalFee]: String(regularRentalFee),
      [PRICING_SETTING_KEYS.companionRentalFee]: String(companionRentalFee),
      foodOrderSupportCap: String(foodOrderSupportCap),
    },
  };
}

export function validateSettingsDraft(draft: AdminSettingsFormData): SettingsValidationResult {
  const errors: SettingsInputErrors = {};
  const penaltyDays = draft.penaltyDays.trim();
  const settlementBankName = draft.settlementBankName.trim();
  const settlementAccountNumber = draft.settlementAccountNumber.trim();
  const settlementAccountHolder = draft.settlementAccountHolder.trim();
  if (!penaltyDays) {
    errors.penaltyDays = "기준 일수를 입력해 주세요.";
  } else if (!/^\d+$/.test(penaltyDays)) {
    errors.penaltyDays = "0부터 30까지의 정수로 입력해 주세요.";
  } else {
    const days = Number(penaltyDays);
    if (!Number.isInteger(days) || days < 0 || days > 30) {
      errors.penaltyDays = "0일부터 30일 사이로 입력해 주세요.";
    }
  }

  if (!draft.penaltyMessage.trim()) errors.penaltyMessage = "취소 안내 문구를 입력해 주세요.";
  if (!draft.participantOptionPricingGuide.trim()) {
    errors.participantOptionPricingGuide = "참가 옵션 안내 문구를 입력해 주세요.";
  }

  const accountValues = [
    settlementBankName,
    settlementAccountNumber,
    settlementAccountHolder,
  ];
  if (accountValues.some(Boolean)) {
    if (!settlementBankName) errors.settlementBankName = "은행명을 입력해 주세요.";
    if (!settlementAccountNumber) errors.settlementAccountNumber = "계좌번호를 입력해 주세요.";
    if (!settlementAccountHolder) errors.settlementAccountHolder = "예금주를 입력해 주세요.";
  }

  const firstKey = SETTINGS_INPUT_KEYS.find((key) => errors[key] !== undefined);
  if (firstKey) return { valid: false, errors, firstKey };

  return {
    valid: true,
    value: {
      ...draft,
      penaltyDays: String(Number(penaltyDays)),
      settlementBankName,
      settlementAccountNumber,
      settlementAccountHolder,
    },
  };
}
