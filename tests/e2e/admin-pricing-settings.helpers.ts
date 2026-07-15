import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { qaStorageState } from "../fixtures/playwright-auth";

export const evidenceDirectory = process.env.EVIDENCE_DIR;

export async function authenticateAdmin(context: BrowserContext) {
  await context.clearCookies();
  const storage = qaStorageState("password-admin");
  if (storage && typeof storage !== "string") await context.addCookies(storage.cookies);
}

export async function capture(page: Page, name: string, projectName: string) {
  if (!evidenceDirectory) throw new Error("EVIDENCE_DIR is required");
  await mkdir(evidenceDirectory, { recursive: true });
  await page.screenshot({ path: join(evidenceDirectory, `${projectName}-admin-${name}.png`) });
}

export async function assertAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  const seriousViolations = results.violations.filter(
    (violation) => violation.impact === "critical" || violation.impact === "serious",
  );
  expect(seriousViolations).toEqual([]);
}

export async function verifyDelayedSaveLocksEditorAndShell(
  page: Page,
  delayedSave: {
    readonly path: string;
    readonly edit: string;
    readonly field: string;
    readonly dockDestination: string;
  },
) {
  const putStarted = Promise.withResolvers<void>();
  const releasePut = Promise.withResolvers<void>();
  let logoutRequestCount = 0;
  page.on("request", (request) => {
    if (request.method() === "POST" && new URL(request.url()).pathname === "/api/admin/logout") logoutRequestCount += 1;
  });
  await page.route("**/api/admin/settings", async (route) => {
    if (route.request().method() !== "PUT") {
      await route.continue();
      return;
    }
    putStarted.resolve();
    await releasePut.promise;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ success: true }) });
  });

  await page.goto(delayedSave.path, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: delayedSave.edit }).click();
  const field = page.getByLabel(delayedSave.field);
  const original = await field.inputValue();
  await field.fill(delayedSave.path.endsWith("pricing") ? String(Number(original) + 1) : `${original}\n지연 저장 잠금 초안`);
  const portalLink = page.getByRole("link", { name: "회원 화면", exact: true });
  const dockLink = page.getByRole("link", { name: delayedSave.dockDestination, exact: true });
  const logoutButton = page.getByRole("button", { name: "로그아웃" });
  const leaveDialog = page.getByRole("dialog", { name: "변경 내용을 버릴까요?" });
  await portalLink.click();
  await expect(leaveDialog).toBeVisible();
  await page.locator("form").evaluate((form) => {
    if (!(form instanceof HTMLFormElement)) throw new Error("settings form is required");
    form.requestSubmit();
  });
  await putStarted.promise;
  await expect(leaveDialog).toHaveCount(0);

  await expect(field).toBeDisabled();
  await expect(page.getByRole("button", { name: "변경 취소" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "저장 중" })).toBeDisabled();
  await expect(page.getByRole("button", { name: /편집$|편집 접기$/ }).first()).toBeDisabled();

  await expect(portalLink).toHaveAttribute("aria-disabled", "true");
  await expect(portalLink).toHaveAttribute("tabindex", "-1");
  await expect(dockLink).toHaveAttribute("aria-disabled", "true");
  await expect(dockLink).toHaveAttribute("tabindex", "-1");
  await expect(logoutButton).toBeDisabled();

  await portalLink.dispatchEvent("click");
  await dockLink.dispatchEvent("click");
  await logoutButton.dispatchEvent("click");
  await expect(leaveDialog).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`${delayedSave.path}$`));
  expect(logoutRequestCount).toBe(0);

  releasePut.resolve();
  await expect(page.getByText("모든 변경사항 저장됨")).toBeVisible();
  await expect(leaveDialog).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`${delayedSave.path}$`));
  await expect(portalLink).not.toHaveAttribute("aria-disabled", "true");
  await expect(portalLink).not.toHaveAttribute("tabindex", "-1");
  await expect(dockLink).not.toHaveAttribute("aria-disabled", "true");
  await expect(dockLink).not.toHaveAttribute("tabindex", "-1");
  await expect(logoutButton).toBeEnabled();
}

