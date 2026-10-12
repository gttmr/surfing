import assert from "node:assert/strict";
import test from "node:test";
import { isParticipantActualUsageOpen } from "./surf-usage-data";

test("day-trip actual usage is limited to the meeting date", () => {
  assert.equal(isParticipantActualUsageOpen({ date: "2026-09-12", endDate: null }, "2026-09-12"), true);
  assert.equal(isParticipantActualUsageOpen({ date: "2026-09-12", endDate: null }, "2026-09-11"), false);
  assert.equal(isParticipantActualUsageOpen({ date: "2026-09-12", endDate: null }, "2026-09-13"), false);
});

test("overnight actual usage stays open from the first day through the last day", () => {
  const trip = { date: "2026-09-12", endDate: "2026-09-13" };
  assert.equal(isParticipantActualUsageOpen(trip, "2026-09-11"), false);
  assert.equal(isParticipantActualUsageOpen(trip, "2026-09-12"), true);
  assert.equal(isParticipantActualUsageOpen(trip, "2026-09-13"), true);
  assert.equal(isParticipantActualUsageOpen(trip, "2026-09-14"), false);
});
