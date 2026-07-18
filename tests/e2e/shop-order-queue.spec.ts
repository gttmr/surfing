import { expect, test } from "@playwright/test";
import {
  assertShopOrderAccessible,
  assertShopOrderGeometry,
  captureShopOrder,
  closeShopOrderTestClient,
  createSecondShopContext,
  insertVisibleShopOrder,
  openShopOrders,
  prepareShopOrderTest,
  setSyntheticVisibility,
} from "./shop-order-queue.support";

test.beforeEach(async ({ context }) => {
  await prepareShopOrderTest(context);
});

test.afterAll(async () => {
  await closeShopOrderTestClient();
});

test.setTimeout(90_000);

function activeRows(page: import("@playwright/test").Page) {
  return page.locator('section[aria-label="주문 처리 목록"] > article');
}

test("oldest-first queue searches, filters, collapses completion, and confirms reversals", async ({ page }, testInfo) => {
  await openShopOrders(page);
  await expect(activeRows(page)).toHaveCount(4);
  expect(await activeRows(page).evaluateAll((rows) => rows.map((row) => row.getAttribute("data-order-id"))))
    .toEqual(["8901", "8901", "8902", "8903"]);

  const completed = page.locator("details").filter({ hasText: "완료한 주문 1건" });
  await expect(completed).not.toHaveAttribute("open", "");
  await completed.locator("summary").click();
  await expect(completed.getByText("접기", { exact: true })).toBeVisible();
  await expect(completed.locator('article[data-order-id="8904"]')).toBeVisible();

  const search = page.getByRole("searchbox", { name: "주문 검색" });
  await search.fill("합성 회원 02");
  await expect(activeRows(page)).toHaveCount(1);
  await expect(activeRows(page).first()).toContainText("합성 회원 02");
  await search.fill("합성 메뉴 13");
  await expect(activeRows(page)).toHaveCount(1);
  await expect(activeRows(page).first()).toHaveAttribute("data-order-id", "8901");
  await search.fill("준비 중");
  await expect(activeRows(page)).toHaveCount(1);
  await expect(activeRows(page).first()).toHaveAttribute("data-order-id", "8902");
  await search.fill("");
  await page.getByRole("button", { name: "준비 중 1" }).click();
  await expect(activeRows(page)).toHaveCount(1);
  await page.getByRole("button", { name: "처리할 주문 4" }).click();

  const preparingRow = activeRows(page).filter({ hasText: "합성 메뉴 02" });
  await preparingRow.getByRole("button", { name: /준비 취소$/ }).click();
  const reversal = page.getByRole("dialog", { name: "준비 상태를 되돌릴까요?" });
  await expect(reversal).toBeVisible();
  await reversal.getByRole("button", { name: "유지하기" }).click();
  await expect(preparingRow.getByRole("button", { name: /준비 취소$/ })).toBeVisible();
  await preparingRow.getByRole("button", { name: /준비 취소$/ }).click();
  await reversal.getByRole("button", { name: "준비 취소" }).click();
  await expect(preparingRow.getByRole("button", { name: /준비 시작$/ })).toBeVisible();

  const cancellable = activeRows(page).filter({ hasText: "합성 회원 02" });
  await cancellable.getByRole("button", { name: /주문 취소$/ }).click();
  const cancellation = page.getByRole("dialog", { name: "주문을 취소할까요?" });
  await cancellation.getByLabel("취소 사유").selectOption("other");
  await expect(cancellation.getByRole("button", { name: "주문 취소" })).toBeDisabled();
  await cancellation.getByLabel("추가 설명").fill("현장 합성 확인");
  await cancellation.getByRole("button", { name: "유지하기" }).click();
  await expect(cancellable).toBeVisible();
  await expect(cancellable.getByRole("button", { name: /주문 취소$/ })).toBeFocused();

  await assertShopOrderAccessible(page);
  await assertShopOrderGeometry(page);
  await captureShopOrder(page, "shop-order-queue", testInfo.project.name);
});

