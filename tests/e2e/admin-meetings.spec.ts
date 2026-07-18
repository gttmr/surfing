import { expect, test } from "@playwright/test";
import {
  verifyDisposableMeetingDelete,
  verifyMutationFailures,
  verifyRealMeetingCreate,
  verifyRealParticipantRoundTrip,
} from "./admin-meetings-scenarios";
import { assertAccessible, assertControlClearsDock, assertDialogChunkFitsParagraph, assertMobileGeometry, capture, prepareAdminContext } from "./admin-meetings-support";

test.beforeEach(async ({ context }) => {
  await prepareAdminContext(context);
});

test("R09 filters upcoming and past meetings and distinguishes empty search results", async ({ page }, testInfo) => {
  // Given a mixed upcoming and past meeting list
  await page.goto("/admin/meetings", { waitUntil: "networkidle" });
  await expect(page.getByText("합성 서핑 해변 A")).toBeVisible();
  const meetingOperationsLink = page.getByRole("link", { name: /합성 서핑 해변 A 모임 운영/ });
  await expect(meetingOperationsLink).toHaveAttribute("href", "/admin/meetings/8101");
  await expect(meetingOperationsLink.locator("span").filter({ hasText: "모임 운영" }).first()).toBeVisible();
  await capture(page, "list-upcoming", testInfo.project.name);

  // When the admin selects the past workspace
  await page.getByRole("button", { name: /지난 모임 1/ }).click();

  // Then only the past fixture is presented
  await expect(page.getByText("합성 서핑 해변 C")).toBeVisible();
  await expect(page.getByText("합성 서핑 해변 A")).toBeHidden();
  await capture(page, "list-past", testInfo.project.name);

  // When the admin searches for a missing meeting
  await page.getByRole("searchbox", { name: "모임 검색" }).fill("없는 해변");

  // Then a no-result state is explicit and the query remains editable
  await expect(page.getByRole("status")).toContainText("검색 결과가 없습니다");
  await expect(page.getByRole("searchbox", { name: "모임 검색" })).toHaveValue("없는 해변");
  await capture(page, "list-no-result", testInfo.project.name);
  await assertMobileGeometry(page);
  await assertAccessible(page);
});

test("R09 validates creation before POST and retains the draft on server failure", async ({ page }, testInfo) => {
  // Given the separate create workspace and a POST observer
  let createRequests = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/api/meetings") createRequests += 1;
  });
  await page.goto("/admin/meetings", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "새 모임" }).click();

  // When an empty and then an invalid-time draft is submitted
  await page.getByRole("button", { name: "모임 생성" }).click();
  await expect(page.getByText("날짜를 선택해 주세요.")).toBeVisible();
  await expect(page.getByLabel("날짜")).toBeFocused();
  await capture(page, "create-required-validation", testInfo.project.name);
  await page.getByLabel("날짜").fill("2099-08-15");
  await page.getByLabel("시작 시간").fill("14:00");
  await page.getByLabel("종료 시간").fill("13:00");
  await page.getByLabel("장소").fill("실패 뒤에도 남을 해변");
  await page.getByRole("button", { name: "모임 생성" }).click();

  // Then validation is visible and no mutation was attempted
  await expect(page.getByText("종료 시간은 시작 시간보다 늦어야 합니다.")).toBeVisible();
  await expect(page.getByLabel("종료 시간")).toBeFocused();
  expect(createRequests).toBe(0);
  await capture(page, "create-time-validation", testInfo.project.name);

  // When a valid draft receives a server failure
  await page.getByLabel("종료 시간").fill("15:00");
  await page.route("**/api/meetings", (route) => route.fulfill({
    status: 500,
    contentType: "application/json",
    body: JSON.stringify({ error: "합성 생성 오류" }),
  }));
  await page.getByRole("button", { name: "모임 생성" }).click();

  // Then the server error and complete draft remain in the create workspace
  await expect(page.getByRole("alert").filter({ hasText: "합성 생성 오류" })).toBeVisible();
  await expect(page.getByLabel("장소")).toHaveValue("실패 뒤에도 남을 해변");
  await expect(page.getByLabel("종료 시간")).toHaveValue("15:00");
  await capture(page, "create-error-retained", testInfo.project.name);
  await assertMobileGeometry(page);
  await assertControlClearsDock(page, page.getByRole("button", { name: "모임 생성" }));
  await capture(page, "create-dock-clearance", testInfo.project.name);
  await assertAccessible(page);
});

