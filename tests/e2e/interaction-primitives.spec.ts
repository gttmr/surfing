import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { installBrowserEgressGuard } from "../../scripts/qa/browser-egress";
import { qaStorageState, type QaAuthContextKey } from "../fixtures/playwright-auth";

const evidenceDirectory = process.env.EVIDENCE_DIR;

async function authenticate(context: BrowserContext, key: QaAuthContextKey) {
  await context.clearCookies();
  const storage = qaStorageState(key);
  if (storage && typeof storage !== "string" && storage.cookies.length > 0) {
    await context.addCookies(storage.cookies);
  }
}

async function assertNoSeriousAxeViolations(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious")).toEqual([]);
}

async function capture(page: Page, testName: string, projectName: string) {
  if (!evidenceDirectory) throw new Error("EVIDENCE_DIR is required");
  await mkdir(evidenceDirectory, { recursive: true });
  await page.screenshot({ fullPage: true, path: join(evidenceDirectory, `${projectName}-${testName}.png`) });
}

test.beforeEach(async ({ context }) => {
  if (!evidenceDirectory) throw new Error("EVIDENCE_DIR is required");
  await installBrowserEgressGuard(context, evidenceDirectory);
});

test("home tabs and both member overlays preserve keyboard focus", async ({ context, page }, testInfo) => {
  await authenticate(context, "member");
  await page.goto("/", { waitUntil: "networkidle" });

  const alertTrigger = page.getByRole("button", { name: "알림 센터 열기" });
  await alertTrigger.click();
  const alertDialog = page.getByRole("dialog", { name: "알림 센터" });
  await expect(alertDialog).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");
  expect(await alertDialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  const alertGeometry = await alertDialog.evaluate((node) => ({
    clientHeight: node.clientHeight,
    maxHeight: getComputedStyle(node).maxHeight,
    overflowY: getComputedStyle(node).overflowY,
    viewportHeight: window.innerHeight,
  }));
  expect(alertGeometry.overflowY).toBe("auto");
  expect(alertGeometry.clientHeight).toBeLessThan(alertGeometry.viewportHeight);
  expect(alertGeometry.maxHeight).not.toBe("none");
  const alertButtons = alertDialog.getByRole("button");
  if (await alertButtons.count() > 1) await alertButtons.nth(1).click();
  await capture(page, "home-alert-dialog", testInfo.project.name);
  await page.keyboard.press("Shift+Tab");
  expect(await alertDialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  await page.keyboard.press("Escape");
  await expect(alertDialog).toBeHidden();
  await expect(alertTrigger).toBeFocused();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("");

  const tablist = page.getByRole("tablist", { name: "모임 정보" });
  await expect(tablist).toBeVisible();
  const selectedTab = tablist.getByRole("tab", { selected: true });
  const previousName = await selectedTab.textContent();
  await selectedTab.focus();
  await page.keyboard.press("ArrowRight");
  await expect(tablist.getByRole("tab", { selected: true })).not.toHaveText(previousName ?? "");
  await expect(page.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", await tablist.getByRole("tab", { selected: true }).getAttribute("id") ?? "missing");
  await page.keyboard.press("Home");
  await expect(tablist.getByRole("tab", { name: "참가하기", selected: true })).toBeFocused();

  const orderTrigger = page.getByRole("button", { name: /점심 메뉴 주문/ }).first();
  await orderTrigger.click();
  const orderSheet = page.getByRole("dialog", { name: "점심 메뉴 주문" });
  await expect(orderSheet).toBeVisible();
  expect(await orderSheet.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  const incrementButton = orderSheet.getByRole("button", { name: "+", exact: true }).first();
  await incrementButton.click();
  await expect(incrementButton).toBeFocused();
  await capture(page, "home-order-sheet", testInfo.project.name);
  await page.keyboard.press("Escape");
  await expect(orderTrigger).toBeFocused();
  await assertNoSeriousAxeViolations(page);
});

test("profile and admin tabs use roving selection", async ({ context, page }, testInfo) => {
  await authenticate(context, "member");
  await page.goto("/profile", { waitUntil: "networkidle" });
  const profileTabs = page.getByRole("tablist", { name: "프로필 설정" });
  const profileSelected = profileTabs.getByRole("tab", { selected: true });
  await profileSelected.focus();
  await page.keyboard.press("ArrowRight");
  await expect(profileTabs.getByRole("tab", { name: /동반인 관리/, selected: true })).toBeFocused();
  await expect(page.getByRole("tabpanel")).toContainText("동반인");
  await capture(page, "profile-tabs", testInfo.project.name);

  await authenticate(context, "password-admin");
  await page.goto("/admin/meetings/8101", { waitUntil: "networkidle" });
  const adminTabs = page.getByRole("tablist", { name: "참가자 상태" });
  const adminSelected = adminTabs.getByRole("tab", { selected: true });
  await adminSelected.focus();
  await page.keyboard.press("End");
  await expect(adminTabs.getByRole("tab", { name: /전체/, selected: true })).toBeFocused();
  await expect(page.getByRole("tabpanel")).toBeVisible();

  const longName = "합성 회원 이름이 매우 길어서 모바일 줄바꿈과 목록 밀도를 검증하는 서른다섯 번째 사용자";
  const finalPhraseLineCount = await page.locator("span.w-full.text-balance").filter({ hasText: longName }).evaluate((node) => {
    const text = node.textContent ?? "";
    const phrase = "서른다섯 번째 사용자";
    const start = text.indexOf(phrase);
    const textNode = node.firstChild;
    if (start < 0 || !textNode) return Number.POSITIVE_INFINITY;
    const range = document.createRange();
    range.setStart(textNode, start);
    range.setEnd(textNode, start + phrase.length);
    return new Set(Array.from(range.getClientRects(), (rect) => Math.round(rect.top))).size;
  });
  expect(finalPhraseLineCount).toBe(1);

  await page.route("**/api/meetings/8101", async (route) => {
    if (route.request().method() === "PUT") {
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "합성 오류" }) });
      return;
    }
    await route.continue();
  });
  await page.getByRole("button", { name: "신청 마감하기" }).click();
  const toast = page.getByRole("alert").filter({ hasText: "신청 상태를 바꾸지 못했습니다" });
  await expect(toast).toContainText("신청 상태를 바꾸지 못했습니다");
  await expect(toast.getByRole("button", { name: "알림 닫기" })).toBeVisible();
  const toastClearsDock = await page.evaluate(() => {
    const toastElement = document.querySelector<HTMLElement>(".brand-toast-error");
    const dockElement = document.querySelector<HTMLElement>('nav[aria-label="관리자 메뉴"]');
    if (!toastElement || !dockElement) return false;
    return toastElement.getBoundingClientRect().bottom <= dockElement.getBoundingClientRect().top;
  });
  expect(toastClearsDock).toBe(true);
  await capture(page, "admin-tabs-toast", testInfo.project.name);
  await assertNoSeriousAxeViolations(page);
});

