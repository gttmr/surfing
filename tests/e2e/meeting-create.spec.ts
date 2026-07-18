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

test("R03 public create keeps the selected date in the Kakao gate", async ({ page }, testInfo) => {
  await page.goto("/meeting/create?date=2099-08-15");
  const login = page.getByRole("link", { name: "카카오로 로그인" });
  await expect(login).toBeVisible();
  await expect(login).toHaveAttribute("href", /returnTo=.*2099-08-15/);
  await assertAccessible(page);
  await capture(page, "create-public-gate", testInfo.project.name);
});

test("R03 member create links validation, retains failures, and returns to the created date", async ({ context, page }, testInfo) => {
  await setAuth(context, "member");
  await page.goto("/meeting/create?date=2099-08-15");

  await page.getByRole("button", { name: "비정기 모임 등록" }).click();
  await expect(page.locator("#meeting-start")).toBeFocused();
  await expect(page.getByText("시작 시간을 입력해 주세요.")).toBeVisible();

  await page.locator("#meeting-start").fill("12:00");
  await page.locator("#meeting-end").fill("11:00");
  await page.getByRole("button", { name: "비정기 모임 등록" }).click();
  await expect(page.getByText("종료 시간은 시작 시간보다 늦어야 합니다.")).toBeVisible();

  await page.locator("#meeting-end").fill("14:00");
  await page.getByLabel(/설명/).fill("실패 뒤에도 유지할 준비물 안내");
  await page.route("**/api/meetings", async (route) => {
    await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "잠시 등록할 수 없습니다." }) });
  });
  await page.getByRole("button", { name: "비정기 모임 등록" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "잠시 등록할 수 없습니다." })).toBeVisible();
  await expect(page.getByLabel(/설명/)).toHaveValue("실패 뒤에도 유지할 준비물 안내");
  await assertAccessible(page);
  await capture(page, "create-member-error-retained", testInfo.project.name);

  await page.unroute("**/api/meetings");
  await page.route("**/api/meetings", async (route) => {
    await route.fulfill({ status: 201, contentType: "application/json", body: JSON.stringify({ id: 9999, date: "2099-08-15" }) });
  });
  await page.getByRole("button", { name: "비정기 모임 등록" }).click();
  await expect(page).toHaveURL(/\/\?date=2099-08-15$/);
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
