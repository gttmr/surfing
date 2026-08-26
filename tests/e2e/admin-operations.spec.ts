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
  await expect(page.getByRole("heading", { name: "입금 현황", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "회원 입금 현황" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "최종 정산" })).toBeVisible();
  await expect(page.getByText(/회원 공개됨/)).toBeVisible();
  await expect(page.getByLabel(/조정 항목명/)).toHaveCount(0);
  const lockedAdjustmentResponse = await page.request.post("/api/admin/meetings/8101/settlement", {
    data: { participantId: 8801, label: `${testInfo.project.name} 공개 후 조정`, amount: -500 },
  });
  expect(lockedAdjustmentResponse.status()).toBe(409);
  await capture(page, "billing-payment-status", testInfo.project.name);

  await page.goto("/admin/meetings/8102/settlement", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "청구 검토" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "청구 공개 준비" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "회원별 청구 항목" })).toBeVisible();
  await expect(page.getByRole("button", { name: "청구 내역 공개", exact: true })).toBeDisabled();
  await expect(page.getByText("준비 항목을 모두 완료해야 공개할 수 있습니다.")).toBeVisible();

  const billingRecipient = page.locator("article").filter({ hasText: "합성 회원 03" }).first();
  await billingRecipient.getByRole("button").first().click();
  const adjustmentName = page.getByLabel("미연동 합성 동반인 조정 항목명");
  const adjustmentAmount = page.getByLabel("미연동 합성 동반인 조정 금액");
  await expect(adjustmentAmount).toHaveAttribute("inputmode", "numeric");
  const deductButton = page.getByRole("button", { name: "청구에서 차감 −" }).first();
  await deductButton.click();
  await expect(deductButton).toHaveAttribute("aria-pressed", "true");
  await adjustmentName.fill("안드로이드 차감 확인");
  await adjustmentAmount.fill("5000");
  await page.getByRole("button", { name: "조정 추가" }).first().click();
  await expect(page.getByText("안드로이드 차감 확인")).toBeVisible();
  await expect(page.locator("div.brand-card-soft").filter({ hasText: "안드로이드 차감 확인" })).toContainText("-5,000원");
  await capture(page, "billing-readiness-gate", testInfo.project.name);

  await page.goto("/admin/meetings/8103/settlement", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "입금 현황", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "회원 입금 현황" })).toBeVisible();
  const reportedRecipient = page.locator("details").filter({ hasText: "합성 회원 01" }).first();
  await reportedRecipient.locator("summary").click();
  await expect(reportedRecipient).toContainText("납부 없음");
  await expect(reportedRecipient).toContainText("입금 확인이 필요하지 않습니다.");
  await expect(reportedRecipient.getByRole("button", { name: "계좌 입금 확인" })).toHaveCount(0);
  await capture(page, "billing-reported-recipient", testInfo.project.name);
  await assertMobileGeometry(page);
  await assertAccessible(page);
});
