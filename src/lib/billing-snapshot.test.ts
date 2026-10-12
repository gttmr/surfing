import assert from "node:assert/strict";
import test from "node:test";
import { buildMeetingBillingSnapshot, isMeetingBillingSnapshotPayload } from "./billing-snapshot";
import type { MeetingBillingSnapshotSource } from "./billing-snapshot";

const DATA: MeetingBillingSnapshotSource = {
  meeting: {
    id: 13,
    date: "2026-08-22",
    startTime: "07:00",
    endTime: "22:00",
    location: "고성",
    endDate: null,
  },
  participants: [
    {
      id: 1,
      name: "회원",
      kakaoId: "member-1",
      companionId: null,
      hasLesson: false,
      hasBus: false,
      hasRental: true,
      usesClubLodging: false,
      adjustments: [],
      foodOrders: [],
      surfUsageLines: [],
      breakdown: {
        baseFee: 35000,
        lodgingFee: 0,
        lessonFee: 0,
        rentalFee: 0,
        surfUsageShopFee: 30000,
        surfUsageMemberFee: 0,
        surfUsageCoveredFee: 30000,
        adjustmentFee: 0,
        foodSubtotal: 10000,
        foodSupportApplied: 10000,
        foodCharge: 0,
        totalFee: 35000,
      },
    },
  ],
  surfUsageSummary: {
    shopChargeAmount: 30000,
    memberChargeAmount: 0,
    operationsCoveredAmount: 30000,
  },
  recipients: [
    {
      recipientKakaoId: "member-1",
      recipientName: "회원",
      recipientType: "self",
      items: [{
        participantId: 1,
        participantName: "회원",
        recipientType: "self",
        memberType: "REGULAR",
        companionId: null,
        adjustments: [],
        foodOrders: [],
        surfUsageLines: [],
        baseFee: 35000,
        lodgingFee: 0,
        lessonFee: 0,
        rentalFee: 0,
        surfUsageShopFee: 30000,
        surfUsageMemberFee: 0,
        surfUsageCoveredFee: 30000,
        adjustmentFee: 0,
        foodSubtotal: 10000,
        foodSupportApplied: 10000,
        foodCharge: 0,
        totalFee: 35000,
      }],
      totalFee: 35000,
      reported: false,
      reportedAt: null,
      verified: false,
      verifiedAt: null,
      completed: false,
      completedAt: null,
    },
  ],
};

test("billing publication freezes recipient lines and separates money perspectives", () => {
  const snapshot = buildMeetingBillingSnapshot(DATA);

  assert.equal(snapshot.totals.memberChargeTotal, 35000);
  assert.equal(snapshot.totals.shopPayableTotal, 30000);
  assert.equal(snapshot.totals.foodPayableTotal, 10000);
  assert.equal(snapshot.totals.clubSupportTotal, 40000);
  assert.equal(snapshot.payload.recipients[0].items[0].surfUsageCoveredFee, 30000);
  assert.equal(isMeetingBillingSnapshotPayload(snapshot.payload), true);
});

test("billing snapshot guard refuses incomplete values", () => {
  assert.equal(isMeetingBillingSnapshotPayload({ version: 1, recipients: [] }), false);
});

test("an overnight snapshot keeps the trip's end date", () => {
  const snapshot = buildMeetingBillingSnapshot({
    ...DATA,
    meeting: { ...DATA.meeting, date: "2026-09-12", endDate: "2026-09-13" },
  });
  assert.equal(snapshot.payload.version, 1);
  assert.equal(snapshot.payload.meeting.endDate, "2026-09-13");
  assert.equal(isMeetingBillingSnapshotPayload(snapshot.payload), true);
});

test("snapshots published when overnight days were separate meetings are still readable", () => {
  const legacy = {
    version: 2,
    meeting: DATA.meeting,
    participants: [],
    recipients: [],
    surfUsageSummary: { shopChargeAmount: 0, memberChargeAmount: 0, operationsCoveredAmount: 0 },
    overnightGroup: { days: [{ date: "2026-09-12" }, { date: "2026-09-13" }] },
  };
  assert.equal(isMeetingBillingSnapshotPayload(legacy), true);
});
