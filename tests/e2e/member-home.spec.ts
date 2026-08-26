import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { installBrowserEgressGuard } from "../../scripts/qa/browser-egress";
import { qaStorageState, type QaAuthContextKey } from "../fixtures/playwright-auth";

const evidenceDirectory = process.env.EVIDENCE_DIR;

async function setAuth(context: BrowserContext, key: QaAuthContextKey) {
  await context.clearCookies();
  const state = qaStorageState(key);
  if (state && typeof state === "object" && "cookies" in state && state.cookies) {
    await context.addCookies(state.cookies);
  }
}

async function capture(page: Page, name: string, projectName: string) {
  if (!evidenceDirectory) throw new Error("EVIDENCE_DIR is required");
  await mkdir(evidenceDirectory, { recursive: true });
  await page.screenshot({ fullPage: true, path: join(evidenceDirectory, `${projectName}-${name}.png`) });
}

async function assertAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => item.impact === "critical" || item.impact === "serious")).toEqual([]);
}

test.beforeEach(async ({ context }) => {
  if (!evidenceDirectory) throw new Error("EVIDENCE_DIR is required");
  await installBrowserEgressGuard(context, evidenceDirectory);
});

test.setTimeout(60_000);

test("R01 public home exposes a single-stop Korean calendar", async ({ page }, testInfo) => {
  await page.goto("/");
  const grid = page.getByRole("grid", { name: /모임 달력/ });
  await expect(grid).toBeVisible();
  const tabbableDates = grid.locator('[role="gridcell"][tabindex="0"]');
  await expect(tabbableDates).toHaveCount(1);
  await expect(tabbableDates).toHaveAttribute("aria-label", /\d{4}년 \d+월 \d+일 .+요일, .*모임/);
  await expect(page.getByRole("link", { name: "카카오로 로그인" })).toBeVisible();
  const publicMeetingResponse = await page.request.get("/api/meetings/8101");
  const publicMeeting = await publicMeetingResponse.json() as { participants: Array<{ kakaoId: string }> };
  expect(publicMeeting.participants.every((participant) => !participant.kakaoId.startsWith("qa-user-"))).toBe(true);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await assertAccessible(page);
  await capture(page, "home-public", testInfo.project.name);
});

