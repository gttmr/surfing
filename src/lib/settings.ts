export const PARTICIPANT_OPTION_PRICING_GUIDE_KEY = "participant_option_pricing_guide";
export const CANCELLATION_PENALTY_MESSAGE_KEY = "cancellation_penalty_message";
export const CANCELLATION_PENALTY_DAYS_KEY = "cancellation_penalty_days";
export const SETTLEMENT_BANK_NAME_KEY = "settlement_bank_name";
export const SETTLEMENT_ACCOUNT_NUMBER_KEY = "settlement_account_number";
export const SETTLEMENT_ACCOUNT_HOLDER_KEY = "settlement_account_holder";
export const FOOD_ORDER_SUPPORT_CAP_KEY = "food_order_support_cap";
/** 회사가 모임마다 정회원 1명당 지원하는 금액. 회원 청구와 무관하게 정산 수지에만 쓴다. */
export const COMPANY_SUPPORT_PER_REGULAR_KEY = "company_support_per_regular";

export const DEFAULT_PARTICIPANT_OPTION_PRICING_GUIDE = [
  "강습(장비 포함)은 정회원 1만원, 동반인은 추가 5만원,",
  "장비 대여는 정회원 무료, 동반인은 추가 3만원입니다. 최종 금액은 현장에서 실제 이용한 만큼 청구됩니다.",
].join("\n");

export const DEFAULT_CANCELLATION_PENALTY_DAYS = "4";
export const DEFAULT_SETTLEMENT_BANK_NAME = "";
export const DEFAULT_SETTLEMENT_ACCOUNT_NUMBER = "";
export const DEFAULT_SETTLEMENT_ACCOUNT_HOLDER = "";
export const DEFAULT_FOOD_ORDER_SUPPORT_CAP = "10000";
export const DEFAULT_COMPANY_SUPPORT_PER_REGULAR = "50000";

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
  [PRICING_SETTING_KEYS.regularLessonFee]: "10000",
  [PRICING_SETTING_KEYS.companionLessonFee]: "50000",
  [PRICING_SETTING_KEYS.regularRentalFee]: "0",
  [PRICING_SETTING_KEYS.companionRentalFee]: "30000",
};

export type PricingSettingKey = (typeof PRICING_SETTING_KEYS)[keyof typeof PRICING_SETTING_KEYS];
