import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { installBrowserEgressGuard } from "../../scripts/qa/browser-egress";
import { catalogDraftFromResponse, type CatalogDraft } from "../../src/lib/food-menu-editor";
import { qaStorageState, type QaAuthContextKey } from "../fixtures/playwright-auth";

const evidenceDirectory = process.env.EVIDENCE_DIR;
const catalogUrl = "http://127.0.0.1:3100/api/admin/menus";
const disposableMenuId = 8437;

async function authenticate(context: BrowserContext, key: QaAuthContextKey) {
  await context.clearCookies();
  const storage = qaStorageState(key);
  if (storage && typeof storage !== "string" && storage.cookies.length > 0) {
    await context.addCookies(storage.cookies);
  }
}

async function openAdminEditor(context: BrowserContext, page: Page) {
  await authenticate(context, "password-admin");
  await page.goto("/admin/menus", { waitUntil: "networkidle" });
}

async function assertAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => item.impact === "critical" || item.impact === "serious")).toEqual([]);
}

async function captureEvidence(page: Page, projectName: string, state: string) {
  if (!evidenceDirectory) throw new Error("EVIDENCE_DIR is required");
  await page.screenshot({ animations: "disabled", path: `${evidenceDirectory}/${projectName}-menu-editor-${state}.png` });
}

async function readCatalog(context: BrowserContext): Promise<{ readonly body: unknown; readonly draft: CatalogDraft }> {
  const response = await context.request.get(catalogUrl);
  expect(response.ok()).toBe(true);
  const body: unknown = await response.json();
  const draft = catalogDraftFromResponse(body);
  if (!draft) throw new Error("QA catalog response does not match the editor contract");
  return { body, draft };
}

function findMenu(draft: CatalogDraft, id: number) {
  return draft.flatMap((category) => category.menus).find((menu) => menu.id === id);
}

function deferred() {
  let release: () => void = () => undefined;
  const promise = new Promise<void>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

test.beforeEach(async ({ context }) => {
  if (!evidenceDirectory) throw new Error("EVIDENCE_DIR is required");
  await installBrowserEgressGuard(context, evidenceDirectory);
});

test("dense catalog searches stable option labels without mobile overflow", async ({ context, page }, testInfo) => {
  await openAdminEditor(context, page);

  await expect(page.getByText("저장본: 카테고리 6 · 메뉴 37 · 판매 중 36 · 판매 조합 60", { exact: true })).toBeVisible();
  const firstCategory = page.getByRole("button", { name: /합성 카테고리 1 메뉴 7개 · 판매 조합 11개/ });
  await firstCategory.click();
  await expect(firstCategory).toHaveAttribute("aria-expanded", "false");

  const search = page.getByLabel("메뉴, 카테고리, 옵션 검색");
  await search.fill("푸짐하게");
  await expect(page.getByText("합성 메뉴 01 · 푸짐하게", { exact: true })).toBeVisible();
  await expect(page.getByText("합성 메뉴 07 · 푸짐하게", { exact: true })).toBeVisible();
  await search.fill("바삭한 해변 모래처럼 고소한");
  await expect(page.getByRole("article", { name: /바삭한 해변 모래처럼 고소한 초장문 합성 메뉴/ })).toBeVisible();
  const overflow = await page.evaluate(() => ({ width: document.documentElement.scrollWidth, viewport: window.innerWidth }));
  expect(overflow.width).toBeLessThanOrEqual(overflow.viewport);
  await assertAccessible(page);
  await captureEvidence(page, testInfo.project.name, "dense-long-korean");
});

test("client validation blocks requests and discard restores the saved draft with focus", async ({ context, page }, testInfo) => {
  await openAdminEditor(context, page);
  let putRequests = 0;
  await page.route("**/api/admin/menus", async (route) => {
    if (route.request().method() === "PUT") putRequests += 1;
    await route.continue();
  });

  const categoryName = page.getByLabel("카테고리 이름").first();
  await categoryName.fill("");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "카테고리 이름을 입력해 주세요." })).toBeVisible();
  await expect(categoryName).toBeFocused();
  expect(putRequests).toBe(0);

  const discard = page.getByRole("button", { name: "변경 버리기", exact: true });
  await discard.click();
  const dialog = page.getByRole("dialog", { name: "변경 내용을 버릴까요?" });
  await dialog.getByRole("button", { name: "계속 편집" }).click();
  await expect(discard).toBeFocused();
  await discard.click();
  await dialog.getByRole("button", { name: "변경 버리기" }).click();
  await expect(page.getByLabel("카테고리 이름").first()).toHaveValue("합성 카테고리 1");

  const optionPrice = page.getByLabel("가격").first();
  await optionPrice.fill("4천원");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "옵션 가격은 0 이상의 정수로 입력해 주세요." })).toBeVisible();
  await expect(optionPrice).toBeFocused();
  expect(putRequests).toBe(0);
  await captureEvidence(page, testInfo.project.name, "validation-dirty-sticky-actions");
});