test("R01 member finds dense participants, billing, empty state, and drives calendar by keyboard", async ({ context, page }, testInfo) => {
  await setAuth(context, "member");
  const meetingsResponse = await page.request.get("/api/meetings");
  const meetings = await meetingsResponse.json() as Array<{ id: number; date: string }>;
  const dense = meetings.find((meeting) => meeting.id === 8101);
  const empty = meetings.find((meeting) => meeting.id === 8104);
  expect(dense).toBeTruthy();
  expect(empty).toBeTruthy();

  const memberMeetingResponse = await page.request.get(`/api/meetings/${dense?.id}`);
  const memberMeeting = await memberMeetingResponse.json() as { participants: Array<{ kakaoId: string }> };
  expect(memberMeeting.participants.some((participant) => participant.kakaoId === "qa-user-01")).toBe(true);
  expect(memberMeeting.participants
    .filter((participant) => participant.kakaoId !== "qa-user-01")
    .every((participant) => !participant.kakaoId.startsWith("qa-user-"))).toBe(true);

  const billingResponse = await page.request.get("/api/settlement/current");
  const billing = await billingResponse.json() as {
    billing: Array<{ paymentStatus: string }>;
    pending: Array<{ paymentStatus: string }>;
  };
  expect(billing.billing.some((item) => item.paymentStatus === "NO_PAYMENT_REQUIRED" || item.paymentStatus === "VERIFIED")).toBe(true);
  expect(billing.pending.length).toBeGreaterThan(0);
  expect(billing.pending.every((item) => item.paymentStatus === "PAYMENT_REQUIRED" || item.paymentStatus === "REPORTED")).toBe(true);

  await page.goto(`/?date=${dense?.date}`);
  await expect(page.getByText("지금 할 일")).toBeVisible();
  const selectedMeeting = page.locator('section[aria-labelledby="selected-meeting-title"]');
  await expect(selectedMeeting.getByRole("link", { name: /청구/ })).toHaveCount(0);
  const pendingBilling = page.getByRole("alert", { name: "입금이 필요한 청구가 있습니다" });
  await expect(pendingBilling).toBeVisible();
  await expect(pendingBilling).toContainText("27,750원");
  await expect(pendingBilling.getByRole("link", { name: "청구 확인하고 입금하기" })).toHaveAttribute("href", "/settlement");
  await expect(page.getByRole("tabpanel")).toHaveCount(1);

  await page.getByRole("tab", { name: "모임 안내" }).click();
  await expect(page.getByRole("tabpanel").getByRole("heading", { name: "모임 안내" })).toBeVisible();
  await expect(page.getByRole("tabpanel")).toHaveCount(1);

  const alertTrigger = page.getByRole("button", { name: "알림 센터 열기" });
  if (await alertTrigger.isVisible()) {
    await alertTrigger.click();
    const alertDialog = page.getByRole("dialog", { name: "알림 센터" });
    await expect(alertDialog).toBeVisible();
    expect(await alertDialog.locator("[data-dialog-panel]").evaluate((node) => node.clientHeight < window.innerHeight)).toBe(true);
    await page.keyboard.press("Escape");
    await expect(alertTrigger).toBeFocused();
  }

  const selectedDate = page.getByRole("gridcell", { selected: true });
  await selectedDate.focus();
  await selectedDate.press("ArrowRight");
  await expect(page.getByRole("gridcell", { selected: true })).toBeFocused();
  await page.goto(`/?date=${dense?.date}`);

  await page.getByRole("tab", { name: /참가자/ }).click();
  await expect(page.getByRole("searchbox", { name: "참가자 검색" })).toBeVisible();
  await page.getByRole("searchbox", { name: "참가자 검색" }).fill("합성 회원 01");
  await expect(page.getByText("합성 회원 01", { exact: true })).toBeVisible();
  await capture(page, "home-member-dense-search", testInfo.project.name);
  await page.getByRole("searchbox", { name: "참가자 검색" }).fill("검색되지 않는 회원");
  await expect(page.getByText("검색 결과가 없습니다.")).toBeVisible();

  await page.goto(`/?date=${empty?.date}`);
  await page.getByRole("tab", { name: /참가자/ }).click();
  await expect(page.getByText("아직 참가 신청자가 없습니다.")).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  await assertAccessible(page);
  await capture(page, "home-member-empty", testInfo.project.name);
});

test("R01 verified billing disappears when the member returns to the app", async ({ context, page }) => {
  await setAuth(context, "member");
  const meetingsResponse = await page.request.get("/api/meetings");
  const meetings = await meetingsResponse.json() as Array<{ id: number; date: string }>;
  const dense = meetings.find((meeting) => meeting.id === 8101);
  expect(dense).toBeTruthy();
  let verified = false;

  await page.route("**/api/settlement/current", async (route) => {
    const response = await route.fetch();
    const payload = await response.json() as { pending: unknown[] };
    await route.fulfill({
      response,
      json: verified ? { ...payload, pending: [] } : payload,
    });
  });

  await page.goto(`/?date=${dense?.date}`);
  const pendingBilling = page.getByRole("alert", { name: "입금이 필요한 청구가 있습니다" });
  await expect(pendingBilling).toBeVisible();

  verified = true;
  await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
  await expect(pendingBilling).toHaveCount(0);
});

test("R02 legacy meeting detail routes stay not found", async ({ page }) => {
  for (const url of ["/meeting/8101", "/meeting/8999"]) {
    const response = await page.goto(url);
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "페이지를 찾을 수 없어요" })).toBeVisible();
  }
});
