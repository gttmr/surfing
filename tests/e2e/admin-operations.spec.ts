import { expect, test } from "@playwright/test";
import {
  assertAccessible,
  assertMobileGeometry,
  capture,
  prepareAdminContext,
} from "./admin-meetings-support";

test.beforeEach(async ({ context }) => {
  await prepareAdminContext(context);
});

test("admin fulfillment and settlement workspaces keep the operational hierarchy", async ({ page }, testInfo) => {
  await page.goto("/admin/meetings/8101/orders", { waitUntil: "networkidle" });

  const actionableTab = page.getByRole("tab", { name: /처리할 일/ });
  const orderTrigger = (orderId: number) => page.getByRole("button", { name: new RegExp(`주문 #${orderId}\\b`) });
  await expect(actionableTab).toHaveAttribute("aria-selected", "true");
  await expect(orderTrigger(8901)).toBeVisible();
  await expect(orderTrigger(8902)).toBeVisible();
  await expect(orderTrigger(8904)).toBeHidden();

  const repeatedOrder = page.locator("article").filter({ hasText: "주문 #8901" });
  const repeatedOrderTrigger = repeatedOrder.getByRole("button").first();
  await expect(repeatedOrderTrigger).toHaveAttribute("aria-expanded", "true");

  await page.getByRole("searchbox", { name: "참가자 또는 메뉴 검색" }).fill("합성 메뉴 13");
  await expect(orderTrigger(8901)).toBeVisible();
  await expect(orderTrigger(8902)).toBeHidden();
  await capture(page, "orders-search", testInfo.project.name);

  await page.getByRole("searchbox", { name: "참가자 또는 메뉴 검색" }).fill("");
  await page.getByRole("tab", { name: /전체 주문/ }).click();
  await expect(orderTrigger(8904)).toBeVisible();
  await expect(orderTrigger(8905)).toBeVisible();

  const completedOrder = page.locator("article").filter({ hasText: "주문 #8904" });
  const completedTrigger = completedOrder.getByRole("button").first();
  await completedTrigger.click();
  await expect(completedTrigger).toHaveAttribute("aria-expanded", "true");
  await expect(repeatedOrderTrigger).toHaveAttribute("aria-expanded", "false");
  const reversalTrigger = completedOrder.getByRole("button", { name: "완료 취소", exact: true });
  await reversalTrigger.click();
  const reversalDialog = page.getByRole("dialog", { name: "완료 처리를 취소할까요?" });
  await expect(reversalDialog).toContainText("합성 회원 03");
  await capture(page, "orders-reversal-confirmation", testInfo.project.name);
  await reversalDialog.getByRole("button", { name: "돌아가기", exact: true }).click();
  await expect(reversalTrigger).toBeFocused();

  await repeatedOrderTrigger.click();
  await page.route("**/api/admin/meetings/8101/orders", async (route) => {
    if (route.request().method() === "PATCH") {
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ error: "합성 주문 충돌" }),
      });
      return;
    }
    await route.continue();
  });
  const cancelTrigger = repeatedOrder.getByRole("button", { name: "주문 취소", exact: true }).first();
  await cancelTrigger.click();
  const cancelDialog = page.getByRole("dialog", { name: "주문 취소" });
  await expect(cancelDialog).toContainText("합성 회원 01");
  await cancelDialog.getByRole("button", { name: "주문 취소", exact: true }).click();
  await expect(page.getByRole("alert").filter({ hasText: "합성 주문 충돌" })).toBeVisible();
  await capture(page, "orders-cancel-conflict", testInfo.project.name);
  await cancelDialog.getByRole("button", { name: "닫기", exact: true }).click();
  await expect(cancelTrigger).toBeFocused();
  await page.unroute("**/api/admin/meetings/8101/orders");

  await page.goto("/admin/meetings/8101/settlement", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "정산 현황" })).toBeVisible();
  await expect(page.getByText("페이지 전체 정산", { exact: true })).toHaveCount(1);
  await expect(page.getByRole("heading", { name: "정산 대기" })).toBeVisible();

  const pendingRecipient = page.getByRole("button", { name: /합성 회원 01/ }).first();
  await pendingRecipient.click();
  await expect(pendingRecipient).toHaveAttribute("aria-expanded", "true");
  const adjustmentLabel = `${testInfo.project.name} 현장 조정`;
  await page.getByLabel(/조정 항목명/).first().fill(adjustmentLabel);
  await page.getByLabel(/조정 금액/).first().fill("-500");
  const addResponse = page.waitForResponse((response) => response.request().method() === "POST"
    && new URL(response.url()).pathname === "/api/admin/meetings/8101/settlement");
  await page.getByRole("button", { name: "조정 추가", exact: true }).first().click();
  expect((await addResponse).status()).toBe(201);
  await expect(page.getByText(adjustmentLabel, { exact: true })).toBeVisible();
  const adjustmentRow = page.locator("div.brand-card-soft").filter({ hasText: adjustmentLabel });
  await adjustmentRow.getByRole("button", { name: "삭제", exact: true }).click();
  const adjustmentDialog = page.getByRole("dialog", { name: "정산 항목을 삭제할까요?" });
  await expect(adjustmentDialog).toContainText(adjustmentLabel);
  await capture(page, "settlement-adjustment-confirmation", testInfo.project.name);
  const deleteResponse = page.waitForResponse((response) => response.request().method() === "DELETE"
    && /\/api\/admin\/meetings\/8101\/settlement\/\d+$/.test(new URL(response.url()).pathname));
  await adjustmentDialog.getByRole("button", { name: "정산 항목 삭제", exact: true }).click();
  expect((await deleteResponse).status()).toBe(200);
  await expect(page.getByText(adjustmentLabel, { exact: true })).toBeHidden();

  await page.goto("/admin/meetings/8102/settlement", { waitUntil: "networkidle" });
  await expect(page.getByText("정산 준비 중", { exact: true })).toBeVisible();
  await expect(page.getByText("금액 비공개").first()).toBeVisible();
  await page.getByRole("button", { name: "정산 열기", exact: true }).click();
  const openDialog = page.getByRole("dialog", { name: "정산을 열까요?" });
  await expect(openDialog).toContainText("참가자와 수신자");
  await capture(page, "settlement-open-confirmation", testInfo.project.name);
  await openDialog.getByRole("button", { name: "돌아가기", exact: true }).click();

  await page.goto("/admin/meetings/8103/settlement", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "송금 완료" })).toBeVisible();
  const completedRecipient = page.getByRole("button", { name: /합성 회원 01/ }).first();
  await completedRecipient.click();
  await expect(completedRecipient).toHaveAttribute("aria-expanded", "true");
  await capture(page, "settlement-completed-recipient", testInfo.project.name);
  await assertMobileGeometry(page);
  await assertAccessible(page);
});