test("R10 exposes counted tabs, participant search, and read-only expansion", async ({ page }, testInfo) => {
  // Given the dense meeting detail and a participant mutation observer
  let participantWrites = 0;
  page.on("request", (request) => {
    if (request.method() === "PUT" && /\/api\/participants\/\d+$/.test(new URL(request.url()).pathname)) participantWrites += 1;
  });
  await page.goto("/admin/meetings/8101", { waitUntil: "networkidle" });

  // When the admin inspects tab counts and expands participant details
  const tabs = page.getByRole("tablist", { name: "참가자 상태" });
  await expect(tabs.getByRole("tab", { name: "참가 확정 30" })).toBeVisible();
  await expect(tabs.getByRole("tab", { name: "대기자 3" })).toBeVisible();
  await expect(tabs.getByRole("tab", { name: "취소됨 2" })).toBeVisible();
  await expect(tabs.getByRole("tab", { name: "전체 35" })).toBeVisible();
  await expect(page.getByRole("tabpanel")).toHaveCount(1);
  await capture(page, "participant-counts", testInfo.project.name);
  await page.getByRole("searchbox", { name: "참가자 검색" }).fill("합성 회원 01");
  await page.getByText("합성 회원 01", { exact: true }).first().click();

  // Then expansion reveals facts without mutating participant state
  await expect(page.getByText("카카오 닉네임").first()).toBeVisible();
  expect(participantWrites).toBe(0);
  await capture(page, "participant-detail", testInfo.project.name);
  await assertControlClearsDock(page, page.getByRole("button", { name: "합성 회원 01 참가 취소" }));
  await capture(page, "participant-dock-clearance", testInfo.project.name);

  // When the admin searches within the active tab
  await page.getByRole("searchbox", { name: "참가자 검색" }).fill("서른다섯 번째");

  // Then the active tab shows an explicit no-result state
  await expect(page.getByRole("tabpanel")).toContainText("검색 결과가 없습니다");
  await capture(page, "participant-search", testInfo.project.name);
  await assertMobileGeometry(page);
  await assertAccessible(page);
});

test("R10 participant cancellation requires a named consequence and restores trigger focus", async ({ page }, testInfo) => {
  // Given an approved participant
  let participantWrites = 0;
  page.on("request", (request) => {
    if (request.method() === "PUT" && /\/api\/participants\/\d+$/.test(new URL(request.url()).pathname)) participantWrites += 1;
  });
  await page.goto("/admin/meetings/8101", { waitUntil: "networkidle" });
  const cancelTrigger = page.getByRole("button", { name: "합성 회원 01 참가 취소" });

  // When cancellation is requested and then dismissed
  await cancelTrigger.click();
  const dialog = page.getByRole("dialog", { name: "참가를 취소할까요?" });
  await expect(dialog.getByRole("button", { name: "닫기" })).toBeFocused();

  // Then the meeting, participant, and consequence are named
  await expect(dialog).toContainText("합성 서핑 해변 A");
  await expect(dialog).toContainText("합성 회원 01");
  await expect(dialog).toContainText("패널티와 다른 참가자 상태는 바뀌지 않습니다");
  const cancelParticipantName = dialog.locator('[data-dialog-chunk="participant-name"]');
  const cancelAction = dialog.locator('[data-dialog-chunk="participant-action"]');
  await expect(cancelParticipantName).toHaveText("합성 회원 01님");
  await expect(cancelAction).toHaveText("참가를 취소합니다");
  await assertDialogChunkFitsParagraph(cancelParticipantName);
  await assertDialogChunkFitsParagraph(cancelAction);
  await capture(page, "cancel-confirmation", testInfo.project.name);
  await assertAccessible(page);
  await dialog.getByRole("button", { name: "돌아가기" }).click();
  await expect(cancelTrigger).toBeFocused();
  expect(participantWrites).toBe(0);
});

test("R10 successful participant cancellation closes the dialog without losing focus", async ({ page }) => {
  // Given a participant mutation and reload isolated at the HTTP boundary
  await page.goto("/admin/meetings/8101", { waitUntil: "networkidle" });
  await page.route("**/api/participants/8801", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ id: 8801, status: "CANCELLED" }),
  }));
  const cancelTrigger = page.getByRole("button", { name: "합성 회원 01 참가 취소" });
  await cancelTrigger.click();

  // When the named cancellation is confirmed
  await page.getByRole("dialog", { name: "참가를 취소할까요?" }).getByRole("button", { name: "참가 취소" }).click();

  // Then the semantic dialog closes and its trigger regains focus
  await expect(page.getByRole("dialog", { name: "참가를 취소할까요?" })).toBeHidden();
  await expect(cancelTrigger).toBeFocused();
});

test("R10 every participant tab has a distinct empty state", async ({ page }, testInfo) => {
  // Given a loaded meeting whose reload has no participants
  await page.goto("/admin/meetings/8101", { waitUntil: "networkidle" });
  await page.route("**/api/meetings/8101", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      id: 8101,
      date: "2099-08-15",
      startTime: "09:30",
      endTime: "13:00",
      location: "합성 빈 해변",
      description: null,
      isOpen: true,
      meetingType: "정기",
      participants: [],
      approvedCount: 0,
    }),
  }));

  // When each semantic tab is selected
  await page.getByRole("button", { name: "모임 정보 새로고침" }).click();

  // Then every panel names its own empty state
  await expect(page.getByRole("tabpanel")).toContainText("확정된 참가자가 없습니다");
  await capture(page, "empty-approved", testInfo.project.name);
  await page.getByRole("tab", { name: "대기자 0" }).click();
  await expect(page.getByRole("tabpanel")).toContainText("대기 중인 참가자가 없습니다");
  await capture(page, "empty-waitlisted", testInfo.project.name);
  await page.getByRole("tab", { name: "취소됨 0" }).click();
  await expect(page.getByRole("tabpanel")).toContainText("취소된 참가자가 없습니다");
  await capture(page, "empty-cancelled", testInfo.project.name);
  await page.getByRole("tab", { name: "전체 0" }).click();
  await expect(page.getByRole("tabpanel")).toContainText("아직 신청한 참가자가 없습니다");
  await capture(page, "empty-all", testInfo.project.name);
  await assertMobileGeometry(page);
  await assertAccessible(page);
});

