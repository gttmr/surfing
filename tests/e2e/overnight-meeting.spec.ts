import { expect, test, type BrowserContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { addDaysToDate } from "../../src/lib/meeting-days";
import { getTodayInSeoul } from "../../src/lib/date";
import { qaStorageState, type QaAuthContextKey } from "../fixtures/playwright-auth";
import { assertAccessible, prepareAdminContext } from "./admin-meetings-support";

const client = new PrismaClient();

async function useAuth(context: BrowserContext, key: QaAuthContextKey) {
  await context.clearCookies();
  const state = qaStorageState(key);
  if (state && typeof state !== "string") await context.addCookies(state.cookies);
}

test.beforeEach(async ({ context }) => {
  await prepareAdminContext(context);
});

test.afterAll(async () => {
  await client.$disconnect();
});

test("1박2일은 모임 하나로 신청하고 날짜별 실제 이용을 합쳐 한 번 청구한다", async ({ context, page }, testInfo) => {
  let meetingId: number | null = null;
  const location = `1박2일 QA 해변 ${testInfo.project.name}`;

  try {
    await page.goto("/admin/meetings", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "새 모임" }).click();
    await page.getByRole("button", { name: "1박 2일" }).click();
    await expect(page.getByText("전체 일정", { exact: true })).toBeVisible();
    await page.getByLabel("시작일").fill("2098-09-12");
    await expect(page.getByLabel("종료일")).toHaveText("2098-09-13");
    await page.getByLabel("시작 시간").fill("07:00");
    await page.getByLabel("종료 시간").fill("16:00");
    await page.getByLabel("장소").fill(location);
    await page.getByLabel("정회원 1박 참가비").fill("30000");
    await page.getByLabel("동반인 1박 참가비").fill("50000");
    await page.getByLabel("1인 숙박비").fill("50000");

    const creationResponse = page.waitForResponse((response) => response.request().method() === "POST"
      && new URL(response.url()).pathname === "/api/meetings");
    await page.getByRole("button", { name: "1박 2일 모임 생성" }).click();
    const createdResponse = await creationResponse;
    expect(createdResponse.status()).toBe(201);
    const created = await createdResponse.json() as { id: number };
    meetingId = created.id;
    const stored = await client.meeting.findUniqueOrThrow({
      where: { id: meetingId },
      select: { date: true, endDate: true, startTime: true, endTime: true, location: true, regularFee: true, companionFee: true, lodgingFee: true },
    });
    expect(stored).toEqual({
      date: "2098-09-12",
      endDate: "2098-09-13",
      startTime: "07:00",
      endTime: "16:00",
      location,
      regularFee: 30000,
      companionFee: 50000,
      lodgingFee: 50000,
    });
    await expect(page).toHaveURL(new RegExp(`/admin/meetings/${meetingId}$`));
    await expect(page.getByText("1박 2일", { exact: true })).toBeVisible();
    await expect(page.getByText("07:00 시작 · 16:00 종료", { exact: false })).toBeVisible();
    await expect(page.getByText("정회원 1박 참가비", { exact: true })).toBeVisible();
    await expect(page.getByRole("tablist", { name: "운영 날짜 선택" })).toHaveCount(0);

    await useAuth(context, "member");
    await page.goto("/?date=2098-09-13", { waitUntil: "networkidle" });
    await expect(page.getByText("1박 2일 · 정기", { exact: true })).toBeVisible();
    await expect(page.getByText(`07:00 시작 · 16:00 종료 · ${location}`, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "강습 안 함 예상 30,000원" })).toBeVisible();
    await expect(page.getByRole("button", { name: "강습 신청 예상 40,000원" })).toBeVisible();
    const participantTab = page.getByRole("tab", { name: /내 참가/ });
    if (await participantTab.getAttribute("aria-selected") !== "true") await participantTab.click();
    // 첫째 날 "장비 대여 필요"(강습 안 함일 때만 표시)가 먼저, 둘째 날 장비 선택이 뒤에 나온다.
    const rentalChecks = page.getByRole("checkbox", { name: /장비 대여 필요/ });
    await expect(rentalChecks).toHaveCount(2);
    await rentalChecks.last().click();
    await expect(page.getByText("첫 장비 대여일로 동호회 지원이 적용됩니다.", { exact: true })).toBeVisible();
    await rentalChecks.first().click();
    await page.getByRole("checkbox", { name: /동호회 숙소 이용/ }).click();
    await expect(page.getByText("110,000원", { exact: true })).toBeVisible();
    const signupResponse = page.waitForResponse((response) => response.request().method() === "POST"
      && new URL(response.url()).pathname === "/api/participants");
    await page.getByRole("button", { name: "참가 신청하기", exact: true }).click();
    expect((await signupResponse).status()).toBe(201);
    await expect(page.getByRole("heading", { name: "신청이 완료되었습니다!" })).toBeVisible();

    const signedUp = await client.participant.findMany({
      where: { meetingId, kakaoId: "qa-user-01", companionId: null },
    });
    expect(signedUp).toHaveLength(1);
    expect(signedUp[0].usesClubLodging).toBe(true);
    expect(signedUp[0].hasRental).toBe(true);
    expect(signedUp[0].hasDay2Rental).toBe(true);

    await useAuth(context, "password-admin");
    await page.goto(`/admin/meetings/${meetingId}/settlement`, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "1박 2일 청구 검토" })).toBeVisible();
    const recipient = page.locator("article").filter({ hasText: "합성 회원 01" }).first();
    await recipient.getByRole("button").first().click();
    await expect(recipient.getByText(/숙박 50,000원/)).toBeVisible();

    // 일정이 끝난 것으로 옮기고, 날짜별 실제 이용을 기록·확정한다(첫날 장비는 지원, 둘째 날은 샵 가격).
    const today = getTodayInSeoul();
    await client.meeting.update({
      where: { id: meetingId },
      data: { date: addDaysToDate(today, -2), endDate: addDaysToDate(today, -1), isOpen: false },
    });
    const [day1Item, day2Item] = await client.$transaction([
      client.surfUsageItem.create({ data: { name: "1일차 장비", serviceType: "EQUIPMENT_RENTAL", shopPrice: 30_000, regularPrice: 0 } }),
      client.surfUsageItem.create({ data: { name: "2일차 장비", serviceType: "EQUIPMENT_RENTAL", shopPrice: 35_000, regularPrice: 0 } }),
    ]);
    const participantId = signedUp[0].id;
    await client.$transaction([
      ...[[1, day1Item], [2, day2Item]].map(([day, item]) => {
        const usageItem = item as typeof day1Item;
        return client.participantSurfUsage.create({
          data: {
            meetingId: meetingId!,
            participantId,
            day: day as number,
            usageItemId: usageItem.id,
            quantity: 1,
            usageItemNameSnapshot: usageItem.name,
            serviceTypeSnapshot: usageItem.serviceType,
            shopUnitPriceSnapshot: usageItem.shopPrice,
            regularPriceSnapshot: usageItem.regularPrice,
            source: "shop",
          },
        });
      }),
      client.participant.update({ where: { id: participantId }, data: { usageSubmittedAt: new Date(), usageConfirmedAt: new Date() } }),
    ]);

    const publishResponse = await page.request.put(`/api/admin/meetings/${meetingId}/settlement`, { data: { action: "publish" } });
    expect(publishResponse.status()).toBe(200);
    const published = await client.meeting.findUniqueOrThrow({ where: { id: meetingId }, select: { billingPublishedAt: true, isOpen: true } });
    expect(published.billingPublishedAt).not.toBeNull();
    expect(published.isOpen).toBe(false);
    expect(await client.meetingBillingSnapshot.count({ where: { meetingId } })).toBe(1);

    await useAuth(context, "member");
    await page.goto("/settlement", { waitUntil: "networkidle" });
    await expect(page.getByText("1박 2일", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("115,000원", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("navigation", { name: "회원 메뉴" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await assertAccessible(page);
  } finally {
    if (meetingId !== null) {
      await client.userNotification.deleteMany({ where: { meetingId } });
      await client.meeting.deleteMany({ where: { id: meetingId } });
      await client.surfUsageItem.deleteMany({ where: { name: { in: ["1일차 장비", "2일차 장비"] }, usages: { none: {} } } });
    }
  }
});
