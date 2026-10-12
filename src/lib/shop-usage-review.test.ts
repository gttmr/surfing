import assert from "node:assert/strict";
import test from "node:test";
import {
  isShopUsageDraftDirty,
  selectShopUsageParticipants,
  type ShopUsageDrafts,
  type ShopUsageParticipant,
} from "../components/shop/shop-usage-review";
import { isShopMeetingSurfUsageData } from "../components/shop/shop-usage-response";
import type { ShopMeetingSurfUsageData } from "./surf-usage-data";

const participants: readonly ShopUsageParticipant[] = [
  {
    participantId: 1,
    participantName: "합성 회원 01",
    companionId: null,
    requestedOptionLabel: "강습과 보드 대여",
    requestedByDay: ["LESSON_PACKAGE"],
    submissionStatus: "missing",
    submittedAt: null,
    confirmedAt: null,
    shopAmount: 0,
    entries: [],
  },
  {
    participantId: 2,
    participantName: "합성 회원 02",
    companionId: null,
    requestedOptionLabel: "샤워만 이용",
    requestedByDay: [null],
    submissionStatus: "submitted",
    submittedAt: "2026-07-15T01:00:00.000Z",
    confirmedAt: null,
    shopAmount: 10_000,
    entries: [],
  },
  {
    participantId: 3,
    participantName: "합성 회원 03",
    companionId: null,
    requestedOptionLabel: "개인 장비",
    requestedByDay: [null],
    submissionStatus: "confirmed",
    submittedAt: "2026-07-15T01:00:00.000Z",
    confirmedAt: "2026-07-15T02:00:00.000Z",
    shopAmount: 20_000,
    entries: [],
  },
];

test("shop usage review defaults to actionable participants and filters every status exactly", () => {
  assert.deepEqual(
    selectShopUsageParticipants(participants, { filter: "actionable", query: "" }).map((row) => row.participantId),
    [2, 1],
  );
  assert.deepEqual(
    selectShopUsageParticipants(participants, { filter: "missing", query: "" }).map((row) => row.participantId),
    [1],
  );
  assert.deepEqual(
    selectShopUsageParticipants(participants, { filter: "submitted", query: "" }).map((row) => row.participantId),
    [2],
  );
  assert.deepEqual(
    selectShopUsageParticipants(participants, { filter: "confirmed", query: "" }).map((row) => row.participantId),
    [3],
  );
});

test("shop usage review searches participant names and request labels", () => {
  assert.deepEqual(
    selectShopUsageParticipants(participants, { filter: "actionable", query: "회원 02" }).map((row) => row.participantId),
    [2],
  );
  assert.deepEqual(
    selectShopUsageParticipants(participants, { filter: "actionable", query: "보드 대여" }).map((row) => row.participantId),
    [1],
  );
});

test("shop usage review marks only active-item differences as dirty", () => {
  const savedDrafts: ShopUsageDrafts = { 1: { "1:10": 1, "1:20": 4, "1:30": 2 } };
  const localDrafts: ShopUsageDrafts = { 1: { "1:10": 2, "1:20": 4, "1:30": 9 } };
  assert.equal(isShopUsageDraftDirty(1, ["1:10", "1:20"], savedDrafts, localDrafts), true);
  assert.equal(isShopUsageDraftDirty(1, ["1:20"], savedDrafts, localDrafts), false);
});

const validUsageResponse = {
  meeting: {
    id: 8101,
    date: "2026-07-15",
    startTime: "09:30",
    endTime: "13:00",
    location: "합성 해변",
    days: [{ dayIndex: 1, date: "2026-07-15" }],
    shopUsageCheckedAt: null,
    actualUsageReview: {
      state: "OPEN",
      editable: true,
      reason: "참석자의 실제 이용 내역을 확인해 주세요.",
    },
  },
  usageItems: [{
    id: 10,
    name: "장비 대여",
    description: null,
    serviceType: "EQUIPMENT_RENTAL",
    shopPrice: 30_000,
    isActive: true,
    displayOrder: 1,
  }],
  summary: {
    approvedCount: 1,
    submittedCount: 1,
    missingCount: 0,
    reviewCount: 0,
    confirmedCount: 1,
    submittedShopAmount: 30_000,
    confirmedShopAmount: 30_000,
  },
  itemRows: [{
    usageItemId: 10,
    name: "장비 대여",
    serviceType: "EQUIPMENT_RENTAL",
    quantity: 1,
    amount: 30_000,
    confirmedQuantity: 1,
    confirmedAmount: 30_000,
    confirmedQuantityByDay: [1],
  }],
  participantRows: [{
    participantId: 1,
    participantName: "합성 회원",
    companionId: null,
    requestedOptionLabel: "장비 대여",
    requestedByDay: ["EQUIPMENT_RENTAL"],
    submissionStatus: "confirmed",
    submittedAt: "2026-07-15T01:00:00.000Z",
    confirmedAt: "2026-07-15T02:00:00.000Z",
    shopAmount: 30_000,
    entries: [{
      id: 20,
      day: 1,
      usageItemId: 10,
      usageItemName: "장비 대여",
      serviceType: "EQUIPMENT_RENTAL",
      quantity: 1,
      shopUnitPrice: 30_000,
      amount: 30_000,
      source: "shop",
    }],
  }],
} satisfies ShopMeetingSurfUsageData;

test("shop usage response guard accepts complete data and rejects incomplete payloads", () => {
  assert.equal(isShopMeetingSurfUsageData(validUsageResponse), true);
  assert.equal(isShopMeetingSurfUsageData({
    meeting: { id: 8101 },
    summary: { missingCount: 0, reviewCount: 0, confirmedCount: 0 },
    usageItems: [],
    itemRows: [],
    participantRows: [],
  }), false);
});

test("a participant with no record is prefilled per day from the signup, and 1박 day two counts separately", async () => {
  const { buildUsageDraft } = await import("./surf-usage-slots");
  const days = [{ dayIndex: 1 }, { dayIndex: 2 }];
  const items = [{ id: 1, serviceType: "LESSON_PACKAGE" }, { id: 2, serviceType: "EQUIPMENT_RENTAL" }];
  assert.deepEqual(
    buildUsageDraft({ submissionStatus: "missing", entries: [], requestedByDay: ["LESSON_PACKAGE", "EQUIPMENT_RENTAL"] }, days, items),
    { "1:1": 1, "1:2": 0, "2:1": 0, "2:2": 1 },
  );
  assert.deepEqual(
    buildUsageDraft({ submissionStatus: "submitted", entries: [{ day: 2, usageItemId: 2, quantity: 2 }], requestedByDay: ["LESSON_PACKAGE", null] }, days, items),
    { "1:1": 0, "1:2": 0, "2:1": 0, "2:2": 2 },
  );
});
