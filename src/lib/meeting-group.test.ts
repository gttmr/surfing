import assert from "node:assert/strict";
import test from "node:test";
import {
  addDaysToDate,
  getOvernightMeetingSpan,
  hasOvernightMeetingCreateErrors,
  parseOvernightMeetingCreateInput,
  participantIdentity,
  toOvernightMeetingGroupSummary,
  validateOvernightMeetingCreate,
} from "./meeting-group";

test("overnight dates advance safely across month and year boundaries", () => {
  assert.equal(addDaysToDate("2026-08-31", 1), "2026-09-01");
  assert.equal(addDaysToDate("2026-12-31", 1), "2027-01-01");
});

test("overnight request parser derives two internal days from one trip span", () => {
  const parsed = parseOvernightMeetingCreateInput({
    meetingType: "정기",
    regularBaseFee: 35_000,
    companionBaseFee: 45_000,
    lodgingFee: 50_000,
    startDate: "2026-12-31",
    startTime: "07:00",
    endTime: "16:00",
    location: " 송지호 ",
    description: " 준비물 안내 ",
  });

  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.lodgingFee, 50_000);
  assert.deepEqual(parsed.value.days, [
    { date: "2026-12-31", startTime: "07:00", endTime: "23:59", location: "송지호", description: "준비물 안내" },
    { date: "2027-01-01", startTime: "00:00", endTime: "16:00", location: "송지호", description: "준비물 안내" },
  ]);
});

test("overnight request parser rejects invalid or partial trip spans", () => {
  assert.deepEqual(parseOvernightMeetingCreateInput({
    meetingType: "정기",
    regularBaseFee: 0,
    companionBaseFee: 0,
    lodgingFee: 0,
    startDate: "2026-02-31",
    startTime: "07:00",
    endTime: "18:00",
    location: "송지호",
  }), { ok: false, error: "날짜, 시간, 장소 입력을 확인해 주세요." });

  assert.deepEqual(parseOvernightMeetingCreateInput({
    meetingType: "정기",
    regularBaseFee: 0,
    companionBaseFee: 0,
    lodgingFee: 0,
    startDate: "2026-09-12",
    startTime: "07:00",
    endTime: "16:00",
  }), { ok: false, error: "날짜, 시간, 장소 입력을 확인해 주세요." });
});

test("overnight request parser keeps the previous two-day API compatible for open browser tabs", () => {
  const parsed = parseOvernightMeetingCreateInput({
    meetingType: "정기",
    regularBaseFee: 0,
    companionBaseFee: 0,
    days: [
      { date: "2026-09-12", startTime: "07:00", endTime: "22:00", location: "송지호" },
      { date: "2026-09-13", startTime: "08:00", endTime: "16:00", location: "송지호" },
    ],
  });

  assert.equal(parsed.ok, true);
  if (!parsed.ok) return;
  assert.equal(parsed.value.lodgingFee, 0);
  assert.equal(parsed.value.days[0].endTime, "22:00");
  assert.equal(parsed.value.days[1].startTime, "08:00");
});

test("overnight creation requires consecutive valid days and non-negative group fees", () => {
  const errors = validateOvernightMeetingCreate({
    meetingType: "정기",
    regularBaseFee: -1,
    companionBaseFee: 10_000,
    lodgingFee: -1,
    days: [
      { date: "2026-09-12", startTime: "07:00", endTime: "22:00", location: "송지호" },
      { date: "2026-09-14", startTime: "07:00", endTime: "18:00", location: "송지호" },
    ],
  }, "2026-08-26");

  assert.equal(errors.regularBaseFee, "회원 기본 참가비는 0원 이상의 정수로 입력해 주세요.");
  assert.equal(errors.lodgingFee, "1인 숙박비는 0원 이상의 정수로 입력해 주세요.");
  assert.equal(errors.days, "둘째 날은 첫째 날 바로 다음 날짜여야 합니다.");
  assert.equal(hasOvernightMeetingCreateErrors(errors), true);
});

test("overnight summary is emitted only for a complete two-day group", () => {
  const summary = toOvernightMeetingGroupSummary({
    id: 8,
    kind: "OVERNIGHT",
    regularBaseFee: 30_000,
    companionBaseFee: 40_000,
    lodgingFee: 50_000,
    meetings: [
      { id: 12, groupDayIndex: 2, date: "2026-09-13", startTime: "08:00", endTime: "17:00", location: "송지호" },
      { id: 11, groupDayIndex: 1, date: "2026-09-12", startTime: "07:00", endTime: "22:00", location: "송지호" },
    ],
  });

  assert.deepEqual(summary?.days.map((day) => day.id), [11, 12]);
  assert.equal(summary?.lodgingFee, 50_000);
  assert.deepEqual(summary && getOvernightMeetingSpan(summary), {
    startDate: "2026-09-12",
    endDate: "2026-09-13",
    startTime: "07:00",
    endTime: "17:00",
    location: "송지호",
  });
  assert.equal(participantIdentity("member-1", null), "member-1:self");
  assert.equal(participantIdentity("member-1", 4), "member-1:4");
});
