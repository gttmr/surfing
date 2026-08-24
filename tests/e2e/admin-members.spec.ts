import { expect, test, type BrowserContext } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { installBrowserEgressGuard } from "../../scripts/qa/browser-egress";
import { MOBILE_UX_FIXTURE_IDS } from "../fixtures/mobile-ux";
import { qaStorageState } from "../fixtures/playwright-auth";
import { assertAccessible, capture, evidenceDirectory } from "./admin-pricing-settings.helpers";
import { encodeSession } from "../../src/lib/session";

const DISPOSABLE_MEMBER = {
  id: 8299,
  kakaoId: "qa-disposable-member-delete",
  name: "삭제 전용 합성 회원",
} as const;

async function seedDisposableMember(): Promise<void> {
  const client = new PrismaClient();
  try {
    await client.$transaction([
      client.deletedKakaoId.deleteMany({ where: { kakaoId: DISPOSABLE_MEMBER.kakaoId } }),
      client.user.upsert({
        where: { id: DISPOSABLE_MEMBER.id },
        create: { ...DISPOSABLE_MEMBER, role: "MEMBER", memberType: "REGULAR" },
        update: { kakaoId: DISPOSABLE_MEMBER.kakaoId, name: DISPOSABLE_MEMBER.name, role: "MEMBER", memberType: "REGULAR", penaltyCount: 0 },
      }),
    ]);
  } finally {
    await client.$disconnect();
  }
}

async function removeDisposableMember(): Promise<void> {
  const client = new PrismaClient();
  try {
    await client.$transaction([
      client.user.deleteMany({ where: { id: DISPOSABLE_MEMBER.id } }),
      client.deletedKakaoId.deleteMany({ where: { kakaoId: DISPOSABLE_MEMBER.kakaoId } }),
    ]);
  } finally {
    await client.$disconnect();
  }
}

async function authenticate(context: BrowserContext, key: "kakao-admin" | "password-admin") {
  await context.clearCookies();
  const storage = qaStorageState(key);
  if (storage && typeof storage !== "string") await context.addCookies(storage.cookies);
}

function hasAdminRole(value: unknown): boolean {
  return typeof value === "object" && value !== null && "role" in value && value.role === "ADMIN";
}

test.beforeEach(async ({ context }) => {
  if (!evidenceDirectory) throw new Error("EVIDENCE_DIR is required");
  await installBrowserEgressGuard(context, evidenceDirectory);
  await authenticate(context, "password-admin");
});

test.afterAll(removeDisposableMember);

test("member search and filters open a detail sheet without losing list context", async ({ page }, testInfo) => {
  await page.goto("/admin/members", { waitUntil: "networkidle" });
  const search = page.getByRole("searchbox", { name: "회원 검색", exact: true });
  await search.fill("합성 회원 02");
  await page.getByLabel("회원 유형 필터").selectOption("COMPANION");
  await expect(page.getByRole("list", { name: "회원 검색 결과" })).toContainText("합성 회원 02");
  await expect(page.getByText("1/35명")).toBeVisible();

  await search.fill("찾을 수 없는 회원");
  await expect(page.getByRole("heading", { name: "검색 결과가 없습니다" })).toBeVisible();
  await capture(page, "members-no-result", testInfo.project.name);
  await page.getByRole("button", { name: "검색 조건 지우기" }).click();

  const longMember = page.getByRole("button", { name: /서른다섯 번째 사용자/ });
  await longMember.scrollIntoViewIfNeeded();
  const scrollBeforeOpen = await page.evaluate(() => window.scrollY);
  await longMember.click();
  await expect(page.getByRole("dialog", { name: /합성 회원 이름이 매우 길어서/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "기본 정보" })).toBeVisible();
  await capture(page, "members-detail-sheet", testInfo.project.name);
  await assertAccessible(page);

  await page.getByRole("button", { name: "회원 상세 닫기" }).click();
  await expect(longMember).toBeFocused();
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBeforeOpen);
  await expect(search).toHaveValue("");
  await expect(page.getByLabel("회원 유형 필터")).toHaveValue("ALL");

  await search.fill("서른다섯");
  await longMember.click();
  await page.getByRole("button", { name: "편집" }).click();
  await page.getByLabel("회원 등급", { exact: true }).selectOption("SHOP_OWNER");
  await page.getByRole("button", { name: "회원 상세 닫기" }).click();
  const discardDialog = page.getByRole("dialog", { name: "변경 내용을 버릴까요?" });
  await expect(discardDialog).toBeVisible();
  await page.getByRole("button", { name: "계속 편집" }).click();
  await expect(page.getByLabel("회원 등급", { exact: true })).toHaveValue("SHOP_OWNER");
  await page.getByRole("button", { name: "회원 상세 닫기" }).click();
  await page.getByRole("button", { name: "버리고 닫기" }).click();
  await expect(discardDialog).toHaveCount(0);
  await expect(longMember).toBeFocused();
  await expect(search).toHaveValue("서른다섯");
});