export function registerAdminPricingVisualCases() {
  test("long Korean drafts and equivalent 200 percent zoom keep actions reachable without overflow", async ({ page }, testInfo) => {
    await page.goto("/admin/settings", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "참가 옵션 안내 편집" }).click();
    const guide = page.getByLabel("참가 옵션 가격 안내 문구");
    const persistedGuide = await guide.inputValue();
    expect(persistedGuide.trim().length).toBeGreaterThan(10);
    await guide.fill("강습과 장비 대여 이용 여부를 확정한 뒤 실제 이용 항목만 정산에 반영합니다. 회원에게 필요한 설명은 문장 흐름을 유지하면서 자연스럽게 줄바꿈되어야 합니다.");
    await expect(page.getByLabel("참가 옵션 안내 초안 미리보기")).toContainText("실제 이용 항목만 정산");
    await capture(page, "settings-long-korean", testInfo.project.name);
    await expect(page.locator("html")).toHaveJSProperty("scrollWidth", await page.locator("html").evaluate((element) => element.clientWidth));
    await assertAccessible(page);

    const originalViewport = page.viewportSize();
    if (!originalViewport) throw new Error("mobile viewport is required");
    await page.setViewportSize({ width: Math.floor(originalViewport.width / 2), height: originalViewport.height });
    const targetHeader = page.locator('[data-admin-setting-header="참가 옵션 안내"]');
    await targetHeader.getByRole("button", { name: "참가 옵션 안내 편집 접기" }).click();
    const headerContent = targetHeader.locator("[data-admin-setting-header-content]");
    const roleLabel = targetHeader.locator("[data-admin-role-label]");
    const persistedSummary = targetHeader.locator("[data-admin-persisted-summary]");
    await expect(persistedSummary).toContainText(persistedGuide);
    const roleStyle = await roleLabel.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return { rectCount: element.getClientRects().length, overflowWrap: style.overflowWrap, wordBreak: style.wordBreak };
    });
    expect(roleStyle.rectCount).toBe(1);
    expect(roleStyle.overflowWrap).toBe("normal");
    expect(roleStyle.wordBreak).toBe("keep-all");
    const summaryStyle = await persistedSummary.evaluate((element) => {
      const style = window.getComputedStyle(element);
      return {
        fullyVisible: element.scrollHeight <= element.clientHeight + 1,
        lineClamp: style.webkitLineClamp,
        overflow: style.overflow,
      };
    });
    expect(Number.isNaN(Number.parseInt(summaryStyle.lineClamp, 10))).toBe(true);
    expect(summaryStyle.overflow).toBe("visible");
    expect(summaryStyle.fullyVisible).toBe(true);

    const headerBox = await targetHeader.boundingBox();
    const contentBox = await headerContent.boundingBox();
    const editButtonBox = await targetHeader.getByRole("button", { name: "참가 옵션 안내 편집" }).boundingBox();
    if (!headerBox || !contentBox || !editButtonBox) throw new Error("section header geometry must be measurable");
    expect(contentBox.x).toBeGreaterThanOrEqual(headerBox.x);
    expect(contentBox.x + contentBox.width).toBeLessThanOrEqual(headerBox.x + headerBox.width);
    expect(editButtonBox.x).toBeGreaterThanOrEqual(headerBox.x);
    expect(editButtonBox.x + editButtonBox.width).toBeLessThanOrEqual(headerBox.x + headerBox.width);
    expect(editButtonBox.y).toBeGreaterThanOrEqual(contentBox.y + contentBox.height);
    expect(await targetHeader.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
    await expect(page.locator("html")).toHaveJSProperty("scrollWidth", await page.locator("html").evaluate((element) => element.clientWidth));
    const actionBar = page.getByRole("complementary", { name: "저장하지 않은 변경사항" });
    await actionBar.scrollIntoViewIfNeeded();
    const dock = page.getByRole("navigation", { name: "관리자 메뉴" });
    const actionBox = await actionBar.boundingBox();
    const dockBox = await dock.boundingBox();
    if (!actionBox || !dockBox) throw new Error("sticky action and dock geometry must be measurable");
    expect(actionBox.y + actionBox.height).toBeLessThanOrEqual(dockBox.y);
    const visibleHeaderBox = await targetHeader.boundingBox();
    if (!visibleHeaderBox) throw new Error("target section header must remain visible for capture");
    expect(visibleHeaderBox.y).toBeGreaterThanOrEqual(0);
    expect(visibleHeaderBox.y + visibleHeaderBox.height).toBeLessThanOrEqual(originalViewport.height);
    expect(actionBox.y).toBeGreaterThanOrEqual(0);
    expect(actionBox.y + actionBox.height).toBeLessThanOrEqual(originalViewport.height);
    await capture(page, "settings-200-percent-zoom-equivalent", testInfo.project.name);
  });
}