test("400, 404, and 500 saves retain every draft and guarded reload can be cancelled", async ({ context, page }, testInfo) => {
  await openAdminEditor(context, page);
  const statuses = [400, 404, 500];
  let attempt = 0;
  await page.route("**/api/admin/menus", async (route) => {
    if (route.request().method() !== "PUT") return route.continue();
    const status = statuses[attempt] ?? 500;
    attempt += 1;
    await route.fulfill({ status, contentType: "application/json", body: JSON.stringify({ error: `합성 저장 오류 ${status}` }) });
  });

  const menuName = page.getByRole("textbox", { name: "메뉴 이름", exact: true }).first();
  await menuName.fill("실패해도 남아야 하는 메뉴 이름");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  for (const status of statuses) {
    await expect(page.getByRole("alert").filter({ hasText: `합성 저장 오류 ${status}` })).toBeVisible();
    await expect(menuName).toHaveValue("실패해도 남아야 하는 메뉴 이름");
    if (status !== 500) await page.getByRole("button", { name: "저장 다시 시도" }).click();
  }
  await page.getByRole("button", { name: "서버 데이터 다시 불러오기" }).click();
  const reloadDialog = page.getByRole("dialog", { name: "서버 데이터로 다시 불러올까요?" });
  await captureEvidence(page, testInfo.project.name, "retained-failure-reload-dialog");
  await reloadDialog.getByRole("button", { name: "현재 내용 유지" }).click();
  await expect(menuName).toHaveValue("실패해도 남아야 하는 메뉴 이름");
});

test("delayed save locks the editor and a disposable variant persists through reload then restores", async ({ context, page }, testInfo) => {
  await openAdminEditor(context, page);
  const original = await readCatalog(context);
  const marker = "Todo 17 저장 확인 옵션";
  const gate = deferred();
  let putCount = 0;

  try {
    const menu = page.getByRole("article", { name: /합성 메뉴 37 메뉴 편집/ });
    await menu.getByRole("button", { name: "옵션 추가" }).click();
    await menu.getByLabel("선택지").fill(marker);
    await menu.getByLabel("가격").fill("12345");
    await page.route("**/api/admin/menus", async (route) => {
      if (route.request().method() !== "PUT") return route.continue();
      putCount += 1;
      await gate.promise;
      await route.fulfill({ response: await route.fetch() });
    });

    await page.getByRole("button", { name: "저장", exact: true }).click();
    await expect(page.locator("fieldset[aria-busy='true']")).toHaveAttribute("disabled", "");
    await expect(page.locator("fieldset input:enabled, fieldset button:enabled")).toHaveCount(0);
    await expect(menu.getByLabel("선택지")).toHaveValue(marker);
    gate.release();
    await expect(page.getByText("카테고리와 메뉴를 저장했습니다.")).toBeVisible();
    await expect(menu.getByLabel("선택지")).toHaveValue(marker);

    await page.reload({ waitUntil: "networkidle" });
    await page.getByLabel("메뉴, 카테고리, 옵션 검색").fill(marker);
    await expect(page.getByText(`합성 메뉴 37 · ${marker}`, { exact: true })).toBeVisible();
    await captureEvidence(page, testInfo.project.name, "persisted-disposable-option");
    expect(findMenu((await readCatalog(context)).draft, disposableMenuId)?.options.some((option) => option.label === marker)).toBe(true);

    await page.getByRole("button", { name: `합성 메뉴 37 · ${marker} 옵션 삭제` }).click();
    await page.getByRole("dialog", { name: "옵션을 삭제할까요?" }).getByRole("button", { name: "옵션 삭제" }).click();
    await expect(page.locator("#menu-name-menu-8437")).toBeFocused();
    await page.getByRole("button", { name: "저장", exact: true }).click();
    await expect(page.getByText("카테고리와 메뉴를 저장했습니다.")).toBeVisible();
    expect(putCount).toBe(2);
    await page.reload({ waitUntil: "networkidle" });
    expect(findMenu((await readCatalog(context)).draft, disposableMenuId)?.options.some((option) => option.label === marker)).toBe(false);
  } finally {
    gate.release();
    await page.unroute("**/api/admin/menus");
    const restored = await context.request.put(catalogUrl, { data: original.body });
    expect(restored.ok()).toBe(true);
  }
});

