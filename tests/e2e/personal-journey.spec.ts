import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { installBrowserEgressGuard } from "../../scripts/qa/browser-egress";
import { encodeSession, type SessionPayload } from "../../src/lib/session";
import { qaStorageState, type QaAuthContextKey } from "../fixtures/playwright-auth";

const evidenceDirectory = process.env.EVIDENCE_DIR;
const PNG_PIXEL = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAD0lEQVR4nGP4z8DAwMAAAAYIAQHL9mAAAAAASUVORK5CYII=", "base64");

async function authenticate(context: BrowserContext, key: QaAuthContextKey) {
  await context.clearCookies();
  const storage = qaStorageState(key);
  if (storage && typeof storage !== "string" && storage.cookies.length > 0) {
    await context.addCookies(storage.cookies);
  }
}

async function authenticatePayload(context: BrowserContext, payload: SessionPayload) {
  await context.clearCookies();
  await context.addCookies([{
    domain: "127.0.0.1",
    expires: -1,
    httpOnly: true,
    name: "__session",
    path: "/",
    sameSite: "Lax",
    secure: false,
    value: encodeSession(payload),
  }]);
}

async function capture(page: Page, name: string, projectName: string) {
  if (!evidenceDirectory) throw new Error("EVIDENCE_DIR is required");
  await mkdir(evidenceDirectory, { recursive: true });
  await page.screenshot({ animations: "disabled", caret: "hide", fullPage: true, path: join(evidenceDirectory, `${projectName}-${name}.png`) });
}

async function assertAccessible(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious")).toEqual([]);
}

async function assertNoHorizontalOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
}

async function assertReachableAboveDock(page: Page, target: Locator) {
  await target.scrollIntoViewIfNeeded();
  const [targetBox, dockBox] = await Promise.all([
    target.boundingBox(),
    page.locator(".brand-bottom-dock").boundingBox(),
  ]);
  expect(targetBox).not.toBeNull();
  expect(dockBox).not.toBeNull();
  expect((targetBox?.y ?? 0) + (targetBox?.height ?? 0)).toBeLessThanOrEqual(dockBox?.y ?? 0);
}

test.beforeEach(async ({ context }) => {
  if (!evidenceDirectory) throw new Error("EVIDENCE_DIR is required");
  await installBrowserEgressGuard(context, evidenceDirectory);
});

test("profile keeps failed drafts and saves only after an explicit action", async ({ context, page }, testInfo) => {
  await authenticate(context, "member");
  await page.goto("/profile", { waitUntil: "networkidle" });
  await expect(page.locator("h1")).toHaveText("합성 회원 01");
  await page.getByRole("button", { name: "편집", exact: true }).click();

  const nameInput = page.getByLabel("이름");
  await nameInput.fill("파도 타는 합성 회원");
  await page.getByLabel(/연락처/).fill("010-1234-5678");

  await page.route("**/api/profile", async (route) => {
    if (route.request().method() === "PUT") {
      await route.fulfill({ body: JSON.stringify({ error: "합성 저장 실패" }), contentType: "application/json", status: 500 });
      return;
    }
    await route.continue();
  });
  await page.getByRole("button", { name: "변경 내용 저장하기" }).click();
  await expect(page.locator(".brand-inline-danger")).toContainText("입력한 내용은 그대로 남아 있습니다");
  await expect(nameInput).toHaveValue("파도 타는 합성 회원");

  await page.unroute("**/api/profile");
  await page.route("**/api/profile", async (route) => {
    if (route.request().method() === "PUT") {
      await route.fulfill({
        body: JSON.stringify({
          _count: { participants: 2 }, createdAt: "2026-07-14T00:00:00.000Z", customProfileImageUrl: null,
          id: 8201, kakaoId: "qa-user-01", kakaoProfileImage: null, memberType: "REGULAR", name: "파도 타는 합성 회원",
          penaltyCount: 0, phoneNumber: "010-1234-5678", profileImage: null, role: "MEMBER",
        }),
        contentType: "application/json",
        status: 200,
      });
      return;
    }
    await route.continue();
  });
  await page.getByRole("button", { name: "변경 내용 저장하기" }).click();
  await expect(page.locator("h1")).toHaveText("파도 타는 합성 회원");
  await expect(page.getByText("변경 내용이 저장되었습니다.")).toBeVisible();
  await capture(page, "profile-read-after-save", testInfo.project.name);
  await assertAccessible(page);
});