test("shop dock and cancel dialog expose current location and focus contract", async ({ context, page }, testInfo) => {
  await authenticate(context, "shop");
  await page.goto("/shop?meetingId=8101", { waitUntil: "networkidle" });

  const dock = page.getByRole("navigation", { name: "샵 메뉴" });
  await expect(dock.getByRole("link", { name: /주문보드/ })).toHaveAttribute("aria-current", "page");
  const cancelTrigger = page.getByRole("button", { name: "취소", exact: true }).first();
  await cancelTrigger.click();
  const dialog = page.getByRole("dialog", { name: "주문 취소" });
  await expect(dialog).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.body.style.overflow)).toBe("hidden");
  await page.keyboard.press("Shift+Tab");
  expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  await capture(page, "shop-cancel-dialog", testInfo.project.name);
  await page.keyboard.press("Escape");
  await expect(cancelTrigger).toBeFocused();
  await assertNoSeriousAxeViolations(page);
});

test("invalid admin meeting keeps role navigation and a useful exit", async ({ context, page }, testInfo) => {
  await authenticate(context, "password-admin");
  await page.goto("/admin/meetings/999999", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "관리 항목을 찾을 수 없어요" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "관리자 메뉴" }).getByRole("link", { name: /모임관리/ })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("link", { name: "모임 관리로 이동" })).toHaveAttribute("href", "/admin/meetings");
  await capture(page, "admin-not-found", testInfo.project.name);
  await assertNoSeriousAxeViolations(page);
});
