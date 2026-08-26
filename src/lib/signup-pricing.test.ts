import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSignupPricingPreview,
  calculateOvernightSignupEstimate,
  withSignupBaseFees,
} from "./signup-pricing";
import { PRICING_SETTING_KEYS } from "./settings";

test("signup burden preview separates regular and companion policy", () => {
  const preview = buildSignupPricingPreview({
    [PRICING_SETTING_KEYS.regularBaseFee]: "10000",
    [PRICING_SETTING_KEYS.regularLessonFee]: "5000",
    [PRICING_SETTING_KEYS.companionBaseFee]: "30000",
    [PRICING_SETTING_KEYS.companionLessonFee]: "50000",
  });

  assert.deepEqual(preview.regular, { baseFee: 10000, lessonFee: 5000, rentalFee: 0 });
  assert.equal(preview.companion.baseFee + preview.companion.lessonFee, 80000);
});

test("overnight signup preview replaces global base fees with the meeting group fees", () => {
  const globalPreview = buildSignupPricingPreview({
    [PRICING_SETTING_KEYS.regularBaseFee]: "35000",
    [PRICING_SETTING_KEYS.regularLessonFee]: "10000",
    [PRICING_SETTING_KEYS.companionBaseFee]: "50000",
    [PRICING_SETTING_KEYS.companionLessonFee]: "50000",
  });

  const preview = withSignupBaseFees(globalPreview, { regular: 30000, companion: 45000 });

  assert.deepEqual(preview.regular, { baseFee: 30000, lessonFee: 10000, rentalFee: 0 });
  assert.deepEqual(preview.companion, { baseFee: 45000, lessonFee: 50000, rentalFee: 30000 });
});

test("regular overnight estimate charges day two shop rental only after day one equipment support was used", () => {
  const preview = withSignupBaseFees(buildSignupPricingPreview({
    [PRICING_SETTING_KEYS.regularLessonFee]: "10000",
    [PRICING_SETTING_KEYS.regularRentalFee]: "0",
    [PRICING_SETTING_KEYS.companionRentalFee]: "30000",
  }), { regular: 30000, companion: 50000 });

  assert.deepEqual(calculateOvernightSignupEstimate({
    participantType: "REGULAR",
    pricing: preview,
    day1Option: "rental",
    day2HasRental: true,
    usesClubLodging: true,
    lodgingFee: 50000,
  }), {
    day1Amount: 30000,
    day2RentalAmount: 30000,
    lodgingAmount: 50000,
    totalAmount: 110000,
    day2RentalSupported: false,
  });

  assert.deepEqual(calculateOvernightSignupEstimate({
    participantType: "REGULAR",
    pricing: preview,
    day1Option: null,
    day2HasRental: true,
    usesClubLodging: true,
    lodgingFee: 50000,
  }), {
    day1Amount: 30000,
    day2RentalAmount: 0,
    lodgingAmount: 50000,
    totalAmount: 80000,
    day2RentalSupported: true,
  });

  const afterLesson = calculateOvernightSignupEstimate({
    participantType: "REGULAR",
    pricing: preview,
    day1Option: "lesson",
    day2HasRental: true,
    usesClubLodging: false,
    lodgingFee: 50000,
  });
  assert.equal(afterLesson.day2RentalAmount, 30000);
  assert.equal(afterLesson.totalAmount, 70000);
});

test("companion overnight estimate charges shop rental on every selected day", () => {
  const preview = withSignupBaseFees(buildSignupPricingPreview({
    [PRICING_SETTING_KEYS.companionRentalFee]: "30000",
  }), { regular: 30000, companion: 50000 });

  const estimate = calculateOvernightSignupEstimate({
    participantType: "COMPANION",
    pricing: preview,
    day1Option: "rental",
    day2HasRental: true,
    usesClubLodging: false,
    lodgingFee: 50000,
  });

  assert.equal(estimate.day1Amount, 80000);
  assert.equal(estimate.day2RentalAmount, 30000);
  assert.equal(estimate.totalAmount, 110000);
  assert.equal(estimate.day2RentalSupported, false);
});
