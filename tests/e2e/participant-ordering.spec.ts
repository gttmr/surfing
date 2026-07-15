import { expect, test } from "@playwright/test";
import { createQaBrowserContext } from "../fixtures/playwright-auth";
import {
  assertAccessible,
  authenticate,
  authenticateBanned,
  capture,
  closeOrderTestClient,
  openMemberOrders,
  prepareOrderTest,
} from "./participant-ordering.support";

test.beforeEach(async ({ context }) => {
  await prepareOrderTest(context);
  await authenticate(context, "member");
});

test.afterAll(async () => {
  await closeOrderTestClient();
});

test.setTimeout(90_000);

test("R01-O-01 searches 60 variants, jumps categories, reviews, and adds a submission", async ({ page }, testInfo) => {
  const sheet = await openMemberOrders(page);
  await expect(sheet.getByText("1번째 주문", { exact: true })).toBeVisible();
  await expect(sheet.getByText("2번째 주문", { exact: true })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "1번째 주문 수정" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "2번째 주문 수정" })).toHaveCount(0);
  await sheet.getByRole("button", { name: "새 주문 추가" }).click();

  const categoryNav = sheet.getByRole("navigation", { name: "메뉴 카테고리" });
  await expect(categoryNav).toBeVisible();
  const categoryButton = categoryNav.getByRole("button").nth(1);
  const sectionId = await categoryButton.getAttribute("aria-controls");
  await categoryButton.click();
  await expect(sheet.locator(`#${sectionId}-heading`)).toBeFocused();

  const search = sheet.getByRole("searchbox", { name: "메뉴 검색" });
  await search.fill("푸짐하게");
  await expect(sheet.getByRole("button", { name: /푸짐하게 수량 늘리기/ })).toHaveCount(12);
  await search.fill("합성 메뉴 13");
  await sheet.getByRole("button", { name: "합성 메뉴 13 수량 늘리기" }).click();
  await expect(sheet.getByText("담은 메뉴 1개")).toBeVisible();
  await sheet.getByRole("button", { name: "선택한 메뉴만 보기" }).click();
  await expect(sheet.getByRole("button", { name: /수량 늘리기/ })).toHaveCount(1);

  await sheet.getByRole("button", { name: "주문 내용 검토" }).click();
  await expect(sheet.getByRole("heading", { name: "주문 전 마지막 확인" })).toBeVisible();
  await expect(sheet.getByText("남은 지원 0원")).toBeVisible();
  await expect(sheet.getByText("7,000원", { exact: true })).toHaveCount(3);

  await page.route("**/api/meetings/8101/orders", async (route) => {
    if (route.request().method() === "POST") {
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "합성 주문 저장 실패" }) });
      return;
    }
    await route.continue();
  });
  await sheet.getByRole("button", { name: "이 내용으로 주문" }).click();
  await expect(sheet.getByRole("alert")).toContainText("합성 주문 저장 실패");
  await expect(sheet.getByText("합성 메뉴 13", { exact: true })).toBeVisible();
  await page.unroute("**/api/meetings/8101/orders");
  await sheet.getByRole("button", { name: "이 내용으로 주문" }).click();
  await expect(sheet.getByText("새 주문을 접수했습니다.")).toBeVisible();
  await expect(sheet.getByText("3건", { exact: true })).toBeVisible();

  const dataResponse = await page.request.get("/api/meetings/8101/orders");
  const data = await dataResponse.json();
  expect(data.participants.find((participant: { participantId: number }) => participant.participantId === 8801).orders).toHaveLength(3);
  expect(await sheet.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
  await assertAccessible(page);
  await capture(page, "participant-order-added", testInfo.project.name);
});

