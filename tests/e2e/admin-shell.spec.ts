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

async function capture(page: Page, name: string, projectName: string) {
  if (!evidenceDirectory) throw new Error("EVIDENCE_DIR is required");
  await mkdir(evidenceDirectory, { recursive: true });
  await page.screenshot({ path: join(evidenceDirectory, `${projectName}-admin-${name}.png`) });
}

async function assertAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious")).toEqual([]);
}

test.beforeEach(async ({ context }) => {
  if (!evidenceDirectory) throw new Error("EVIDENCE_DIR is required");
  await installBrowserEgressGuard(context, evidenceDirectory);
});

test("admin shell redirects public users and contains six mobile destinations", async ({ context, page }, testInfo) => {
  const portalPrefetches: string[] = [];
  await page.route(/^https:\/\/[^/]*kakao\.com\//, (route) => route.abort("blockedbyclient"));
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.hostname === "127.0.0.1" && url.pathname === "/shop" && url.searchParams.has("_rsc")) {
      portalPrefetches.push(request.url());
    }
  });

  await authenticate(context, "public");
  await page.goto("/admin", { waitUntil: "networkidle" });
  await expect(page).toHaveURL(/\/admin\/login$/);
  await page.getByLabel("비밀번호").fill("wrong-password");
  await page.getByRole("button", { name: "로그인", exact: true }).click();
  await expect(page.getByText("비밀번호가 올바르지 않습니다")).toBeVisible();

  await authenticate(context, "password-admin");
  await page.goto("/admin", { waitUntil: "networkidle" });
  const dock = page.getByRole("navigation", { name: "관리자 메뉴" });
  await expect(dock.getByRole("link")).toHaveCount(6);
  await expect(dock.getByRole("link", { name: /공지/ })).toHaveAttribute("aria-current", "page");
  await expect(page.getByRole("navigation", { name: "서비스 화면" }).getByRole("link", { name: /회원 화면/ })).toHaveAttribute("href", "/");
  await expect(page.getByRole("navigation", { name: "서비스 화면" }).getByRole("link", { name: /샵 화면/ })).toHaveAttribute("href", "/shop");
  expect(portalPrefetches, "portal links must remain navigation-only without background shop requests").toEqual([]);
  const geometry = await dock.evaluate((node) => {
    const rect = node.getBoundingClientRect();
    return { left: rect.left, right: rect.right, bottom: rect.bottom, width: rect.width, viewportWidth: window.innerWidth, viewportHeight: window.innerHeight };
  });
  expect(geometry.left).toBeGreaterThanOrEqual(0);
  expect(geometry.right).toBeLessThanOrEqual(geometry.viewportWidth);
  expect(geometry.bottom).toBeLessThanOrEqual(geometry.viewportHeight);
  expect(geometry.width).toBeLessThanOrEqual(430);
  await capture(page, "shell-list", testInfo.project.name);
  await assertAccessible(page);
});

test("notice reading and editing are separate and dirty drafts require a choice", async ({ context, page }, testInfo) => {
  await authenticate(context, "password-admin");
  await page.goto("/admin", { waitUntil: "networkidle" });
  await page.getByRole("button").filter({ has: page.getByText("합성 공지", { exact: true }) }).click();
  await expect(page.getByRole("heading", { name: "합성 공지" })).toBeVisible();
  await capture(page, "notice-reader", testInfo.project.name);

  await page.getByRole("button", { name: "수정", exact: true }).click();
  const title = page.getByLabel("공지 제목");
  await title.fill("수정 중인 합성 공지");
  await page.getByRole("button", { name: "취소", exact: true }).click();
  const dirtyDialog = page.getByRole("dialog", { name: "작성 내용을 버릴까요?" });
  await expect(dirtyDialog).toBeVisible();
  await capture(page, "notice-dirty-dialog", testInfo.project.name);
  await dirtyDialog.getByRole("button", { name: "계속 작성" }).click();
  await expect(title).toHaveValue("수정 중인 합성 공지");
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await dirtyDialog.getByRole("button", { name: "내용 버리기" }).click();
  await expect(page.getByRole("heading", { name: "합성 공지" })).toBeVisible();
  await assertAccessible(page);
});

test("notice validation and server failure retain the draft", async ({ context, page }, testInfo) => {
  await authenticate(context, "password-admin");
  await page.goto("/admin", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "새 공지" }).click();
  await page.getByRole("button", { name: "공지 등록" }).click();
  await expect(page.getByText("공지 제목을 입력해 주세요.")).toBeVisible();
  await expect(page.getByText("공지 내용을 입력해 주세요.")).toBeVisible();

  await page.route("**/api/admin/notices", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "합성 저장 오류" }) });
      return;
    }
    await route.continue();
  });
  await page.getByLabel("공지 제목").fill("저장 실패 후 남아야 하는 제목");
  await page.getByLabel("공지 내용").fill("저장 실패 후에도 이 내용은 편집 화면에 남아야 합니다.");
  await page.getByRole("button", { name: "공지 등록" }).click();
  await expect(page.getByText("합성 저장 오류").first()).toBeVisible();
  await expect(page.getByLabel("공지 제목")).toHaveValue("저장 실패 후 남아야 하는 제목");
  await page.getByRole("button", { name: "공지 등록" }).scrollIntoViewIfNeeded();
  const actionClearsDock = await page.evaluate(() => {
    const action = document.querySelector<HTMLButtonElement>('button[type="submit"]');
    const dock = document.querySelector<HTMLElement>('nav[aria-label="관리자 메뉴"]');
    return Boolean(action && dock && action.getBoundingClientRect().bottom <= dock.getBoundingClientRect().top);
  });
  expect(actionClearsDock).toBe(true);
  await capture(page, "notice-save-error", testInfo.project.name);
  await assertAccessible(page);
});

test("notice delete can be cancelled and list failures can retry", async ({ context, page }, testInfo) => {
  await authenticate(context, "password-admin");
  await page.goto("/admin", { waitUntil: "networkidle" });
  await page.getByRole("button").filter({ has: page.getByText("합성 공지", { exact: true }) }).click();
  await page.getByRole("button", { name: "삭제", exact: true }).click();
  const deleteDialog = page.getByRole("dialog", { name: "공지를 삭제할까요?" });
  await expect(deleteDialog).toContainText("합성 공지");
  await deleteDialog.getByRole("button", { name: "취소" }).click();
  await expect(page.getByRole("heading", { name: "합성 공지" })).toBeVisible();
  await page.getByRole("button", { name: "공지 목록" }).click();

  await page.route("**/api/admin/notices", async (route) => {
    await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "합성 목록 오류" }) });
  });
  await page.getByRole("button", { name: "공지 새로고침" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "합성 목록 오류" })).toContainText("합성 목록 오류");
  await page.unroute("**/api/admin/notices");
  await page.getByRole("button", { name: "다시 시도" }).click();
  await expect(page.getByRole("button").filter({ has: page.getByText("합성 공지", { exact: true }) })).toBeVisible();
  await capture(page, "notice-retry", testInfo.project.name);
  await assertAccessible(page);
});