test("polls only while visible and refreshes once when visibility returns", async ({ page }) => {
  let getCount = 0;
  await page.route("**/api/shop/meetings/8101/orders", async (route) => {
    if (route.request().method() === "GET") getCount += 1;
    await route.continue();
  });
  await openShopOrders(page);
  await expect.poll(() => getCount, { timeout: 7_000 }).toBeGreaterThan(0);

  await setSyntheticVisibility(page, "hidden");
  const hiddenCount = getCount;
  await page.waitForTimeout(5_300);
  expect(getCount).toBe(hiddenCount);
  const insertedMenu = await insertVisibleShopOrder();

  await setSyntheticVisibility(page, "visible");
  await expect.poll(() => getCount, { timeout: 2_000 }).toBe(hiddenCount + 1);
  await page.waitForTimeout(400);
  expect(getCount).toBe(hiddenCount + 1);
  await expect(page.getByText(insertedMenu, { exact: true })).toBeVisible();
});

test("an old delayed poll cannot overwrite a mutation and a failed poll keeps last-good rows", async ({ page }, testInfo) => {
  await openShopOrders(page);
  const staleSnapshot = await (await page.request.get("/api/shop/meetings/8101/orders")).json();
  let releaseDelayed: () => void = () => undefined;
  let markDelayedSeen: () => void = () => undefined;
  const delayedRelease = new Promise<void>((resolve) => { releaseDelayed = resolve; });
  const delayedSeen = new Promise<void>((resolve) => { markDelayedSeen = resolve; });
  let delayNext = true;
  let failNext = false;
  await page.route("**/api/shop/meetings/8101/orders", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    if (delayNext) {
      delayNext = false;
      markDelayedSeen();
      await delayedRelease;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(staleSnapshot) }).catch(() => undefined);
      return;
    }
    if (failNext) {
      failNext = false;
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "합성 갱신 실패" }) });
      return;
    }
    await route.continue();
  });

  await page.getByRole("button", { name: "주문 목록 새로고침" }).click();
  await delayedSeen;
  const first = activeRows(page).first();
  await first.getByRole("button", { name: /준비 시작$/ }).click();
  await expect(first.getByRole("button", { name: /전달 완료$/ })).toBeVisible();
  releaseDelayed();
  await page.waitForTimeout(300);
  await expect(first.getByRole("button", { name: /전달 완료$/ })).toBeVisible();

  failNext = true;
  await page.getByRole("button", { name: "주문 목록 새로고침" }).click();
  const failure = page.getByRole("alert").filter({ hasText: "최근 주문을 불러오지 못했습니다." });
  await expect(failure).toBeVisible();
  await expect(first).toBeVisible();
  await captureShopOrder(page, "shop-order-last-good-error", testInfo.project.name);
  await failure.getByRole("button", { name: "다시 시도" }).click();
  await expect(failure).toHaveCount(0);
  await captureShopOrder(page, "shop-order-last-good", testInfo.project.name);
});

test("same-row contexts conflict safely while different rows remain independently actionable", async ({ browser, page }) => {
  await openShopOrders(page);
  const secondContext = await createSecondShopContext(browser);
  const secondPage = await secondContext.newPage();
  const statuses: number[] = [];
  const record = (response: import("@playwright/test").Response) => {
    if (response.request().method() === "PATCH" && response.url().includes("/api/shop/meetings/8101/orders")) statuses.push(response.status());
  };
  page.on("response", record);
  secondPage.on("response", record);
  try {
    await openShopOrders(secondPage);
    await Promise.all([
      activeRows(page).first().getByRole("button", { name: /준비 시작$/ }).click(),
      activeRows(secondPage).first().getByRole("button", { name: /준비 시작$/ }).click(),
    ]);
    await expect.poll(() => statuses.slice(0, 2).toSorted()).toEqual([200, 409]);
    await expect(activeRows(page).first().getByRole("button", { name: /전달 완료$/ })).toBeVisible();
    await expect(activeRows(secondPage).first().getByRole("button", { name: /전달 완료$/ })).toBeVisible();
    expect(
      await page.getByText("다른 화면에서 주문 상태가 바뀌어 최신 목록으로 갱신했습니다.").count()
      + await secondPage.getByText("다른 화면에서 주문 상태가 바뀌어 최신 목록으로 갱신했습니다.").count(),
    ).toBe(1);

    const independent = activeRows(page).filter({ has: page.getByRole("button", { name: /준비 시작$/ }) });
    await expect(independent).toHaveCount(2);
    await Promise.all([
      independent.nth(0).getByRole("button", { name: /준비 시작$/ }).click(),
      independent.nth(1).getByRole("button", { name: /준비 시작$/ }).click(),
    ]);
    await expect.poll(() => statuses.slice(-2).toSorted()).toEqual([200, 200]);
  } finally {
    await secondContext.close();
  }
});
