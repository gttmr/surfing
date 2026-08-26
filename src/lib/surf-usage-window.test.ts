import assert from "node:assert/strict";
import test from "node:test";
import { isParticipantActualUsageOpen } from "./surf-usage-data";

test("single-day actual usage remains limited to the meeting date", () => {
  assert.equal(isParticipantActualUsageOpen({ date: "2026-09-12", meetingGroupId: null }, "2026-09-12"), true);
  assert.equal(isParticipantActualUsageOpen({ date: "2026-09-12", meetingGroupId: null }, "2026-09-13"), false);
});

test("overnight daily actual usage opens on its date and remains editable until confirmation", () => {
  assert.equal(isParticipantActualUsageOpen({ date: "2026-09-12", meetingGroupId: 3 }, "2026-09-11"), false);
  assert.equal(isParticipantActualUsageOpen({ date: "2026-09-12", meetingGroupId: 3 }, "2026-09-12"), true);
  assert.equal(isParticipantActualUsageOpen({ date: "2026-09-12", meetingGroupId: 3 }, "2026-09-13"), true);
  assert.equal(isParticipantActualUsageOpen({ date: "2026-09-13", meetingGroupId: 3 }, "2026-09-12"), false);
});
