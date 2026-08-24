import { expect, type Page, type TestInfo } from "@playwright/test";
import { assertAccessible, assertMobileGeometry, capture } from "./admin-meetings-support";

type AdminPageFixture = {
  readonly page: Page;
};

function meetingIdFromBody(body: unknown): number {
  if (typeof body !== "object" || body === null || !("id" in body) || typeof body.id !== "number") {
    throw new Error("created meeting response is missing a numeric id");
  }
  return body.id;
}

export async function verifyMutationFailures({ page }: AdminPageFixture, testInfo: TestInfo): Promise<void> {
  await page.goto("/admin/meetings/8103", { waitUntil: "networkidle" });
  await page.route("**/api/participants/8838", (route) => route.fulfill({
    status: 400,
    contentType: "application/json",
    body: JSON.stringify({ error: "합성 취소 거절" }),
  }));
  const cancelTrigger = page.getByRole("button", { name: "합성 회원 01 참가 취소" });
  await cancelTrigger.click();
  const cancelDialog = page.getByRole("dialog", { name: "참가를 취소할까요?" });
  await cancelDialog.getByRole("button", { name: "참가 취소" }).click();
  await expect(cancelDialog.getByRole("alert")).toContainText("합성 취소 거절");
  await capture(page, "cancel-error-400", testInfo.project.name);
  await cancelDialog.getByRole("button", { name: "돌아가기" }).click();
  await expect(cancelTrigger).toBeFocused();
  await page.unroute("**/api/participants/8838");

  await page.goto("/admin/meetings/8101", { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: "취소됨 2" }).click();
  const restoreTrigger = page.getByRole("button", { name: /참가 복구/ }).first();
  await page.route("**/api/participants/8834", (route) => route.fulfill({
    status: 404,
    contentType: "application/json",
    body: JSON.stringify({ error: "합성 복구 대상 없음" }),
  }));
  await restoreTrigger.click();
  const restoreDialog = page.getByRole("dialog", { name: "참가를 복구할까요?" });
  await restoreDialog.getByRole("button", { name: "참가 복구" }).click();
  await expect(restoreDialog.getByRole("alert")).toContainText("합성 복구 대상 없음");
  await capture(page, "restore-error-404", testInfo.project.name);
  await restoreDialog.getByRole("button", { name: "돌아가기" }).click();
  await expect(restoreTrigger).toBeFocused();
  await page.unroute("**/api/participants/8834");

  const deleteTrigger = page.getByRole("button", { name: "모임 삭제" });
  await page.route("**/api/meetings/8101", (route) => route.fulfill({
    status: 500,
    contentType: "application/json",
    body: JSON.stringify({ error: "합성 삭제 오류" }),
  }));
  await deleteTrigger.click();
  const deleteDialog = page.getByRole("dialog", { name: "모임을 삭제할까요?" });
  await deleteDialog.getByRole("button", { name: "모임 삭제" }).click();
  await expect(deleteDialog.getByRole("alert")).toContainText("합성 삭제 오류");
  await capture(page, "delete-error-500", testInfo.project.name);
  await assertAccessible(page);
  await deleteDialog.getByRole("button", { name: "돌아가기" }).click();
  await expect(deleteTrigger).toBeFocused();
}

export async function verifyRealMeetingCreate({ page }: AdminPageFixture, testInfo: TestInfo): Promise<void> {
  const location = `합성 생성 성공 ${testInfo.project.name}`;
  await page.goto("/admin/meetings", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "새 모임" }).click();
  await page.getByLabel("날짜").fill("2099-12-30");
  await page.getByLabel("시작 시간").fill("10:00");
  await page.getByLabel("종료 시간").fill("12:00");
  await page.getByLabel("장소").fill(location);
  const responsePromise = page.waitForResponse((response) => response.request().method() === "POST"
    && new URL(response.url()).pathname === "/api/meetings");
  await page.getByRole("button", { name: "모임 생성" }).click();
  const response = await responsePromise;
  expect(response.status()).toBe(201);
  const meetingId = meetingIdFromBody(await response.json());
  const createdMeeting = page.getByRole("link").filter({ hasText: location });
  await createdMeeting.scrollIntoViewIfNeeded();
  await expect(createdMeeting).toBeVisible();
  await capture(page, "create-success", testInfo.project.name);
  await assertMobileGeometry(page);
  await assertAccessible(page);
  expect((await page.request.delete(`/api/meetings/${meetingId}`)).status()).toBe(200);
}

export async function verifyRealParticipantRoundTrip({ page }: AdminPageFixture, testInfo: TestInfo): Promise<void> {
  await page.goto("/admin/meetings/8103", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "합성 회원 01 참가 취소" }).click();
  const cancelResponsePromise = page.waitForResponse((response) => response.request().method() === "PUT"
    && new URL(response.url()).pathname === "/api/participants/8838");
  await page.getByRole("dialog", { name: "참가를 취소할까요?" }).getByRole("button", { name: "참가 취소" }).click();
  expect((await cancelResponsePromise).status()).toBe(200);
  await page.getByRole("tab", { name: "취소됨 1" }).click();
  await expect(page.getByRole("button", { name: "합성 회원 01 참가 복구" })).toBeVisible();
  await capture(page, "cancel-success", testInfo.project.name);

  await page.getByRole("button", { name: "합성 회원 01 참가 복구" }).click();
  const restoreResponsePromise = page.waitForResponse((response) => response.request().method() === "PUT"
    && new URL(response.url()).pathname === "/api/participants/8838");
  await page.getByRole("dialog", { name: "참가를 복구할까요?" }).getByRole("button", { name: "참가 복구" }).click();
  expect((await restoreResponsePromise).status()).toBe(200);
  await page.getByRole("tab", { name: "참가 확정 1" }).click();
  await expect(page.getByRole("button", { name: "합성 회원 01 참가 취소" })).toBeVisible();
  await capture(page, "restore-success", testInfo.project.name);
  await assertAccessible(page);
}

export async function verifyDisposableMeetingDelete({ page }: AdminPageFixture, testInfo: TestInfo): Promise<void> {
  const location = `삭제 전용 합성 모임 ${testInfo.project.name}`;
  const createResponse = await page.request.post("/api/meetings", {
    data: {
      date: "2099-12-29",
      startTime: "10:00",
      endTime: "12:00",
      location,
      description: "삭제 경로만 검증하는 참가자 없는 모임",
      isOpen: true,
      meetingType: "정기",
    },
  });
  expect(createResponse.status()).toBe(201);
  const meetingId = meetingIdFromBody(await createResponse.json());

  await page.goto(`/admin/meetings/${meetingId}`, { waitUntil: "networkidle" });
  await expect(page.getByText(location).first()).toBeVisible();
  await page.getByRole("button", { name: "모임 삭제" }).click();
  const responsePromise = page.waitForResponse((response) => response.request().method() === "DELETE"
    && new URL(response.url()).pathname === `/api/meetings/${meetingId}`);
  await page.getByRole("dialog", { name: "모임을 삭제할까요?" }).getByRole("button", { name: "모임 삭제" }).click();
  expect((await responsePromise).status()).toBe(200);
  await expect(page).toHaveURL(/\/admin\/meetings$/);
  await expect(page.getByText(location)).toBeHidden();
  await capture(page, "delete-success", testInfo.project.name);
  await assertMobileGeometry(page);
  await assertAccessible(page);
}
