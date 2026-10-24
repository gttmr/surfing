import assert from "node:assert/strict";
import test from "node:test";
import {
  getActualUsageReviewAvailability,
  getBillingReadiness,
  getMeetingWorkflowStage,
  isMeetingEnded,
} from "./meeting-lifecycle";

const AFTER_MEETING = new Date("2026-08-22T23:00:00+09:00");

test("meeting end uses the Seoul meeting boundary", () => {
  assert.equal(isMeetingEnded("2026-08-22", "22:00", AFTER_MEETING), true);
  assert.equal(isMeetingEnded("2026-08-23", "22:00", AFTER_MEETING), false);
});

test("actual usage review opens only after the meeting and locks once billing is published", () => {
  assert.deepEqual(getActualUsageReviewAvailability({
    date: "2026-08-23",
    endTime: "22:00",
    now: AFTER_MEETING,
  }), {
    state: "WAITING",
    editable: false,
    reason: "모임 종료 후 실제 이용을 확인할 수 있습니다.",
  });

  assert.equal(getActualUsageReviewAvailability({
    date: "2026-08-22",
    endTime: "22:00",
    now: AFTER_MEETING,
  }).editable, true);

  assert.deepEqual(getActualUsageReviewAvailability({
    date: "2026-08-22",
    endTime: "22:00",
    billingPublishedAt: AFTER_MEETING,
    now: AFTER_MEETING,
  }), {
    state: "LOCKED",
    editable: false,
    reason: "청구가 공개되어 실제 이용 내역이 잠겼습니다.",
  });
});

test("an overnight trip ends on its last day", () => {
  const trip = { date: "2026-08-22", endDate: "2026-08-23", endTime: "18:00", now: AFTER_MEETING };
  assert.equal(getActualUsageReviewAvailability(trip).state, "WAITING");
  assert.equal(getMeetingWorkflowStage({ ...trip, isOpen: true, billingPublished: false }), "RECRUITING");
  const dayAfter = new Date("2026-08-23T19:00:00+09:00");
  assert.equal(getActualUsageReviewAvailability({ ...trip, now: dayAfter }).state, "OPEN");
});

test("billing readiness blocks every unresolved operational prerequisite", () => {
  const readiness = getBillingReadiness({
    now: AFTER_MEETING,
    meeting: { id: 13, date: "2026-08-22", endTime: "22:00" },
    participants: [
      { id: 1, status: "APPROVED" },
      { id: 2, status: "APPROVED" },
      { id: 3, status: "CANCELLED" },
    ],
    foodOrderItems: [{ quantity: 2, servedQuantity: 1, cancelledAt: null }],
  });

  assert.equal(readiness.ready, false);
  assert.deepEqual(
    readiness.checks.filter((check) => !check.complete).map((check) => check.id),
    ["food-resolved", "usage-resolved"]
  );
  assert.equal(
    readiness.checks.find((check) => check.id === "usage-resolved")?.detail,
    "2명의 실제 이용 내역을 확인해 주세요."
  );
});

test("a future empty meeting does not count post-meeting checks as completed", () => {
  const readiness = getBillingReadiness({
    now: AFTER_MEETING,
    meeting: { id: 14, date: "2026-09-12", endTime: "22:00" },
    participants: [],
    foodOrderItems: [],
  });

  assert.deepEqual(readiness.checks.filter((check) => check.complete), []);
  assert.equal(
    readiness.checks.find((check) => check.id === "usage-resolved")?.detail,
    "모임 종료 후 실제 이용 내역을 확인합니다."
  );
});

test("absent participants do not require a usage confirmation", () => {
  const readiness = getBillingReadiness({
    now: AFTER_MEETING,
    meeting: { id: 13, date: "2026-08-22", endTime: "22:00" },
    participants: [
      { id: 1, status: "APPROVED", usageConfirmedAt: AFTER_MEETING },
      { id: 2, status: "APPROVED", absentAt: AFTER_MEETING },
    ],
    foodOrderItems: [{ quantity: 1, servedQuantity: 1, cancelledAt: null }],
  });

  assert.equal(readiness.ready, true);
});

test("workflow names recruitment, evidence review, payment confirmation, and completion distinctly", () => {
  const base = { date: "2026-08-22", endTime: "22:00", isOpen: false, now: AFTER_MEETING };
  assert.equal(getMeetingWorkflowStage({ ...base, date: "2026-09-12", isOpen: true, billingPublished: false }), "RECRUITING");
  assert.equal(getMeetingWorkflowStage({ ...base, billingPublished: false }), "ACTUALS_REVIEW");
  assert.equal(getMeetingWorkflowStage({
    ...base,
    billingPublished: true,
    recipientCount: 4,
    verifiedRecipientCount: 2,
  }), "PAYMENT_CONFIRMATION");
  assert.equal(getMeetingWorkflowStage({
    ...base,
    billingPublished: true,
    recipientCount: 4,
    verifiedRecipientCount: 4,
  }), "FINAL_SETTLEMENT");
  assert.equal(getMeetingWorkflowStage({
    ...base,
    billingPublished: true,
    settlementCompletedAt: AFTER_MEETING,
  }), "COMPLETED");
});

test("the shop count check is reported but never blocks billing", () => {
  const base = {
    now: AFTER_MEETING,
    meeting: { id: 13, date: "2026-08-22", endTime: "22:00" },
    participants: [{ id: 1, status: "APPROVED", usageConfirmedAt: AFTER_MEETING }],
    foodOrderItems: [],
  };
  const unchecked = getBillingReadiness(base);
  assert.equal(unchecked.ready, true);
  assert.match(unchecked.checks.find((check) => check.id === "usage-resolved")?.detail ?? "", /샵 수량 확인은 아직/);

  const checked = getBillingReadiness({ ...base, meeting: { ...base.meeting, shopUsageCheckedAt: AFTER_MEETING } });
  assert.match(checked.checks.find((check) => check.id === "usage-resolved")?.detail ?? "", /샵도 수량을 확인/);
});

test("an admin can end a meeting before its scheduled end time", () => {
  const meeting = { date: "2026-10-24", endTime: "18:00", isOpen: false, billingPublished: false };
  const midday = new Date("2026-10-24T13:00:00+09:00");
  assert.equal(getMeetingWorkflowStage({ ...meeting, now: midday }), "UPCOMING");
  assert.equal(getMeetingWorkflowStage({ ...meeting, endedAt: midday, now: midday }), "ACTUALS_REVIEW");
  assert.equal(
    getMeetingWorkflowStage({ ...meeting, date: "2026-11-07", endedAt: midday, now: midday }),
    "ACTUALS_REVIEW",
  );
});
