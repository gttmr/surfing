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

test("actual usage review opens only after the meeting and locks when billing review starts", () => {
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
    billingReviewConfirmedAt: AFTER_MEETING,
    now: AFTER_MEETING,
  }), {
    state: "LOCKED",
    editable: false,
    reason: "청구 검토가 시작되어 실제 이용 내역이 잠겼습니다.",
  });
});

test("billing readiness blocks every unresolved operational prerequisite", () => {
  const readiness = getBillingReadiness({
    now: AFTER_MEETING,
    meeting: {
      id: 13,
      date: "2026-08-22",
      endTime: "22:00",
      isOpen: true,
      billingReviewConfirmedAt: null,
    },
    participants: [
      { id: 1, status: "APPROVED", attendanceStatus: "PENDING" },
      { id: 2, status: "APPROVED", attendanceStatus: "ATTENDED" },
      { id: 3, status: "CANCELLED", attendanceStatus: "PENDING" },
    ],
    foodOrderItems: [{ quantity: 2, servedQuantity: 1, cancelledAt: null }],
    usageSubmissions: [],
  });

  assert.equal(readiness.ready, false);
  assert.deepEqual(
    readiness.checks.filter((check) => !check.complete).map((check) => check.id),
    ["registration-closed", "attendance-resolved", "food-resolved", "usage-resolved", "billing-reviewed"]
  );
  assert.equal(
    readiness.checks.find((check) => check.id === "registration-closed")?.href,
    "/admin/meetings/13#meeting-operations"
  );
  assert.equal(
    readiness.checks.find((check) => check.id === "attendance-resolved")?.href,
    "/admin/meetings/13#participants"
  );
});

test("a future empty meeting does not count post-meeting checks as completed", () => {
  const readiness = getBillingReadiness({
    now: AFTER_MEETING,
    meeting: {
      id: 14,
      date: "2026-09-12",
      endTime: "22:00",
      isOpen: true,
      billingReviewConfirmedAt: null,
    },
    participants: [],
    foodOrderItems: [],
    usageSubmissions: [],
  });

  assert.deepEqual(readiness.checks.filter((check) => check.complete), []);
  assert.equal(
    readiness.checks.find((check) => check.id === "attendance-resolved")?.detail,
    "모임 종료 후 참석 상태를 확인합니다."
  );
});

test("absent participants do not require a usage confirmation", () => {
  const readiness = getBillingReadiness({
    now: AFTER_MEETING,
    meeting: {
      id: 13,
      date: "2026-08-22",
      endTime: "22:00",
      isOpen: false,
      billingReviewConfirmedAt: AFTER_MEETING,
    },
    participants: [
      { id: 1, status: "APPROVED", attendanceStatus: "ATTENDED" },
      { id: 2, status: "APPROVED", attendanceStatus: "ABSENT" },
    ],
    foodOrderItems: [{ quantity: 1, servedQuantity: 1, cancelledAt: null }],
    usageSubmissions: [{ participantId: 1, status: "CONFIRMED", confirmedAt: AFTER_MEETING }],
  });

  assert.equal(readiness.ready, true);
});

test("workflow names recruitment, evidence review, payment confirmation, and completion distinctly", () => {
  assert.equal(getMeetingWorkflowStage({
    date: "2026-09-12",
    endTime: "22:00",
    isOpen: true,
    settlementOpen: false,
    now: AFTER_MEETING,
  }), "RECRUITING");
  assert.equal(getMeetingWorkflowStage({
    date: "2026-08-22",
    endTime: "22:00",
    isOpen: false,
    settlementOpen: false,
    billingEvidenceReady: false,
    now: AFTER_MEETING,
  }), "ACTUALS_REVIEW");
  assert.equal(getMeetingWorkflowStage({
    date: "2026-08-22",
    endTime: "22:00",
    isOpen: false,
    settlementOpen: true,
    recipientCount: 4,
    verifiedRecipientCount: 2,
    now: AFTER_MEETING,
  }), "PAYMENT_CONFIRMATION");
  assert.equal(getMeetingWorkflowStage({
    date: "2026-08-22",
    endTime: "22:00",
    isOpen: false,
    settlementOpen: true,
    settlementCompletedAt: AFTER_MEETING,
    now: AFTER_MEETING,
  }), "COMPLETED");
});
