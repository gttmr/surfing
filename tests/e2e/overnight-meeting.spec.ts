import { expect, test, type BrowserContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { addDaysToDate } from "../../src/lib/meeting-group";
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

test("1박2일은 한 번 신청하고 날짜별 실제 이용을 합쳐 한 번 청구한다", async ({ context, page }, testInfo) => {
  let groupId: number | null = null;
  let meetingIds: number[] = [];
  const location = `1박2일 QA 해변 ${testInfo.project.name}`;

  try {
    await page.goto("/admin/meetings", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "새 모임" }).click();
    await page.getByRole("button", { name: "1박 2일" }).click();
    await expect(page.getByText("전체 일정", { exact: true })).toBeVisible();
    await expect(page.getByText("둘째 날 일정", { exact: true })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "둘째 날 입력" })).toHaveCount(0);
    await page.getByLabel("시작일").fill("2098-09-12");
    await expect(page.getByLabel("종료일")).toHaveText("2098-09-13");
    await page.getByLabel("시작 시간").fill("07:00");
    await page.getByLabel("종료 시간").fill("16:00");
    await page.getByLabel("장소").fill(location);
    await page.getByLabel("회원 기본 참가비").fill("30000");
    await page.getByLabel("동반인 기본 참가비").fill("50000");
    await page.getByLabel("1인 숙박비").fill("50000");

    const creationResponse = page.waitForResponse((response) => response.request().method() === "POST"
      && new URL(response.url()).pathname === "/api/admin/meeting-groups");
    await page.getByRole("button", { name: "1박 2일 모임 생성" }).click();
    const createdResponse = await creationResponse;
    expect(createdResponse.status()).toBe(201);
    const created = await createdResponse.json() as {
      group: { id: number; lodgingFee: number; days: Array<{ id: number }> };
      meetings: Array<{ id: number }>;
    };
    groupId = created.group.id;
    expect(created.group.lodgingFee).toBe(50000);
    meetingIds = created.group.days.map((day) => day.id);
    const [day1MeetingId, day2MeetingId] = meetingIds;
    const storedMeetings = await client.meeting.findMany({
      where: { id: { in: meetingIds } },
      orderBy: { groupDayIndex: "asc" },
      select: { date: true, startTime: true, endTime: true, location: true },
    });
    expect(storedMeetings).toEqual([
      { date: "2098-09-12", startTime: "07:00", endTime: "23:59", location },
      { date: "2098-09-13", startTime: "00:00", endTime: "16:00", location },
    ]);
    await expect(page).toHaveURL(new RegExp(`/admin/meetings/${day1MeetingId}$`));
    await expect(page.getByText("1박 2일", { exact: true })).toBeVisible();
    await expect(page.getByText("07:00 시작 · 16:00 종료", { exact: false })).toBeVisible();
    await expect(page.getByText("0/6 확인", { exact: true })).toBeVisible();
    await expect(page.getByText("23:59", { exact: false })).toHaveCount(0);
    await expect(page.getByText("00:00", { exact: false })).toHaveCount(0);
    const dayTabs = page.getByRole("tablist", { name: "운영 날짜 선택" });
    await expect(dayTabs.getByRole("tab", { name: /1일차/ })).toHaveAttribute("aria-selected", "true");
    await dayTabs.getByRole("tab", { name: /2일차/ }).click();
    await expect(dayTabs.getByRole("tab", { name: /2일차/ })).toHaveAttribute("aria-selected", "true");

    await useAuth(context, "member");
    await page.goto("/?date=2098-09-12", { waitUntil: "networkidle" });
    await expect(page.getByText("1박 2일 · 정기", { exact: true })).toBeVisible();
    await expect(page.getByText(`07:00 시작 · 16:00 종료 · ${location}`, { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "이용 안 함 예상 30,000원" })).toBeVisible();
    await expect(page.getByRole("button", { name: "강습+장비 예상 40,000원" })).toBeVisible();
    await expect(page.getByText("현재 예상 금액").first()).toBeVisible();
    await expect(page.getByText("30,000원", { exact: true }).last()).toBeVisible();
    await expect(page.getByText("23:59", { exact: false })).toHaveCount(0);
    await expect(page.getByText("00:00", { exact: false })).toHaveCount(0);
    const participantTab = page.getByRole("tab", { name: /내 참가/ });
    if (await participantTab.getAttribute("aria-selected") !== "true") await participantTab.click();
    await page.getByRole("checkbox", { name: /장비 대여/ }).click();
    await expect(page.getByText("첫 장비 대여일로 동호회 지원이 적용됩니다.", { exact: true })).toBeVisible();
    await expect(page.getByText("30,000원", { exact: true }).last()).toBeVisible();
    await page.getByRole("button", { name: "장비만 예상 30,000원" }).click();
    await expect(page.getByText("60,000원", { exact: true })).toBeVisible();
    await page.getByRole("checkbox", { name: /동호회 숙소 이용/ }).click();
    await expect(page.getByText("110,000원", { exact: true })).toBeVisible();
    const signupResponse = page.waitForResponse((response) => response.request().method() === "POST"
      && new URL(response.url()).pathname === "/api/participants/overnight");
    await page.getByRole("button", { name: "참가 신청하기", exact: true }).click();
    expect((await signupResponse).status()).toBe(201);
    await expect(page.getByRole("heading", { name: "신청이 완료되었습니다!" })).toBeVisible();
    await expect(page.getByRole("tablist", { name: "이용 날짜" })).toBeVisible();

    const signedUp = await client.participant.findMany({
      where: { meetingId: { in: meetingIds }, kakaoId: "qa-user-01", companionId: null },
      orderBy: { meetingId: "asc" },
    });
    expect(signedUp).toHaveLength(2);
    expect(signedUp.every((participant) => participant.usesClubLodging)).toBe(true);
    expect(signedUp.find((participant) => participant.meetingId === day2MeetingId)?.hasRental).toBe(true);

    await useAuth(context, "password-admin");
    await page.goto(`/admin/meetings/${day2MeetingId}/settlement`, { waitUntil: "networkidle" });
    await expect(page.getByRole("heading", { name: "1박 2일 합산 청구 검토" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "숙박비 자동 반영" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "공동 숙박비 반영" })).toHaveCount(0);
    const recipient = page.locator("article").filter({ hasText: "합성 회원 01" }).first();
    await recipient.getByRole("button").first().click();
    await expect(recipient.getByText(/숙박 50,000원/)).toBeVisible();

    const today = getTodayInSeoul();
    const billingDay2 = addDaysToDate(today, -1);
    const billingDay1 = addDaysToDate(today, -2);
    await client.$transaction([
      client.meeting.update({ where: { id: day1MeetingId }, data: { date: billingDay1, endTime: "16:00", isOpen: false } }),
      client.meeting.update({ where: { id: day2MeetingId }, data: { date: billingDay2, endTime: "16:00", isOpen: false } }),
      client.participant.updateMany({
        where: { id: { in: signedUp.map((participant) => participant.id) } },
        data: { attendanceStatus: "ATTENDED", attendanceUpdatedAt: new Date(), attendanceUpdatedByKakaoId: "qa-admin" },
      }),
    ]);
    const day1Participant = signedUp.find((participant) => participant.meetingId === day1MeetingId)!;
    const day2Participant = signedUp.find((participant) => participant.meetingId === day2MeetingId)!;
    const [day1UsageItem, day2UsageItem] = await client.$transaction([
      client.surfUsageItem.create({
        data: { meetingId: day1MeetingId, name: "1일차 장비", serviceType: "EQUIPMENT_RENTAL", shopPrice: 30_000, memberBillingPolicy: "REGULAR_FREE_COMPANION_SHOP", regularMemberPrice: 0 },
      }),
      client.surfUsageItem.create({
        data: { meetingId: day2MeetingId, name: "2일차 장비", serviceType: "EQUIPMENT_RENTAL", shopPrice: 35_000, memberBillingPolicy: "REGULAR_FREE_COMPANION_SHOP", regularMemberPrice: 0 },
      }),
    ]);
    await client.$transaction([
      client.participantSurfUsage.create({
        data: { meetingId: day1MeetingId, participantId: day1Participant.id, usageItemId: day1UsageItem.id, quantity: 1, usageItemNameSnapshot: day1UsageItem.name, serviceTypeSnapshot: day1UsageItem.serviceType, shopUnitPriceSnapshot: day1UsageItem.shopPrice, memberBillingPolicySnapshot: day1UsageItem.memberBillingPolicy, regularMemberPriceSnapshot: day1UsageItem.regularMemberPrice, source: "shop" },
      }),
      client.participantSurfUsage.create({
        data: { meetingId: day2MeetingId, participantId: day2Participant.id, usageItemId: day2UsageItem.id, quantity: 1, usageItemNameSnapshot: day2UsageItem.name, serviceTypeSnapshot: day2UsageItem.serviceType, shopUnitPriceSnapshot: day2UsageItem.shopPrice, memberBillingPolicySnapshot: day2UsageItem.memberBillingPolicy, regularMemberPriceSnapshot: day2UsageItem.regularMemberPrice, source: "shop" },
      }),
      client.participantSurfUsageSubmission.create({ data: { meetingId: day1MeetingId, participantId: day1Participant.id, status: "CONFIRMED", confirmedAt: new Date(), confirmedByKakaoId: "qa-shop" } }),
      client.participantSurfUsageSubmission.create({ data: { meetingId: day2MeetingId, participantId: day2Participant.id, status: "CONFIRMED", confirmedAt: new Date(), confirmedByKakaoId: "qa-shop" } }),
    ]);

    const reviewResponse = await page.request.put(`/api/admin/meetings/${day2MeetingId}/settlement`, { data: { action: "confirm-review" } });
    expect(reviewResponse.status()).toBe(200);
    const publishResponse = await page.request.put(`/api/admin/meetings/${day2MeetingId}/settlement`, { data: { action: "publish" } });
    expect(publishResponse.status()).toBe(200);
    const publishedMeetings = await client.meeting.findMany({ where: { id: { in: meetingIds } }, select: { settlementOpen: true, billingReviewConfirmedAt: true } });
    expect(publishedMeetings.every((meeting) => meeting.settlementOpen && meeting.billingReviewConfirmedAt)).toBe(true);
    expect(await client.meetingBillingSnapshot.count({ where: { meetingId: { in: meetingIds } } })).toBe(1);

    await useAuth(context, "member");
    await page.goto("/settlement", { waitUntil: "networkidle" });
    await expect(page.getByText("1박 2일 합산", { exact: true })).toBeVisible();
    await expect(page.getByText("실제 이용 · 1일차 장비 × 1", { exact: true })).toBeVisible();
    await expect(page.getByText("실제 이용 · 2일차 장비 × 1", { exact: true })).toBeVisible();
    await expect(page.getByText("115,000원", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("navigation", { name: "회원 메뉴" })).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    await assertAccessible(page);
  } finally {
    if (meetingIds.length > 0) {
      await client.userNotification.deleteMany({ where: { meetingId: { in: meetingIds } } });
    }
    if (groupId !== null) {
      await client.meetingGroup.deleteMany({ where: { id: groupId } });
    }
  }
});