test("R10 participant restore and meeting delete require action-specific confirmation", async ({ page }, testInfo) => {
  // Given a cancelled participant and a meeting detail
  let participantWrites = 0;
  let meetingDeletes = 0;
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (request.method() === "PUT" && /\/api\/participants\/\d+$/.test(url.pathname)) participantWrites += 1;
    if (request.method() === "DELETE" && url.pathname === "/api/meetings/8101") meetingDeletes += 1;
  });
  await page.goto("/admin/meetings/8101", { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "취소됨 2" }).click();

  // When restore is requested
  const restoreTrigger = page.getByRole("button", { name: /참가 복구/ }).first();
  await restoreTrigger.click();

  // Then restore names the meeting and approval consequence, and cancel restores focus
  const restoreDialog = page.getByRole("dialog", { name: "참가를 복구할까요?" });
  await expect(restoreDialog.getByRole("button", { name: "닫기" })).toBeFocused();
  await expect(restoreDialog).toContainText("합성 서핑 해변 A");
  await expect(restoreDialog).toContainText("참가 확정 상태로 복구합니다");
  const restoreParticipantName = restoreDialog.locator('[data-dialog-chunk="participant-name"]');
  const restoreAction = restoreDialog.locator('[data-dialog-chunk="participant-action"]');
  await expect(restoreParticipantName).toHaveText("합성 회원 34님");
  await expect(restoreAction).toHaveText("참가 확정 상태로 복구합니다");
  await assertDialogChunkFitsParagraph(restoreParticipantName);
  await assertDialogChunkFitsParagraph(restoreAction);
  await capture(page, "restore-confirmation", testInfo.project.name);
  await restoreDialog.getByRole("button", { name: "돌아가기" }).click();
  await expect(restoreTrigger).toBeFocused();

  // When meeting deletion is requested
  const deleteTrigger = page.getByRole("button", { name: "모임 삭제" });
  await deleteTrigger.click();

  // Then deletion names the meeting and irreversible related-data consequence
  const deleteDialog = page.getByRole("dialog", { name: "모임을 삭제할까요?" });
  await expect(deleteDialog.getByRole("button", { name: "닫기" })).toBeFocused();
  await expect(deleteDialog).toContainText("합성 서핑 해변 A");
  await expect(deleteDialog).toContainText(/참가.*운영 기록도 함께 삭제되며 복구할 수 없습니다/);
  await capture(page, "delete-confirmation", testInfo.project.name);
  await assertAccessible(page);
  await deleteDialog.getByRole("button", { name: "돌아가기" }).click();
  await expect(deleteTrigger).toBeFocused();
  expect(participantWrites).toBe(0);
  expect(meetingDeletes).toBe(0);
});

test("R10 reload failure keeps navigation and invalid IDs use admin not-found", async ({ page }, testInfo) => {
  // Given a loaded meeting whose next reload fails
  await page.goto("/admin/meetings/8101", { waitUntil: "networkidle" });
  await page.route("**/api/meetings/8101", (route) => route.fulfill({
    status: 500,
    contentType: "application/json",
    body: JSON.stringify({ error: "합성 갱신 오류" }),
  }));

  // When the admin reloads the detail
  await page.getByRole("button", { name: "모임 정보 새로고침" }).click();

  // Then retry and admin navigation remain available
  await expect(page.getByRole("status")).toContainText("합성 갱신 오류");
  await expect(page.getByRole("button", { name: "다시 시도" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "관리자 메뉴" })).toBeVisible();
  await capture(page, "reload-error", testInfo.project.name);
  await assertMobileGeometry(page);
  await assertAccessible(page);

  // When an invalid meeting ID is opened
  await page.unroute("**/api/meetings/8101");
  await page.goto("/admin/meetings/not-a-number", { waitUntil: "networkidle" });

  // Then the admin not-found path preserves a useful exit
  await expect(page.getByRole("heading", { name: "관리 항목을 찾을 수 없어요" })).toBeVisible();
  await expect(page.getByRole("link", { name: "모임 관리로 이동" })).toHaveAttribute("href", "/admin/meetings");
  await capture(page, "invalid-id", testInfo.project.name);
  await assertAccessible(page);
});

test("R10 mutation failures retain the cancel, restore, and delete dialogs", verifyMutationFailures);
test("R09 creates a real synthetic meeting and returns it to the relevant list", verifyRealMeetingCreate);
test("R10 performs a real participant cancel and restore round trip", verifyRealParticipantRoundTrip);
test("R10 deletes only the disposable empty meeting through the real API", verifyDisposableMeetingDelete);
