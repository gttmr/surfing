import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { installBrowserEgressGuard } from "../../scripts/qa/browser-egress";
import { seedMobileUx } from "../../scripts/qa/seed-mobile-ux";
import { qaStorageState } from "../fixtures/playwright-auth";

const client = new PrismaClient();
const evidenceDirectory = process.env.EVIDENCE_DIR;

async function prepareShopUsageTest(context: BrowserContext) {
  if (!evidenceDirectory) throw new Error("EVIDENCE_DIR is required");
  await installBrowserEgressGuard(context, evidenceDirectory);
  await seedMobileUx(client, randomUUID(), evidenceDirectory);
  await context.clearCookies();
  const storage = qaStorageState("shop");
  if (storage && typeof storage !== "string") await context.addCookies(storage.cookies);
}

async function openShopUsage(page: Page) {
  await page.goto("/shop/usage?meetingId=8101", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "참가자 이용 확인" })).toBeVisible();
}

function participantRows(page: Page) {
  return page.locator('article[data-participant-id]');
}

function participantRow(page: Page, name: string) {
  return participantRows(page).filter({ hasText: name });
}

async function capture(page: Page, name: string, projectName: string) {
  if (!evidenceDirectory) throw new Error("EVIDENCE_DIR is required");
  await mkdir(evidenceDirectory, { recursive: true });
  await page.screenshot({ path: join(evidenceDirectory, `${projectName}-${name}.png`), fullPage: false });
}

async function assertMinimumTarget(locator: Locator) {
  const box = await locator.boundingBox();
  expect(box).not.toBeNull();
  if (box) {
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
  }
}

async function assertProgressClearance(page: Page) {
  const progressSummary = page.getByRole("complementary", { name: "이용 확인 진행 요약" });
  const shopDock = page.getByRole("navigation", { name: "샵 메뉴" });
  const [progressBox, dockBox] = await Promise.all([progressSummary.boundingBox(), shopDock.boundingBox()]);
  expect(progressBox).not.toBeNull();
  expect(dockBox).not.toBeNull();
  if (progressBox && dockBox) expect(progressBox.y + progressBox.height).toBeLessThanOrEqual(dockBox.y + 0.5);

  const reviewControls = [
    page.getByRole("searchbox", { name: "참가자 이용 검색" }),
    ...await page.getByRole("group", { name: "참가자 이용 상태 필터" }).getByRole("button").all(),
  ];
  for (const control of reviewControls) {
    const box = await control.boundingBox();
    expect(box).not.toBeNull();
    if (box && dockBox) expect(box.y + box.height).toBeLessThanOrEqual(dockBox.y + 0.5);
  }
}

async function assertGeometryAndAccessibility(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const undersized = await page.locator("main button:visible, main input:visible, main summary:visible").evaluateAll((elements) => (
    elements.flatMap((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width + 0.5 < 44 || rect.height + 0.5 < 44
        ? [{ label: element.getAttribute("aria-label") ?? element.textContent?.trim(), width: rect.width, height: rect.height }]
        : [];
    })
  ));
  expect(undersized).toEqual([]);
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious")).toEqual([]);

  const progressSummary = page.getByRole("complementary", { name: "이용 확인 진행 요약" });
  const shopDock = page.getByRole("navigation", { name: "샵 메뉴" });
  await assertProgressClearance(page);

  const catalogSettings = page.getByText("이용 항목 설정", { exact: true });
  await catalogSettings.scrollIntoViewIfNeeded();
  const [catalogBox, finalDockBox, finalProgressBox] = await Promise.all([
    catalogSettings.boundingBox(),
    shopDock.boundingBox(),
    progressSummary.boundingBox(),
  ]);
  expect(catalogBox).not.toBeNull();
  expect(finalDockBox).not.toBeNull();
  expect(finalProgressBox).not.toBeNull();
  if (catalogBox && finalDockBox) expect(catalogBox.y + catalogBox.height).toBeLessThanOrEqual(finalDockBox.y + 0.5);
  if (catalogBox && finalProgressBox) {
    const separated = catalogBox.y + catalogBox.height <= finalProgressBox.y
      || finalProgressBox.y + finalProgressBox.height <= catalogBox.y;
    expect(separated).toBe(true);
  }
}

test.beforeEach(async ({ context }) => {
  await prepareShopUsageTest(context);
});

test.afterAll(async () => {
  await client.$disconnect();
});

test.setTimeout(90_000);

