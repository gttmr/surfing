import assert from "node:assert/strict";
import test from "node:test";
import { formatCalendarDateLabel, moveCalendarDate } from "./home-view";
import { validateMeetingCreate } from "./meeting-create-form";

test("calendar keyboard navigation keeps date semantics across weeks and months", () => {
  assert.equal(moveCalendarDate("2026-07-14", "ArrowRight"), "2026-07-15");
  assert.equal(moveCalendarDate("2026-07-14", "ArrowDown"), "2026-07-21");
  assert.equal(moveCalendarDate("2026-07-14", "Home"), "2026-07-12");
  assert.equal(moveCalendarDate("2026-07-14", "End"), "2026-07-18");
  assert.equal(moveCalendarDate("2026-03-31", "PageDown"), "2026-04-30");
});

test("calendar labels expose the full Korean date and visual states", () => {
  const label = formatCalendarDateLabel("2026-07-14", { selected: true, today: true, hasMeeting: true });
  assert.match(label, /2026년 7월 14일 화요일/);
  assert.match(label, /오늘, 선택됨, 모임 있음/);
});

test("meeting creation validation links each error to its field", () => {
  assert.deepEqual(validateMeetingCreate({ date: "", startTime: "", endTime: "", location: "" }, "2026-07-14"), {
    date: "날짜를 선택해 주세요.",
    startTime: "시작 시간을 입력해 주세요.",
    endTime: "종료 시간을 입력해 주세요.",
    location: "장소를 입력해 주세요.",
  });
  assert.deepEqual(validateMeetingCreate({ date: "2026-07-15", startTime: "11:00", endTime: "10:00", location: "해변" }, "2026-07-14"), {
    endTime: "종료 시간은 시작 시간보다 늦어야 합니다.",
  });
});
