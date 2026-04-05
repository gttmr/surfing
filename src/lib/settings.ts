export const PARTICIPANT_OPTION_PRICING_GUIDE_KEY = "participant_option_pricing_guide";
export const SETTLEMENT_BANK_NAME_KEY = "settlement_bank_name";
export const SETTLEMENT_ACCOUNT_NUMBER_KEY = "settlement_account_number";
export const SETTLEMENT_ACCOUNT_HOLDER_KEY = "settlement_account_holder";

export const DEFAULT_PARTICIPANT_OPTION_PRICING_GUIDE = [
  "'강습+장비대여'는 정회원은 무료, 동반인은 추가 5만원,",
  "'장비 대여만' 신청시 정회원은 무료, 동반인은 추가 3만원의 비용이 듭니다.",
].join("\n");

export const DEFAULT_SETTLEMENT_BANK_NAME = "";
export const DEFAULT_SETTLEMENT_ACCOUNT_NUMBER = "";
export const DEFAULT_SETTLEMENT_ACCOUNT_HOLDER = "";

export const PRICING_SETTING_KEYS = {
  regularBaseFee: "pricing_regular_base_fee",
  companionBaseFee: "pricing_companion_base_fee",
  regularLessonFee: "pricing_regular_lesson_fee",
  companionLessonFee: "pricing_companion_lesson_fee",
  regularRentalFee: "pricing_regular_rental_fee",
  companionRentalFee: "pricing_companion_rental_fee",
} as const;

export const DEFAULT_PRICING_SETTINGS: Record<(typeof PRICING_SETTING_KEYS)[keyof typeof PRICING_SETTING_KEYS], string> = {
  [PRICING_SETTING_KEYS.regularBaseFee]: "0",
  [PRICING_SETTING_KEYS.companionBaseFee]: "0",
  [PRICING_SETTING_KEYS.regularLessonFee]: "0",
  [PRICING_SETTING_KEYS.companionLessonFee]: "50000",
  [PRICING_SETTING_KEYS.regularRentalFee]: "0",
  [PRICING_SETTING_KEYS.companionRentalFee]: "30000",
};

export type PricingSettingKey = (typeof PRICING_SETTING_KEYS)[keyof typeof PRICING_SETTING_KEYS];