test("profile edit can discard drafts and crop with keyboard recovery", async ({ context, page }, testInfo) => {
  await authenticate(context, "member");
  await page.goto("/profile", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "편집", exact: true }).click();
  await page.getByLabel("이름").fill("버릴 초안");
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await expect(page.locator("h1")).toHaveText("합성 회원 01");

  await page.getByRole("button", { name: "편집", exact: true }).click();
  const fileInput = page.getByLabel("프로필 사진 파일 선택");
  const fileTrigger = page.getByRole("button", { name: "프로필 사진 변경" });
  await fileTrigger.focus();
  await fileInput.setInputFiles({ buffer: Buffer.from("not an image"), mimeType: "text/plain", name: "profile.txt" });
  await expect(page.getByText("이미지 파일만 선택할 수 있습니다.")).toBeVisible();
  await fileInput.setInputFiles({ buffer: PNG_PIXEL, mimeType: "image/png", name: "profile.png" });
  const cropDialog = page.getByRole("dialog", { name: "프로필 사진 다듬기" });
  await expect(cropDialog).toBeVisible();
  await cropDialog.getByLabel("프로필 사진 확대").focus();
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("Escape");
  await expect(cropDialog).toBeHidden();
  await expect(fileTrigger).toBeFocused();

  await fileInput.setInputFiles({ buffer: PNG_PIXEL, mimeType: "image/png", name: "profile.png" });
  let avatarUploadCount = 0;
  await page.route("**/api/profile/avatar", async (route) => {
    if (route.request().method() === "POST") {
      avatarUploadCount += 1;
      await route.fulfill({
        body: JSON.stringify({ user: { customProfileImageUrl: "/logo.png", kakaoProfileImage: null, profileImage: "/logo.png" } }),
        contentType: "application/json",
        status: 200,
      });
      return;
    }
    await route.continue();
  });
  await page.getByRole("button", { name: "썸네일 적용" }).click();
  await expect(cropDialog).toBeHidden();
  expect(avatarUploadCount).toBe(0);
  await expect(page.getByText("저장하기 전 미리보기")).toBeVisible();
  await page.getByRole("button", { name: "취소", exact: true }).click();
  expect(avatarUploadCount).toBe(0);
  await expect(page.getByRole("img", { name: "프로필 사진" })).toHaveCount(0);

  await page.getByRole("button", { name: "편집", exact: true }).click();
  await fileInput.setInputFiles({ buffer: PNG_PIXEL, mimeType: "image/png", name: "profile.png" });
  await page.getByRole("button", { name: "썸네일 적용" }).click();
  await page.getByRole("button", { name: "변경 내용 저장하기" }).click();
  await expect.poll(() => avatarUploadCount).toBe(1);
  await expect(page.getByRole("img", { name: "프로필 사진" })).toHaveAttribute("src", "/logo.png");
  await capture(page, "profile-image-edit", testInfo.project.name);

  await page.unroute("**/api/profile/avatar");
  await page.getByRole("button", { name: "편집", exact: true }).click();
  await fileInput.setInputFiles({ buffer: PNG_PIXEL, mimeType: "image/png", name: "profile.png" });
  await page.getByRole("button", { name: "썸네일 적용" }).click();
  await page.getByRole("button", { name: "변경 내용 저장하기" }).click();
  await expect(page.locator(".brand-inline-danger")).toContainText("사진 미리보기는 남아 있으니 다시 저장해 주세요");
  await expect(page.getByText("저장하기 전 미리보기")).toBeVisible();
  await assertNoHorizontalOverflow(page);
  await assertAccessible(page);
  await assertReachableAboveDock(page, page.locator("#profile-form .brand-input-dimmed"));
  if (!evidenceDirectory) throw new Error("EVIDENCE_DIR is required");
  await page.screenshot({
    animations: "disabled",
    caret: "hide",
    path: join(evidenceDirectory, `${testInfo.project.name}-profile-avatar-failure.png`),
  });
  await page.getByRole("button", { name: "취소", exact: true }).click();
  await expect(page.getByRole("img", { name: "프로필 사진" })).toHaveAttribute("src", "/logo.png");

  const invalid = await page.request.post("/api/profile/avatar", {
    multipart: { file: { buffer: Buffer.from("plain"), mimeType: "text/plain", name: "invalid.txt" } },
  });
  expect(invalid.status()).toBe(400);
  const unavailable = await page.request.post("/api/profile/avatar", {
    multipart: { file: { buffer: PNG_PIXEL, mimeType: "image/png", name: "valid.png" } },
  });
  expect(unavailable.status()).toBe(503);
});

