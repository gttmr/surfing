import assert from "node:assert/strict";
import test from "node:test";
import {
  buildSignupPricingPreview,
  calculateOvernightSignupEstimate,
  withSignupBaseFees,
} from "./signup-pricing";

const ITEMS = [
  { serviceType: "LESSON_PACKAGE", shopPrice: 50000, regularPrice: 10000 },
  { serviceType: "EQUIPMENT_RENTAL", shopPrice: 30000, regularPrice: 0 },
];

test("signup burden preview uses the meeting fee and the usage item prices", () => {
  const preview = buildSignupPricingPreview({ regular: 10000, companion: 30000 }, [
    { serviceType: "LESSON_PACKAGE", shopPrice: 50000, regularPrice: 5000 },
    { serviceType: "EQUIPMENT_RENTAL", shopPrice: 30000, regularPrice: 0 },
  ]);

  assert.deepEqual(preview.regular, { baseFee: 10000, lessonFee: 5000, rentalFee: 0 });
  assert.equal(preview.companion.baseFee + preview.companion.lessonFee, 80000);
});

test("an item without a regular price charges regular members the shop price; inactive items are skipped", () => {
  const preview = buildSignupPricingPreview({ regular: 0, companion: 0 }, [
    { serviceType: "LESSON_PACKAGE", shopPrice: 50000, regularPrice: 10000, isActive: false },
    { serviceType: "EQUIPMENT_RENTAL", shopPrice: 30000, regularPrice: null },
  ]);
  assert.deepEqual(preview.regular, { baseFee: 0, lessonFee: 0, rentalFee: 30000 });
});

test("overnight signup preview replaces base fees with the meeting's own fees", () => {
  const globalPreview = buildSignupPricingPreview({ regular: 35000, companion: 50000 }, ITEMS);

  const preview = withSignupBaseFees(globalPreview, { regular: 30000, companion: 45000 });

  assert.deepEqual(preview.regular, { baseFee: 30000, lessonFee: 10000, rentalFee: 0 });
  assert.deepEqual(preview.companion, { baseFee: 45000, lessonFee: 50000, rentalFee: 30000 });
});

test("regular overnight estimate charges day two shop rental only after day one equipment support was used", () => {
  const preview = withSignupBaseFees(buildSignupPricingPreview({ regular: 0, companion: 0 }, ITEMS), { regular: 30000, companion: 50000 });

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
  const preview = withSignupBaseFees(buildSignupPricingPreview({ regular: 0, companion: 0 }, ITEMS), { regular: 30000, companion: 50000 });

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
