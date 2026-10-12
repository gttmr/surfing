import { DEFAULT_SURF_USAGE_ITEMS, regularUnitPrice } from "@/lib/surf-usage-billing";

// 신청 화면의 예상 금액. 참가비는 모임에 저장된 금액, 강습·장비는 이용 항목표 가격을 쓴다.

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

type SignupUsageItem = {
  readonly serviceType: string;
  readonly shopPrice: number;
  readonly regularPrice: number | null;
  readonly isActive?: boolean;
};

export function buildSignupPricingPreview(
  baseFees: SignupBaseFees,
  usageItems: readonly SignupUsageItem[],
): SignupPricingPreview {
  const active = usageItems.filter((item) => item.isActive !== false);
  const lesson = active.find((item) => item.serviceType === "LESSON_PACKAGE");
  const rental = active.find((item) => item.serviceType === "EQUIPMENT_RENTAL");
  return {
    regular: {
      baseFee: baseFees.regular,
      lessonFee: lesson ? regularUnitPrice(lesson) : 0,
      rentalFee: rental ? regularUnitPrice(rental) : 0,
    },
    companion: {
      baseFee: baseFees.companion,
      lessonFee: lesson?.shopPrice ?? 0,
      rentalFee: rental?.shopPrice ?? 0,
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

export const DEFAULT_SIGNUP_PRICING_PREVIEW = buildSignupPricingPreview({ regular: 0, companion: 0 }, DEFAULT_SURF_USAGE_ITEMS);