test("dirty profile navigation offers accessible stay and discard choices", async ({ context, page }) => {
  await authenticate(context, "member");
  await page.goto("/profile", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "편집", exact: true }).click();
  await page.getByLabel("이름").fill("이동 전 초안");
  const browserExitGuarded = await page.evaluate(() => {
    const event = new Event("beforeunload", { cancelable: true });
    return !window.dispatchEvent(event);
  });
  expect(browserExitGuarded).toBe(true);

  const settlementLink = page.getByRole("link", { name: /내 정산/ });
  await settlementLink.click();
  const leaveDialog = page.getByRole("dialog", { name: "변경 내용을 버릴까요?" });
  await expect(leaveDialog).toBeVisible();
  await expect(leaveDialog.getByRole("button", { name: "닫기" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(leaveDialog.getByRole("button", { name: "버리고 이동" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(leaveDialog.getByRole("button", { name: "닫기" })).toBeFocused();
  await assertAccessible(page);
  await leaveDialog.getByRole("button", { name: "계속 편집" }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await expect(settlementLink).toBeFocused();
  await expect(page.getByLabel("이름")).toHaveValue("이동 전 초안");

  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(leaveDialog).toBeVisible();
  await leaveDialog.getByRole("button", { name: "계속 편집" }).click();
  await expect(page.getByLabel("이름")).toHaveValue("이동 전 초안");

  const companionsTab = page.getByRole("tab", { name: /동반인 관리/ });
  await companionsTab.click();
  await expect(leaveDialog).toBeVisible();
  await leaveDialog.getByRole("button", { name: "버리고 이동" }).click();
  await expect(companionsTab).toHaveAttribute("aria-selected", "true");
  await expect(companionsTab).toBeFocused();
  await page.getByRole("tab", { name: /기본 정보/ }).click();
  await settlementLink.click();
  await expect(page).toHaveURL(/\/settlement$/);
});

test("companion panel distinguishes linked, waiting, empty, and dense states", async ({ context, page }, testInfo) => {
  await authenticatePayload(context, { kakaoId: "qa-user-03", nickname: "합성 회원 03" });
  const createdIds: number[] = [];
  try {
    for (const suffix of ["A", "B", "C"]) {
      const response = await page.request.post("/api/companions", { data: { name: `밀집 합성 동반인 ${suffix}` } });
      expect(response.ok()).toBe(true);
      const data: unknown = await response.json();
      if (typeof data === "object" && data !== null && "id" in data && typeof data.id === "number") createdIds.push(data.id);
    }
    await page.goto("/profile", { waitUntil: "networkidle" });
    await page.getByRole("tab", { name: /동반인 관리/ }).click();
    await expect(page.getByLabel("동반인 이름")).toBeVisible();
    await expect(page.getByText("본인 계정과 연결됨")).toBeVisible();
    await expect(page.getByText("상대방 연결 대기").first()).toBeVisible();
    await expect(page.locator(".brand-list-scroll")).toBeVisible();
    await capture(page, "companions-dense", testInfo.project.name);
    await assertNoHorizontalOverflow(page);
    await assertAccessible(page);
  } finally {
    for (const id of createdIds) {
      await page.request.delete("/api/companions", { data: { id } });
    }
  }

  await authenticatePayload(context, { kakaoId: "qa-user-35", nickname: "합성 회원 35" });
  await page.goto("/profile", { waitUntil: "networkidle" });
  await page.getByRole("tab", { name: /동반인 관리/ }).click();
  await expect(page.getByText("등록된 동반인이 없습니다")).toBeVisible();
});

test("settlement groups multiple meetings and provides an empty return path", async ({ context, page }, testInfo) => {
  await authenticate(context, "member");
  await page.goto("/settlement", { waitUntil: "networkidle" });
  await expect(page.getByText("2건")).toBeVisible();
  await expect(page.getByText("보낼 금액")).toHaveCount(2);
  await expect(page.getByText("합성 서핑 해변 A")).toBeVisible();
  await expect(page.getByText("합성 서핑 해변 C")).toBeVisible();
  await expect(page.getByText("식음료", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("식음료 지원", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("정산 필요", { exact: true })).toBeVisible();
  await expect(page.getByText("송금 완료", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "송금 완료로 표시" })).toBeVisible();
  const openMeeting = page.locator("section").filter({ hasText: "합성 서핑 해변 A" });
  const lineAmounts = await openMeeting.locator("dd").allTextContents();
  expect(lineAmounts.map((value) => Number(value.replace(/[^\d-]/g, ""))).reduce((sum, value) => sum + value, 0)).toBe(27_750);
  await openMeeting.getByRole("button", { name: "송금 완료로 표시" }).click();
  await expect(openMeeting.getByText("송금 완료", { exact: true })).toBeVisible();
  await openMeeting.getByRole("button", { name: "완료 표시 취소" }).click();
  await expect(openMeeting.getByText("정산 필요", { exact: true })).toBeVisible();
  await capture(page, "settlement-multiple", testInfo.project.name);
  await assertNoHorizontalOverflow(page);
  await assertAccessible(page);

  await authenticatePayload(context, { kakaoId: "qa-user-35", nickname: "합성 회원 35" });
  await page.goto("/settlement", { waitUntil: "networkidle" });
  await expect(page.getByText("정산할 항목이 아직 없습니다.")).toBeVisible();
  await expect(page.getByRole("link", { name: "프로필로 돌아가기", exact: true }).last()).toHaveAttribute("href", "/profile");
});

test("legacy routes return not-found and role-aware portal links remain navigation-only", async ({ context, page }, testInfo) => {
  for (const url of ["/meeting/8101", "/signup/confirm?status=APPROVED"]) {
    const response = await page.goto(url, { waitUntil: "networkidle" });
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("heading", { name: "페이지를 찾을 수 없어요" })).toBeVisible();
  }

  await authenticate(context, "shop");
  await page.goto("/profile", { waitUntil: "networkidle" });
  const cookiesBefore = await context.cookies();
  await expect(page.getByRole("link", { name: /샵 포털/ })).toHaveAttribute("href", "/shop");
  await page.getByRole("link", { name: /샵 포털/ }).click();
  await expect(page).toHaveURL(/\/shop/);
  expect((await context.cookies()).map((cookie) => cookie.value)).toEqual(cookiesBefore.map((cookie) => cookie.value));

  await authenticate(context, "kakao-admin");
  await page.goto("/profile", { waitUntil: "networkidle" });
  await expect(page.getByRole("link", { name: /관리자/ })).toHaveAttribute("href", "/admin/login");
  await expect(page.getByRole("link", { name: /내 정산/ })).toHaveAttribute("href", "/settlement");
  await capture(page, "profile-role-navigation", testInfo.project.name);
});