test("member edits stay draft-only through validation and server failure", async ({ page }, testInfo) => {
  let putCount = 0;
  await page.route("**/api/admin/members/*", async (route) => {
    if (route.request().method() !== "PUT") {
      await route.continue();
      return;
    }
    putCount += 1;
    if (putCount === 1) {
      await route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ error: "synthetic failure" }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });

  await page.goto("/admin/members", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: /합성 회원 01/ }).click();
  await page.getByRole("button", { name: "편집" }).click();
  await page.getByLabel("회원 등급", { exact: true }).selectOption("SHOP_OWNER");
  await expect(page.getByText("초안 있음")).toBeVisible();
  expect(putCount).toBe(0);

  await page.getByLabel("패널티 횟수").fill("-1");
  await page.getByRole("button", { name: "변경사항 저장" }).click();
  await expect(page.getByText("패널티는 0~999 사이 숫자로 입력해 주세요.")).toBeVisible();
  await expect(page.getByLabel("패널티 횟수")).toBeFocused();
  expect(putCount).toBe(0);

  await page.getByLabel("패널티 횟수").fill("2");
  await page.getByRole("button", { name: "변경사항 저장" }).click();
  await expect(page.getByText("저장되지 않았습니다")).toBeVisible();
  await expect(page.getByLabel("회원 등급", { exact: true })).toHaveValue("SHOP_OWNER");
  await expect(page.getByLabel("패널티 횟수")).toHaveValue("2");
  await capture(page, "members-save-error-draft", testInfo.project.name);

  await page.getByRole("button", { name: "변경사항 저장" }).click();
  await expect(page.getByText("회원 정보가 저장되었습니다.")).toBeVisible();
  await expect(page.getByRole("button", { name: "편집" })).toBeVisible();
  expect(putCount).toBe(2);
  await assertAccessible(page);
});

test("named member deletion requires confirmation and cancel restores focus", async ({ page }, testInfo) => {
  await seedDisposableMember();
  const endpoint = `/api/admin/members/${DISPOSABLE_MEMBER.id}`;
  const staleSessionCookie = `__session=${encodeSession({ kakaoId: DISPOSABLE_MEMBER.kakaoId, nickname: DISPOSABLE_MEMBER.name })}`;
  await page.goto("/admin/members", { waitUntil: "networkidle" });
  const target = page.getByRole("button", { name: DISPOSABLE_MEMBER.name });
  await target.click();
  const deleteButton = page.getByRole("button", { name: "회원 삭제", exact: true });
  await deleteButton.click();
  await expect(page.getByRole("dialog", { name: `${DISPOSABLE_MEMBER.name}님을 삭제할까요?` })).toBeVisible();
  await expect(page.getByText("회원 계정, 참가 기록, 소유한 동반인 정보가 함께 정리됩니다.")).toBeVisible();
  await capture(page, "members-delete-confirm", testInfo.project.name);
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await expect(deleteButton).toBeFocused();
  expect((await page.request.get(endpoint, { failOnStatusCode: false })).status()).toBe(200);

  await deleteButton.click();
  await page.getByRole("button", { name: "회원 삭제", exact: true }).last().click();
  await expect(page.getByRole("button", { name: DISPOSABLE_MEMBER.name })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /합성 회원 34/ })).toBeVisible();
  await expect(page.getByRole("searchbox", { name: "회원 검색", exact: true })).toBeFocused();
  expect((await page.request.get(endpoint, { failOnStatusCode: false })).status()).toBe(404);

  const staleProfile = await page.request.get("/api/profile", {
    failOnStatusCode: false,
    headers: { cookie: staleSessionCookie },
  });
  expect(staleProfile.status()).toBe(401);
  expect((await page.request.get(endpoint, { failOnStatusCode: false })).status()).toBe(404);
});