test("R01-O-02 replaces and cancels only an eligible whole submission", async ({ page }, testInfo) => {
  const sheet = await openMemberOrders(page);
  await sheet.getByRole("button", { name: "1번째 주문 수정" }).click();
  await expect(sheet.getByText("수정할 메뉴 3개")).toBeVisible();
  await sheet.getByRole("searchbox", { name: "메뉴 검색" }).fill("합성 메뉴 13");
  await sheet.getByRole("button", { name: "합성 메뉴 13 수량 늘리기" }).click();
  await sheet.getByRole("button", { name: "수정 내용 검토" }).click();
  await expect(sheet.getByText("기존 주문 전체를 바꿉니다.")).toBeVisible();
  await sheet.getByRole("button", { name: "이 내용으로 수정" }).click();
  await expect(sheet.getByText("주문을 수정했습니다.")).toBeVisible();
  await expect(sheet.getByText("3건", { exact: true })).toBeVisible();
  await expect(sheet.getByText("취소됨", { exact: true }).first()).toBeVisible();

  await sheet.getByRole("button", { name: "3번째 주문 취소" }).click();
  const cancelDialog = page.getByRole("dialog", { name: "3번째 주문을 취소할까요?" });
  await expect(cancelDialog).toBeVisible();
  await cancelDialog.getByRole("button", { name: "유지하기" }).click();
  await expect(sheet.getByRole("button", { name: "3번째 주문 취소" })).toBeVisible();
  await sheet.getByRole("button", { name: "3번째 주문 취소" }).click();
  await cancelDialog.getByRole("button", { name: "주문 취소" }).click();
  await expect(sheet.getByText("주문을 취소했습니다. 취소 내역은 그대로 보관됩니다.")).toBeVisible();

  const data = await (await page.request.get("/api/meetings/8101/orders")).json();
  const orders = data.participants.find((participant: { participantId: number }) => participant.participantId === 8801).orders;
  expect(orders[0].items.every((item: { cancelledReasonCode: string }) => item.cancelledReasonCode === "participant_edit")).toBe(true);
  expect(orders[2].items.every((item: { cancelledReasonCode: string }) => item.cancelledReasonCode === "participant_cancel")).toBe(true);
  await assertAccessible(page);
  await capture(page, "participant-order-history", testInfo.project.name);
});

test("R01-O-03 preserves a failed edit and explicitly reapplies it after 409", async ({ page }, testInfo) => {
  const sheet = await openMemberOrders(page);
  await sheet.getByRole("button", { name: "1번째 주문 수정" }).click();
  await sheet.getByRole("searchbox", { name: "메뉴 검색" }).fill("합성 메뉴 13");
  await sheet.getByRole("button", { name: "합성 메뉴 13 수량 늘리기" }).click();
  await sheet.getByRole("button", { name: "수정 내용 검토" }).click();

  let conflict = false;
  const current = await (await page.request.get("/api/meetings/8101/orders")).json();
  await page.route("**/api/meetings/8101/orders/8901", async (route) => {
    if (!conflict) {
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "합성 저장 실패" }) });
      conflict = true;
      return;
    }
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ error: "주문 상태가 변경되었습니다.", code: "ORDER_VERSION_CONFLICT", current }),
    });
  });
  await sheet.getByRole("button", { name: "이 내용으로 수정" }).click();
  await expect(sheet.getByRole("alert")).toContainText("합성 저장 실패");
  await expect(sheet.getByText("합성 메뉴 13", { exact: true })).toBeVisible();
  await capture(page, "participant-order-failure-draft", testInfo.project.name);

  await sheet.getByRole("button", { name: "이 내용으로 수정" }).click();
  await expect(sheet.getByRole("button", { name: "보관한 선택 다시 담기" })).toBeVisible();
  await sheet.getByRole("button", { name: "보관한 선택 다시 담기" }).click();
  await expect(sheet.getByText("수정할 메뉴 4개")).toBeVisible();
  await expect(sheet.getByRole("status", { name: "합성 메뉴 13 수량" })).toHaveText("2");
  await capture(page, "participant-order-conflict-reapply", testInfo.project.name);
});