test("zero catalog recovery state is explicit and has no serious or critical axe violations", async ({ context, page }, testInfo) => {
  await openAdminEditor(context, page);
  await page.route("**/api/admin/menus", async (route) => {
    if (route.request().method() === "PUT") {
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "합성 저장 오류" }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ categories: [] }) });
  });
  await page.getByLabel("메뉴 이름").first().fill("zero 상태 진입용 draft");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await page.getByRole("button", { name: "서버 데이터 다시 불러오기" }).click();
  await page.getByRole("dialog", { name: "서버 데이터로 다시 불러올까요?" }).getByRole("button", { name: "서버 데이터 불러오기" }).click();
  await expect(page.getByText("등록된 카테고리가 없습니다.", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "카테고리 추가" })).toBeVisible();
  await assertAccessible(page);
  await captureEvidence(page, testInfo.project.name, "zero-catalog-recovery");
});

test("confirmed category, menu, and option deletion moves focus to a surviving editor target", async ({ context, page }, testInfo) => {
  await openAdminEditor(context, page);

  await page.getByRole("button", { name: "합성 카테고리 1 카테고리 삭제" }).click();
  await page.getByRole("dialog", { name: "카테고리를 삭제할까요?" }).getByRole("button", { name: "카테고리 삭제" }).click();
  await expect(page.getByLabel("메뉴, 카테고리, 옵션 검색")).toBeFocused();
  await page.getByRole("button", { name: "변경 버리기", exact: true }).click();
  await page.getByRole("dialog", { name: "변경 내용을 버릴까요?" }).getByRole("button", { name: "변경 버리기" }).click();

  await page.getByRole("button", { name: "합성 메뉴 01 메뉴 삭제" }).click();
  await page.getByRole("dialog", { name: "메뉴를 삭제할까요?" }).getByRole("button", { name: "메뉴 삭제" }).click();
  await expect(page.locator("#category-toggle-category-8301")).toBeFocused();
  await page.getByRole("button", { name: "변경 버리기", exact: true }).click();
  await page.getByRole("dialog", { name: "변경 내용을 버릴까요?" }).getByRole("button", { name: "변경 버리기" }).click();

  await page.getByLabel("메뉴, 카테고리, 옵션 검색").fill("푸짐하게");
  await page.getByRole("button", { name: "합성 메뉴 01 · 푸짐하게 옵션 삭제" }).click();
  await page.getByRole("dialog", { name: "옵션을 삭제할까요?" }).getByRole("button", { name: "옵션 삭제" }).click();
  await expect(page.locator("#menu-name-menu-8401")).toBeFocused();

  await authenticate(context, "shop");
  await page.goto("/shop/menus", { waitUntil: "networkidle" });
  await expect(page.getByText("샵 포털", { exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "샵 메뉴" }).getByRole("link", { name: /메뉴관리/ })).toHaveAttribute("aria-current", "page");
  await captureEvidence(page, testInfo.project.name, "deterministic-focus-shop-shell");
});
