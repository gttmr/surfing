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

export function registerAdminPricingVisualCases() {
  test("long Korean drafts and equivalent 200 percent zoom keep actions reachable without overflow", async ({ page }, testInfo) => {
    await page.goto("/admin/settings", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "참가 옵션 안내 편집" }).click();
    const guide = page.getByLabel("참가 옵션 가격 안내 문구");
    await guide.fill("강습과 장비 대여 이용 여부를 확정한 뒤 실제 이용 항목만 정산에 반영합니다. 회원에게 필요한 설명은 문장 흐름을 유지하면서 자연스럽게 줄바꿈되어야 합니다.");
    await expect(page.getByLabel("참가 옵션 안내 초안 미리보기")).toContainText("실제 이용 항목만 정산");
    await capture(page, "settings-long-korean", testInfo.project.name);
    await expect(page.locator("html")).toHaveJSProperty("scrollWidth", await page.locator("html").evaluate((element) => element.clientWidth));
    await assertAccessible(page);

    const originalViewport = page.viewportSize();
    if (!originalViewport) throw new Error("mobile viewport is required");
    await page.setViewportSize({ width: Math.floor(originalViewport.width / 2), height: originalViewport.height });
    await guide.scrollIntoViewIfNeeded();
    await expect(page.locator("html")).toHaveJSProperty("scrollWidth", await page.locator("html").evaluate((element) => element.clientWidth));
    const actionBar = page.getByRole("complementary", { name: "저장하지 않은 변경사항" });
    await actionBar.scrollIntoViewIfNeeded();
    const dock = page.getByRole("navigation", { name: "관리자 메뉴" });
    const actionBox = await actionBar.boundingBox();
    const dockBox = await dock.boundingBox();
    if (!actionBox || !dockBox) throw new Error("sticky action and dock geometry must be measurable");
    expect(actionBox.y + actionBox.height).toBeLessThanOrEqual(dockBox.y);
    await capture(page, "settings-200-percent-zoom-equivalent", testInfo.project.name);
  });
}