test("R01-O-04 disables empty carts and keeps banned members read-only", async ({ context, page }, testInfo) => {
  let sheet = await openMemberOrders(page);
  await sheet.getByRole("button", { name: "새 주문 추가" }).click();
  await expect(sheet.getByRole("button", { name: "주문 내용 검토" })).toBeDisabled();
  const forbidden = await page.request.delete("/api/meetings/8101/orders/8903", { data: { expectedItems: [] } });
  expect(forbidden.status()).toBe(403);
  expect((await forbidden.json()).code).toBe("ORDER_FORBIDDEN");

  const beforeInvalid = await (await page.request.get("/api/meetings/8101/orders")).json();
  const invalidItems = [
    [],
    [{ menuItemId: 99_999, optionChoiceId: null, quantity: 1 }],
    [{ menuItemId: 8437, optionChoiceId: null, quantity: 1 }],
    [{ menuItemId: 8413, optionChoiceId: 8504, quantity: 1 }],
  ];
  for (const items of invalidItems) {
    const invalid = await page.request.post("/api/meetings/8101/orders", { data: { participantId: 8801, items } });
    expect(invalid.status()).toBe(400);
  }
  const afterInvalid = await (await page.request.get("/api/meetings/8101/orders")).json();
  expect(afterInvalid.participants.find((participant: { participantId: number }) => participant.participantId === 8801).orders)
    .toHaveLength(beforeInvalid.participants.find((participant: { participantId: number }) => participant.participantId === 8801).orders.length);

  await authenticateBanned(context);
  sheet = await openMemberOrders(page);
  await expect(sheet.getByText("읽기 전용", { exact: true })).toBeVisible();
  await expect(sheet.getByText("이 계정에서는 주문 내역만 확인할 수 있습니다.")).toBeVisible();
  await expect(sheet.getByRole("button", { name: "메뉴 고르기" })).toHaveCount(0);
  await sheet.getByRole("button", { name: "주문 내역 보기" }).click();
  await expect(sheet.getByText("표시할 주문 내역이 없습니다")).toBeVisible();
  await expect(sheet.getByText("첫 주문을 남겨 보세요.")).toHaveCount(0);
  const bannedWrite = await page.request.post("/api/meetings/8101/orders", { data: { participantId: 8808, items: [] } });
  expect(bannedWrite.status()).toBe(403);
  expect((await bannedWrite.json()).code).toBe("ORDER_FORBIDDEN");
  await assertAccessible(page);
  await capture(page, "participant-order-read-only", testInfo.project.name);
});

test("R01-O-05 concurrent replacements create one winner and authoritative conflict", async ({ browser }) => {
  const evidence = process.env.EVIDENCE_DIR ?? "";
  const first = await createQaBrowserContext(browser, "member", evidence);
  const second = await createQaBrowserContext(browser, "member", evidence);
  try {
    const current = await (await first.request.get("/api/meetings/8101/orders")).json();
    const participant = current.participants.find((item: { participantId: number }) => item.participantId === 8801);
    const source = participant.orders.find((item: { orderId: number }) => item.orderId === 8901);
    const payload = {
      replacementItems: [{ menuItemId: 8413, optionChoiceId: null, quantity: 2 }],
      expectedItems: source.items.map((item: { id: number; updatedAt: string }) => ({ id: item.id, updatedAt: item.updatedAt })),
    };
    const responses = await Promise.all([
      first.request.patch("/api/meetings/8101/orders/8901", { data: payload }),
      second.request.patch("/api/meetings/8101/orders/8901", { data: payload }),
    ]);
    expect(responses.map((response) => response.status()).sort()).toEqual([200, 409]);
    const conflictResponse = responses.find((response) => response.status() === 409);
    expect(conflictResponse).toBeTruthy();
    const conflict = await conflictResponse?.json();
    expect(["ORDER_NOT_EDITABLE", "ORDER_VERSION_CONFLICT"]).toContain(conflict.code);
    const fresh = await (await first.request.get("/api/meetings/8101/orders")).json();
    expect(conflict.current).toEqual(fresh);
    expect(fresh.participants.find((item: { participantId: number }) => item.participantId === 8801).orders).toHaveLength(3);
  } finally {
    await Promise.all([first.close(), second.close()]);
  }
});