test("usage review filters exact counts and guards dirty search, filter, and open-row changes", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await client.surfUsageItem.update({
    where: { id: 9102 },
    data: { isActive: false, name: "현재 이름으로 변경된 항목", shopPrice: 99_000 },
  });
  await openShopUsage(page);

  await expect(page.getByRole("button", { name: "확인 필요 29" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "미제출 28" })).toBeVisible();
  await expect(page.getByRole("button", { name: "확인 필요 1", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "확정 1" })).toBeVisible();
  await expect(participantRows(page)).toHaveCount(29);
  await expect(participantRows(page).locator('button[aria-expanded="true"]')).toHaveCount(0);
  await assertProgressClearance(page);
  await capture(page, "usage-default", testInfo.project.name);

  const submitted = participantRow(page, "합성 회원 01");
  await submitted.locator("button").first().click();
  const submittedStepper = submitted.getByRole("button", { name: "합성 회원 01 합성 강습 패키지 수량 늘리기" });
  await assertMinimumTarget(submittedStepper);
  await submittedStepper.click();
  await expect(submitted.getByText("저장 안 됨", { exact: true })).toBeVisible();
  await expect(submitted.getByRole("button", { name: "확정", exact: true })).toBeDisabled();

  await participantRow(page, "합성 회원 03").locator("button").first().click();
  const dialog = page.getByRole("dialog", { name: "변경 내용을 버릴까요?" });
  await expect(dialog).toBeVisible();
  await dialog.getByText("계속 편집", { exact: true }).click();
  await expect(submitted.locator('button[aria-expanded="true"]')).toHaveCount(1);

  await page.getByRole("button", { name: "확정 1" }).click();
  await expect(dialog).toBeVisible();
  await dialog.getByText("계속 편집", { exact: true }).click();
  await expect(page.getByRole("button", { name: "확인 필요 29" })).toHaveAttribute("aria-pressed", "true");

  await page.getByRole("searchbox", { name: "참가자 이용 검색" }).fill("합성 회원 02");
  await expect(dialog).toBeVisible();
  await capture(page, "usage-dirty-guard", testInfo.project.name);
  await dialog.getByRole("button", { name: "변경 버리기" }).click();
  await expect(page.getByText("조건에 맞는 참가자가 없습니다.")).toBeVisible();
  await page.getByRole("button", { name: "검색·필터 초기화" }).click();

  await page.getByRole("button", { name: "확정 1" }).click();
  await expect(participantRows(page)).toHaveCount(1);
  const confirmed = participantRow(page, "합성 회원 02");
  await confirmed.locator("button").first().click();
  await expect(confirmed.getByText("확정된 내역은 읽기 전용입니다.")).toBeVisible();
  await expect(confirmed.getByText("합성 장비 대여", { exact: true })).toBeVisible();
  await expect(confirmed.getByText("2개 · 60,000원", { exact: true })).toBeVisible();
  await expect(confirmed.locator('button[aria-label*="수량"]')).toHaveCount(0);
  await capture(page, "usage-confirmed-readonly", testInfo.project.name);

  await assertGeometryAndAccessibility(page);
  expect(consoleErrors).toEqual([]);
});

test("usage review keeps failed drafts, then applies successful save and confirm responses", async ({ page }, testInfo) => {
  let failSave = true;
  let failConfirm = true;
  await page.route("**/api/shop/meetings/8101/usage", async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.continue();
      return;
    }
    const payload: unknown = route.request().postDataJSON();
    const action = typeof payload === "object" && payload !== null && "action" in payload ? payload.action : null;
    if (action === "save" && failSave) {
      failSave = false;
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "합성 저장 실패" }) });
      return;
    }
    if (action === "confirm" && failConfirm) {
      failConfirm = false;
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "합성 확정 실패" }) });
      return;
    }
    await route.continue();
  });
  await openShopUsage(page);

  const missing = participantRow(page, "합성 회원 03");
  await missing.locator("button").first().click();
  await expect(missing.getByRole("button", { name: "확정", exact: true })).toBeDisabled();
  await missing.getByRole("button", { name: "합성 회원 03 합성 장비 대여 수량 늘리기" }).click();
  await missing.getByRole("button", { name: "저장", exact: true }).click();
  await expect(missing.getByRole("alert")).toContainText("저장 실패");
  await expect(missing.getByText("저장 안 됨", { exact: true })).toBeVisible();
  await capture(page, "usage-save-error", testInfo.project.name);

  await missing.getByRole("button", { name: "저장", exact: true }).click();
  await expect(missing.getByText("확인 필요", { exact: true })).toBeVisible();
  await expect(missing.getByText("저장 안 됨", { exact: true })).toHaveCount(0);
  await missing.getByRole("button", { name: "확정", exact: true }).click();
  await expect(missing.getByRole("alert")).toContainText("확정 실패");
  await expect(missing).toBeVisible();
  await capture(page, "usage-confirm-error", testInfo.project.name);

  await missing.getByRole("button", { name: "확정", exact: true }).click();
  await expect(missing).toHaveCount(0);
  await expect(page.getByRole("button", { name: "확정 2" })).toBeVisible();
  await page.getByRole("searchbox", { name: "참가자 이용 검색" }).fill("없는 참가자");
  await expect(page.getByText("조건에 맞는 참가자가 없습니다.")).toBeVisible();
  await capture(page, "usage-empty-recovery", testInfo.project.name);
  await page.getByRole("button", { name: "검색·필터 초기화" }).click();
  await expect(participantRows(page)).toHaveCount(28);

  await assertGeometryAndAccessibility(page);
});