test("identified and password admins preserve one admin across demotion and deletion", async ({ context }) => {
  await authenticate(context, "kakao-admin");
  const selfDemotion = await context.request.put(`/api/admin/members/${MOBILE_UX_FIXTURE_IDS.users.admin}`, {
    data: { role: "MEMBER" },
    failOnStatusCode: false,
  });
  expect(selfDemotion.status()).toBe(403);
  await expect(selfDemotion.json()).resolves.toEqual({ code: "SELF_ADMIN_PROTECTED" });
  const selfDelete = await context.request.delete(`/api/admin/members/${MOBILE_UX_FIXTURE_IDS.users.admin}`, { failOnStatusCode: false });
  expect(selfDelete.status()).toBe(403);
  await expect(selfDelete.json()).resolves.toEqual({ code: "SELF_ADMIN_PROTECTED" });

  await authenticate(context, "password-admin");
  const firstAdminId = MOBILE_UX_FIXTURE_IDS.users.admin;
  const secondAdminId = MOBILE_UX_FIXTURE_IDS.users.admin + 1;
  const memberId = MOBILE_UX_FIXTURE_IDS.users.member;
  try {
    const invalidId = await context.request.put("/api/admin/members/not-a-number", { data: { role: "MEMBER" }, failOnStatusCode: false });
    expect(invalidId.status()).toBe(400);
    const missingMember = await context.request.get("/api/admin/members/999999", { failOnStatusCode: false });
    expect(missingMember.status()).toBe(404);

    const updateMember = await context.request.put(`/api/admin/members/${memberId}`, { data: { role: "SHOP_OWNER" }, failOnStatusCode: false });
    expect(updateMember.status()).toBe(200);
    const restoreMember = await context.request.put(`/api/admin/members/${memberId}`, { data: { role: "MEMBER" }, failOnStatusCode: false });
    expect(restoreMember.status()).toBe(200);

    const makeSecondMember = await context.request.put(`/api/admin/members/${secondAdminId}`, { data: { role: "MEMBER" }, failOnStatusCode: false });
    expect(makeSecondMember.status()).toBe(200);
    const lastDemotion = await context.request.put(`/api/admin/members/${firstAdminId}`, { data: { role: "MEMBER" }, failOnStatusCode: false });
    expect(lastDemotion.status()).toBe(409);
    await expect(lastDemotion.json()).resolves.toEqual({ code: "LAST_ADMIN_PROTECTED" });
    const lastDelete = await context.request.delete(`/api/admin/members/${firstAdminId}`, { failOnStatusCode: false });
    expect(lastDelete.status()).toBe(409);
    await expect(lastDelete.json()).resolves.toEqual({ code: "LAST_ADMIN_PROTECTED" });
    const restoreSecondAdmin = await context.request.put(`/api/admin/members/${secondAdminId}`, { data: { role: "ADMIN" }, failOnStatusCode: false });
    expect(restoreSecondAdmin.status()).toBe(200);

    const attempts = await Promise.all([
      context.request.put(`/api/admin/members/${firstAdminId}`, { data: { role: "MEMBER" }, failOnStatusCode: false }),
      context.request.delete(`/api/admin/members/${secondAdminId}`, { failOnStatusCode: false }),
    ]);
    expect(attempts.map((response) => response.status()).sort()).toEqual([200, 409]);
    const conflict = attempts.find((response) => response.status() === 409);
    if (!conflict) throw new Error("one last-admin conflict is required");
    await expect(conflict.json()).resolves.toEqual({ code: "LAST_ADMIN_PROTECTED" });

    const remainingAdmins = await Promise.all([
      context.request.get(`/api/admin/members/${firstAdminId}`, { failOnStatusCode: false }),
      context.request.get(`/api/admin/members/${secondAdminId}`, { failOnStatusCode: false }),
    ]);
    const bodies: unknown[] = [];
    for (const response of remainingAdmins) {
      if (response.status() === 200) bodies.push(await response.json());
    }
    expect(bodies.filter(hasAdminRole)).toHaveLength(1);
  } finally {
    await context.request.put(`/api/admin/members/${memberId}`, { data: { role: "MEMBER" }, failOnStatusCode: false });
    await context.request.put(`/api/admin/members/${firstAdminId}`, { data: { role: "ADMIN" }, failOnStatusCode: false });
    await context.request.put(`/api/admin/members/${secondAdminId}`, { data: { role: "ADMIN" }, failOnStatusCode: false });
  }
});
