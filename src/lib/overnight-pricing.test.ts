import assert from "node:assert/strict";
import test from "node:test";
import { groupOvernightParticipantsForSettlement, type PricingConfig } from "./pricing";
import { PRICING_SETTING_KEYS } from "./settings";

const pricing: PricingConfig = {
  [PRICING_SETTING_KEYS.regularBaseFee]: 20_000,
  [PRICING_SETTING_KEYS.companionBaseFee]: 30_000,
  [PRICING_SETTING_KEYS.regularLessonFee]: 10_000,
  [PRICING_SETTING_KEYS.companionLessonFee]: 20_000,
  [PRICING_SETTING_KEYS.regularRentalFee]: 5_000,
  [PRICING_SETTING_KEYS.companionRentalFee]: 10_000,
};

test("overnight billing applies group base and selected lodging once without billing planned rental", () => {
  const participant = {
    id: 1,
    name: "회원",
    kakaoId: "member-1",
    hasLesson: false,
    hasRental: true,
    hasBus: false,
    companionId: null,
    usesClubLodging: true,
  };
  const recipients = groupOvernightParticipantsForSettlement([
    {
      meetingId: 11,
      date: "2026-09-12",
      participants: [participant],
    },
    {
      meetingId: 12,
      date: "2026-09-13",
      participants: [{ ...participant, id: 2 }],
    },
  ], { regular: 35_000, companion: 45_000, lodging: 40_000 }, pricing);

  const line = recipients[0].items[0];
  assert.equal(line.baseFee, 35_000);
  assert.equal(line.lodgingFee, 40_000);
  assert.equal(line.rentalFee, 0);
  assert.equal(line.adjustmentFee, 0);
  assert.equal(line.totalFee, 75_000);
  assert.deepEqual(line.dailyBreakdowns?.map((day) => day.totalFee), [0, 0]);
});

test("overnight billing combines confirmed actual usage from both dates", () => {
  const participant = {
    id: 1,
    name: "회원",
    kakaoId: "member-1",
    hasLesson: true,
    hasRental: true,
    hasBus: false,
    companionId: null,
    usesClubLodging: false,
  };
  const usageLine = {
    id: 101,
    participantId: 1,
    participantType: "REGULAR" as const,
    usageItemId: 8,
    usageItemName: "강습 패키지",
    serviceType: "LESSON_PACKAGE" as const,
    quantity: 1,
    shopUnitPrice: 50_000,
    memberBillingPolicy: "REGULAR_FIXED_COMPANION_SHOP" as const,
    regularMemberUnitPrice: 10_000,
    confirmed: true,
  };
  const recipients = groupOvernightParticipantsForSettlement([
    {
      meetingId: 11,
      date: "2026-09-12",
      participants: [participant],
      surfUsageMap: new Map([[1, [usageLine]]]),
    },
    {
      meetingId: 12,
      date: "2026-09-13",
      participants: [{ ...participant, id: 2 }],
      surfUsageMap: new Map([[2, [{ ...usageLine, id: 102, participantId: 2 }]]]),
    },
  ], { regular: 35_000, companion: 45_000, lodging: 40_000 }, pricing);

  const line = recipients[0].items[0];
  assert.equal(line.baseFee, 35_000);
  assert.equal(line.surfUsageMemberFee, 20_000);
  assert.equal(line.surfUsageShopFee, 100_000);
  assert.equal(line.totalFee, 55_000);
  assert.deepEqual(line.dailyBreakdowns?.map((day) => day.totalFee), [10_000, 10_000]);
});

function equipmentLine(id: number, participantId: number, shopPrice: number) {
  return {
    id,
    participantId,
    participantType: "REGULAR" as const,
    usageItemId: id,
    usageItemName: "장비대여",
    serviceType: "EQUIPMENT_RENTAL" as const,
    quantity: 1,
    shopUnitPrice: shopPrice,
    memberBillingPolicy: "REGULAR_FREE_COMPANION_SHOP" as const,
    regularMemberUnitPrice: 0,
    confirmed: true,
  };
}

