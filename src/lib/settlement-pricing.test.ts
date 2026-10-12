import assert from "node:assert/strict";
import test from "node:test";
import { groupParticipantsForSettlement, type SettlementMeetingInput } from "./pricing";
import type { SurfUsageBillingLine } from "./surf-usage-billing";

const overnight: SettlementMeetingInput = {
  id: 14,
  date: "2026-09-12",
  endDate: "2026-09-13",
  regularFee: 35_000,
  companionFee: 45_000,
  lodgingFee: 40_000,
};
const dayTrip: SettlementMeetingInput = { ...overnight, endDate: null, regularFee: 35_000, lodgingFee: 0 };

const member = { id: 1, name: "회원", kakaoId: "member-1", companionId: null, usesClubLodging: false };

function usage(day: number, overrides: Partial<SurfUsageBillingLine> = {}): SurfUsageBillingLine {
  return {
    id: day * 100,
    participantId: 1,
    day,
    participantType: "REGULAR",
    usageItemId: 2,
    usageItemName: "장비대여",
    serviceType: "EQUIPMENT_RENTAL",
    quantity: 1,
    shopUnitPrice: 30_000,
    memberBillingPolicy: "REGULAR_FREE_COMPANION_SHOP",
    regularMemberUnitPrice: 0,
    confirmed: true,
    ...overrides,
  };
}

const lesson = (day: number) => usage(day, {
  usageItemId: 1,
  usageItemName: "강습 패키지",
  serviceType: "LESSON_PACKAGE",
  shopUnitPrice: 50_000,
  memberBillingPolicy: "REGULAR_FIXED_COMPANION_SHOP",
  regularMemberUnitPrice: 10_000,
});

function lineFor(meeting: SettlementMeetingInput, lines: SurfUsageBillingLine[], participant = member) {
  return groupParticipantsForSettlement(meeting, [participant], new Map(), new Map(), 0, new Map([[1, lines]]))[0].items[0];
}

test("the trip fee and selected lodging are billed once; planned rental alone costs nothing", () => {
  const line = lineFor(overnight, [], { ...member, usesClubLodging: true });
  assert.equal(line.baseFee, 35_000);
  assert.equal(line.lodgingFee, 40_000);
  assert.equal(line.totalFee, 75_000);
  assert.deepEqual(line.dailyBreakdowns?.map((day) => day.totalFee), [0, 0]);
});

test("a day trip uses the meeting's own fee and has no daily breakdown", () => {
  const line = lineFor(dayTrip, [usage(1)]);
  assert.equal(line.baseFee, 35_000);
  assert.equal(line.surfUsageMemberFee, 0);
  assert.equal(line.totalFee, 35_000);
  assert.equal(line.dailyBreakdowns, undefined);
});

test("confirmed usage from both days is combined", () => {
  const line = lineFor(overnight, [lesson(1), { ...lesson(2), id: 201 }]);
  assert.equal(line.surfUsageMemberFee, 20_000);
  assert.equal(line.surfUsageShopFee, 100_000);
  assert.equal(line.totalFee, 55_000);
  assert.deepEqual(line.dailyBreakdowns?.map((day) => day.totalFee), [10_000, 10_000]);
});

test("a regular member gets equipment support for one day and pays the shop price on day two", () => {
  const line = lineFor(overnight, [usage(1), usage(2, { shopUnitPrice: 35_000 })]);
  assert.equal(line.surfUsageShopFee, 65_000);
  assert.equal(line.surfUsageMemberFee, 35_000);
  assert.equal(line.surfUsageCoveredFee, 30_000);
  assert.equal(line.totalFee, 70_000);
  assert.deepEqual(line.dailyBreakdowns?.map((day) => day.totalFee), [0, 35_000]);
});

test("support moves to day two when no equipment was used on day one", () => {
  const line = lineFor(overnight, [usage(2, { shopUnitPrice: 35_000 })]);
  assert.equal(line.surfUsageMemberFee, 0);
  assert.equal(line.surfUsageCoveredFee, 35_000);
  assert.equal(line.totalFee, 35_000);
});

test("a first-day lesson package uses the support before a second-day rental", () => {
  const line = lineFor(overnight, [lesson(1), usage(2, { shopUnitPrice: 35_000 })]);
  assert.equal(line.surfUsageShopFee, 85_000);
  assert.equal(line.surfUsageMemberFee, 45_000);
  assert.equal(line.surfUsageCoveredFee, 40_000);
  assert.equal(line.totalFee, 80_000);
});

test("unconfirmed usage is not billed", () => {
  const line = lineFor(dayTrip, [lesson(1)].map((item) => ({ ...item, confirmed: false })));
  assert.equal(line.surfUsageMemberFee, 0);
  assert.equal(line.surfUsageShopFee, 0);
});

test("the food support cap applies to each day of the trip", () => {
  const order = (id: number, createdAt: string) => ({
    id,
    participantId: 1,
    menuItemId: 1,
    menuOptionChoiceId: null,
    menuNameSnapshot: "라면",
    optionGroupNameSnapshot: null,
    optionChoiceLabelSnapshot: null,
    unitPriceSnapshot: 8_000,
    quantity: 1,
    preparingQuantity: 0,
    servedQuantity: 1,
    createdAt,
  });
  // 서울 기준 9/12 점심, 9/13 아침 (UTC 로 저장)
  const foodOrders = new Map([[1, [order(1, "2026-09-12T03:00:00.000Z"), order(2, "2026-09-12T22:30:00.000Z")]]]);
  const line = groupParticipantsForSettlement(overnight, [member], new Map(), foodOrders, 10_000)[0].items[0];
  assert.equal(line.foodSubtotal, 16_000);
  assert.equal(line.foodSupportApplied, 16_000);
  assert.equal(line.foodCharge, 0);
  assert.deepEqual(line.dailyBreakdowns?.map((day) => day.foodSubtotal), [8_000, 8_000]);
});

test("a companion pays the companion fee and the shop price", () => {
  const companion = { ...member, companionId: 7, companion: { id: 7, name: "동반", ownerKakaoId: "member-1", linkedKakaoId: null } };
  const groups = groupParticipantsForSettlement(dayTrip, [companion], new Map(), new Map(), 0, new Map([[1, [{ ...lesson(1), participantType: "COMPANION" as const }]]]));
  assert.equal(groups[0].recipientKakaoId, "member-1");
  assert.equal(groups[0].items[0].baseFee, 45_000);
  assert.equal(groups[0].items[0].surfUsageMemberFee, 50_000);
});
