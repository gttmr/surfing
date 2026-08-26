import {
  DEFAULT_PRICING_SETTINGS,
  PRICING_SETTING_KEYS,
} from "@/lib/settings";

export type SignupBurdenPreview = {
  readonly baseFee: number;
  readonly lessonFee: number;
  readonly rentalFee: number;
};

export type SignupPricingPreview = {
  readonly regular: SignupBurdenPreview;
  readonly companion: SignupBurdenPreview;
};

export type SignupBaseFees = {
  readonly regular: number;
  readonly companion: number;
};

export type OvernightSignupEstimate = {
  readonly day1Amount: number;
  readonly day2RentalAmount: number;
  readonly lodgingAmount: number;
  readonly totalAmount: number;
  readonly day2RentalSupported: boolean;
};

function amount(settings: Record<string, string | undefined>, key: string): number {
  const parsed = Number(settings[key] ?? DEFAULT_PRICING_SETTINGS[key as keyof typeof DEFAULT_PRICING_SETTINGS]);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : 0;
}

export function buildSignupPricingPreview(
  settings: Record<string, string | undefined>
): SignupPricingPreview {
  return {
    regular: {
      baseFee: amount(settings, PRICING_SETTING_KEYS.regularBaseFee),
      lessonFee: amount(settings, PRICING_SETTING_KEYS.regularLessonFee),
      rentalFee: amount(settings, PRICING_SETTING_KEYS.regularRentalFee),
    },
    companion: {
      baseFee: amount(settings, PRICING_SETTING_KEYS.companionBaseFee),
      lessonFee: amount(settings, PRICING_SETTING_KEYS.companionLessonFee),
      rentalFee: amount(settings, PRICING_SETTING_KEYS.companionRentalFee),
    },
  };
}

export function withSignupBaseFees(
  preview: SignupPricingPreview,
  baseFees: SignupBaseFees,
): SignupPricingPreview {
  return {
    regular: { ...preview.regular, baseFee: baseFees.regular },
    companion: { ...preview.companion, baseFee: baseFees.companion },
  };
}

export function calculateOvernightSignupEstimate(input: {
  readonly participantType: "REGULAR" | "COMPANION";
  readonly pricing: SignupPricingPreview;
  readonly day1Option: "lesson" | "rental" | null;
  readonly day2HasRental: boolean;
  readonly usesClubLodging: boolean;
  readonly lodgingFee: number;
}): OvernightSignupEstimate {
  const burden = input.participantType === "REGULAR" ? input.pricing.regular : input.pricing.companion;
  const day1OptionAmount = input.day1Option === "lesson"
    ? burden.lessonFee
    : input.day1Option === "rental"
      ? burden.rentalFee
      : 0;
  const day1UsesEquipment = input.day1Option === "lesson" || input.day1Option === "rental";
  const day2RentalSupported = input.participantType === "REGULAR"
    && input.day2HasRental
    && !day1UsesEquipment;
  const day2RentalAmount = input.day2HasRental && !day2RentalSupported
    ? input.pricing.companion.rentalFee
    : 0;
  const lodgingAmount = input.usesClubLodging ? Math.max(0, input.lodgingFee) : 0;
  const day1Amount = burden.baseFee + day1OptionAmount;

  return {
    day1Amount,
    day2RentalAmount,
    lodgingAmount,
    totalAmount: day1Amount + day2RentalAmount + lodgingAmount,
    day2RentalSupported,
  };
}

export const DEFAULT_SIGNUP_PRICING_PREVIEW = buildSignupPricingPreview({});