test("regular member receives equipment support for one day and pays the shop price on day two", () => {
  const participant = {
    id: 1,
    name: "회원",
    kakaoId: "member-1",
    hasLesson: false,
    hasRental: true,
    hasBus: false,
    companionId: null,
    usesClubLodging: false,
  };
  const recipients = groupOvernightParticipantsForSettlement([
    {
      meetingId: 11,
      date: "2026-09-12",
      participants: [participant],
      surfUsageMap: new Map([[1, [equipmentLine(101, 1, 30_000)]]]),
    },
    {
      meetingId: 12,
      date: "2026-09-13",
      participants: [{ ...participant, id: 2 }],
      surfUsageMap: new Map([[2, [equipmentLine(102, 2, 35_000)]]]),
    },
  ], { regular: 35_000, companion: 45_000, lodging: 40_000 }, pricing);

  const line = recipients[0].items[0];
  assert.equal(line.surfUsageShopFee, 65_000);
  assert.equal(line.surfUsageMemberFee, 35_000);
  assert.equal(line.surfUsageCoveredFee, 30_000);
  assert.equal(line.totalFee, 70_000);
  assert.deepEqual(line.dailyBreakdowns?.map((day) => day.totalFee), [0, 35_000]);
});

test("regular member support moves to day two when no equipment was used on day one", () => {
  const participant = {
    id: 1,
    name: "회원",
    kakaoId: "member-1",
    hasLesson: false,
    hasRental: false,
    hasBus: false,
    companionId: null,
    usesClubLodging: false,
  };
  const recipients = groupOvernightParticipantsForSettlement([
    { meetingId: 11, date: "2026-09-12", participants: [participant] },
    {
      meetingId: 12,
      date: "2026-09-13",
      participants: [{ ...participant, id: 2, hasRental: true }],
      surfUsageMap: new Map([[2, [equipmentLine(102, 2, 35_000)]]]),
    },
  ], { regular: 35_000, companion: 45_000, lodging: 40_000 }, pricing);

  const line = recipients[0].items[0];
  assert.equal(line.surfUsageShopFee, 35_000);
  assert.equal(line.surfUsageMemberFee, 0);
  assert.equal(line.surfUsageCoveredFee, 35_000);
  assert.equal(line.totalFee, 35_000);
  assert.deepEqual(line.dailyBreakdowns?.map((day) => day.totalFee), [0, 0]);
});

test("a first-day lesson package uses the equipment support before a second-day rental", () => {
  const participant = {
    id: 1,
    name: "회원",
    kakaoId: "member-1",
    hasLesson: true,
    hasRental: false,
    hasBus: false,
    companionId: null,
    usesClubLodging: false,
  };
  const lessonLine = {
    id: 101,
    participantId: 1,
    participantType: "REGULAR" as const,
    usageItemId: 7,
    usageItemName: "강습 패키지",
    serviceType: "LESSON_PACKAGE" as const,
    quantity: 1,
    shopUnitPrice: 50_000,
    memberBillingPolicy: "REGULAR_FIXED_COMPANION_SHOP" as const,
    regularMemberUnitPrice: 10_000,
    confirmed: true,
  };
  const recipients = groupOvernightParticipantsForSettlement([
    {
      meetingId: 11,
      date: "2026-09-12",
      participants: [participant],
      surfUsageMap: new Map([[1, [lessonLine]]]),
    },
    {
      meetingId: 12,
      date: "2026-09-13",
      participants: [{ ...participant, id: 2, hasLesson: false, hasRental: true }],
      surfUsageMap: new Map([[2, [equipmentLine(102, 2, 35_000)]]]),
    },
  ], { regular: 35_000, companion: 45_000, lodging: 40_000 }, pricing);

  const line = recipients[0].items[0];
  assert.equal(line.surfUsageShopFee, 85_000);
  assert.equal(line.surfUsageMemberFee, 45_000);
  assert.equal(line.surfUsageCoveredFee, 40_000);
  assert.equal(line.totalFee, 80_000);
});
