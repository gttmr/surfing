import { expect, test } from "@playwright/test";
import { installBrowserEgressGuard } from "../../scripts/qa/browser-egress";
import {
  assertAccessible,
  authenticateAdmin,
  capture,
  evidenceDirectory,
  registerAdminPricingVisualCases,
  verifyDelayedSaveLocksEditorAndShell,
} from "./admin-pricing-settings.helpers";

test.beforeEach(async ({ context }) => {
  if (!evidenceDirectory) throw new Error("EVIDENCE_DIR is required");
  await installBrowserEgressGuard(context, evidenceDirectory);
  await authenticateAdmin(context);
});

test("pricing edit mode validates drafts and discard restores the persisted snapshot", async ({ page }, testInfo) => {
  let putCount = 0;
  page.on("request", (request) => {
    if (request.method() === "PUT" && new URL(request.url()).pathname === "/api/admin/settings") putCount += 1;
  });

  await page.goto("/admin/pricing", { waitUntil: "networkidle" });
  await expect(page.getByText("모든 변경사항 저장됨")).toBeVisible();
  await expect(page.getByText(/저장된 값 · 정회원 참가/)).toBeVisible();
  await page.getByRole("button", { name: "참가비와 옵션 비용 편집" }).click();
  const baseFeeGroup = page.getByRole("group", { name: "기본 참가비" });
  const regularBaseFee = baseFeeGroup.getByLabel(/정회원/);

  await regularBaseFee.fill("");
  await page.getByRole("button", { name: "변경사항 저장" }).click();
  await expect(page.getByText("금액을 입력해 주세요.")).toBeVisible();
  expect(putCount).toBe(0);

  await regularBaseFee.fill("-1");
  await page.getByRole("button", { name: "변경사항 저장" }).click();
  await expect(page.getByText("0원 이상으로 입력해 주세요.")).toBeVisible();
  expect(putCount).toBe(0);

  await regularBaseFee.fill("1e3");
  await page.getByRole("button", { name: "변경사항 저장" }).click();
  await expect(page.getByText("숫자만 입력해 주세요.")).toBeVisible();
  expect(putCount).toBe(0);

  await regularBaseFee.fill("3002399751580331");
  await page.getByRole("button", { name: "변경사항 저장" }).click();
  await expect(page.getByText("금액이 너무 큽니다.")).toBeVisible();
  expect(putCount).toBe(0);

  await regularBaseFee.fill("12000");
  const feePreview = page.getByLabel("저장 비용 항목 초안 미리보기");
  await expect(feePreview).toContainText("기본 참가비");
  await expect(feePreview).toContainText("정회원 12,000원");
  await expect(feePreview).toContainText("확정된 강습·장비 대여 이용 여부에 따라 해당 비용 항목만 반영");
  await expect(feePreview).not.toContainText("강습+대여");
  await expect(page.getByText("1개 섹션 변경됨")).toBeVisible();
  await capture(page, "pricing-dirty-preview", testInfo.project.name);
  await feePreview.scrollIntoViewIfNeeded();
  await capture(page, "pricing-component-preview", testInfo.project.name);
  await page.getByRole("button", { name: "변경 취소" }).click();
  await expect(page.getByText("모든 변경사항 저장됨")).toBeVisible();
  await expect(page.getByRole("button", { name: "변경사항 저장" })).toHaveCount(0);
  await assertAccessible(page);
});

test("dirty administrator navigation offers stay or discard and restores focus when staying", async ({ page }, testInfo) => {
  await page.goto("/admin/pricing", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "참가비와 옵션 비용 편집" }).click();
  const regularBaseFee = page.getByRole("group", { name: "기본 참가비" }).getByLabel(/정회원/);
  const original = await regularBaseFee.inputValue();
  await regularBaseFee.fill(String(Number(original) + 1));

  const portalLink = page.getByRole("link", { name: "회원 화면", exact: true });
  await portalLink.click();
  await expect(page.getByRole("dialog", { name: "변경 내용을 버릴까요?" })).toBeVisible();
  await capture(page, "dirty-navigation-dialog", testInfo.project.name);
  await page.getByRole("button", { name: "계속 편집" }).click();
  await expect(portalLink).toBeFocused();

  const logoutButton = page.getByRole("button", { name: "로그아웃" });
  await logoutButton.click();
  await page.getByRole("button", { name: "계속 편집" }).click();
  await expect(logoutButton).toBeFocused();

  const browserExitPrevented = await page.evaluate(() => {
    const event = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  });
  expect(browserExitPrevented).toBe(true);

  const settingsDockLink = page.getByRole("link", { name: "설정", exact: true });
  await settingsDockLink.click();
  await page.getByRole("button", { name: "버리고 이동" }).click();
  await expect(page).toHaveURL(/\/admin\/settings$/);
  await page.goto("/admin/pricing", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "참가비와 옵션 비용 편집" }).click();
  await expect(page.getByRole("group", { name: "기본 참가비" }).getByLabel(/정회원/)).toHaveValue(original);
});

for (const delayedSave of [
  { path: "/admin/pricing", edit: "식음료 지원 한도 편집", field: "1인당 지원 한도", dockDestination: "설정" },
  { path: "/admin/settings", edit: "참가 옵션 안내 편집", field: "참가 옵션 가격 안내 문구", dockDestination: "비용" },
] as const) {
  test(`${delayedSave.path} locks editor and shell leave actions during a delayed save`, async ({ page }) => {
    await verifyDelayedSaveLocksEditorAndShell(page, delayedSave);
  });
}

test("pricing save sends one update and the support cap survives reload", async ({ page }) => {
  await page.goto("/admin/pricing", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "식음료 지원 한도 편집" }).click();
  const supportCap = page.getByLabel("1인당 지원 한도");
  const original = await supportCap.inputValue();
  const savedValue = String(Number(original) + 100);
  let putCount = 0;
  page.on("request", (request) => {
    if (request.method() === "PUT" && new URL(request.url()).pathname === "/api/admin/settings") putCount += 1;
  });

  try {
    await supportCap.fill(savedValue);
    await page.getByRole("button", { name: "변경사항 저장" }).click();
    await expect(page.getByText("모든 변경사항 저장됨")).toBeVisible();
    expect(putCount).toBe(1);
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByText(`저장된 값 · 1인당 최대 ${Number(savedValue).toLocaleString("ko-KR")}원`)).toBeVisible();
  } finally {
    await page.getByRole("button", { name: "식음료 지원 한도 편집" }).click();
    await page.getByLabel("1인당 지원 한도").fill(original);
    await page.getByRole("button", { name: "변경사항 저장" }).click();
    await expect(page.getByText("모든 변경사항 저장됨")).toBeVisible();
  }
});

test("settings sections expose role summaries, supported previews, and partial-account validation", async ({ page }, testInfo) => {
  let putCount = 0;
  page.on("request", (request) => {
    if (request.method() === "PUT" && new URL(request.url()).pathname === "/api/admin/settings") putCount += 1;
  });

  await page.goto("/admin/settings", { waitUntil: "networkidle" });
  await expect(page.getByText("취소하는 회원에게 표시")).toBeVisible();
  await expect(page.getByText("신청하는 회원에게 표시")).toBeVisible();
  await expect(page.getByText("정산받는 회원에게 표시")).toBeVisible();

  await page.getByRole("button", { name: "취소 안내 편집" }).click();
  await page.getByLabel("패널티 기준 일수").fill("31");
  await page.getByRole("button", { name: "변경사항 저장" }).click();
  await expect(page.getByText("0일부터 30일 사이로 입력해 주세요.")).toBeVisible();
  expect(putCount).toBe(0);

  await page.getByLabel("패널티 기준 일수").fill("3");
  await page.getByLabel("취소 안내 문구").fill("저장 전 초안 취소 안내입니다.");
  await expect(page.getByLabel("취소 안내 초안 미리보기")).toContainText("저장 전 초안");
  await page.getByRole("button", { name: "정산 계좌 편집" }).click();
  await page.getByLabel("은행명").fill("");
  await page.getByRole("button", { name: "변경사항 저장" }).click();
  await expect(page.getByText("은행명을 입력해 주세요.")).toBeVisible();
  expect(putCount).toBe(0);
  await expect(page.getByText("2개 섹션 변경됨")).toBeVisible();
  await capture(page, "settings-validation", testInfo.project.name);
  await page.getByRole("button", { name: "변경 취소" }).click();
  await expect(page.getByText("모든 변경사항 저장됨")).toBeVisible();
  await assertAccessible(page);
});

for (const failure of [{ status: 400, message: "입력 내용을 확인한 뒤 다시 저장해 주세요." }, { status: 403, message: "이 설정을 저장할 권한이 없습니다." }, { status: 404, message: "서버 문제로 저장하지 못했습니다." }, { status: 500, message: "서버 문제로 저장하지 못했습니다." }] as const) {
  test(`settings ${failure.status} failure retains the draft and persisted summary`, async ({ page }) => {
    await page.goto("/admin/settings", { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "참가 옵션 안내 편집" }).click();
    const guide = page.getByLabel("참가 옵션 가격 안내 문구");
    const original = await guide.inputValue();
    const draft = `${original}\n${failure.status} 실패 뒤 유지할 초안`;
    await guide.fill(draft);
    await page.route("**/api/admin/settings", async (route) => {
      if (route.request().method() === "PUT") {
        await route.fulfill({ status: failure.status, contentType: "application/json", body: JSON.stringify({ error: "synthetic failure" }) });
        return;
      }
      await route.continue();
    });

    await page.getByRole("button", { name: "변경사항 저장" }).click();
    const alert = page.getByRole("alert").filter({ hasText: "저장되지 않았습니다" });
    await expect(alert).toContainText(failure.message);
    await expect(alert).toContainText("서버에 저장된 값은 그대로");
    await expect(guide).toHaveValue(draft);
    await expect(page.getByText(`저장된 값 · ${original}`)).toBeVisible();
    await expect(page.getByText("1개 섹션 변경됨")).toBeVisible();
  });
}

test("settlement account whitespace is normalized before payload and remains normalized after reload", async ({ page }) => {
  await page.goto("/admin/settings", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "정산 계좌 편집" }).click();
  const bank = page.getByLabel("은행명");
  const number = page.getByLabel("계좌번호");
  const holder = page.getByLabel("예금주");
  const original = await Promise.all([bank.inputValue(), number.inputValue(), holder.inputValue()]);

  try {
    await bank.fill("  합성은행  ");
    await number.fill("   ");
    await holder.fill("  합성클럽  ");
    await page.getByRole("button", { name: "변경사항 저장" }).click();
    await expect(page.getByText("계좌번호를 입력해 주세요.")).toBeVisible();

    await bank.fill("   ");
    await number.fill("\t");
    await holder.fill("  ");
    const requestPromise = page.waitForRequest((request) => request.method() === "PUT" && new URL(request.url()).pathname === "/api/admin/settings");
    await page.getByRole("button", { name: "변경사항 저장" }).click();
    const request = await requestPromise;
    expect(request.postData()).toContain('"settlement_bank_name":""');
    expect(request.postData()).toContain('"settlement_account_number":""');
    expect(request.postData()).toContain('"settlement_account_holder":""');
    await expect(page.getByText("모든 변경사항 저장됨")).toBeVisible();

    await page.reload({ waitUntil: "networkidle" });
    await page.getByRole("button", { name: "정산 계좌 편집" }).click();
    await expect(page.getByLabel("은행명")).toHaveValue("");
    await expect(page.getByLabel("계좌번호")).toHaveValue("");
    await expect(page.getByLabel("예금주")).toHaveValue("");
  } finally {
    if (original.some(Boolean)) {
      await bank.fill(original[0] ?? "");
      await number.fill(original[1] ?? "");
      await holder.fill(original[2] ?? "");
      await page.getByRole("button", { name: "변경사항 저장" }).click();
      await expect(page.getByText("모든 변경사항 저장됨")).toBeVisible();
    }
  }
});

test("a settings save sends one update and becomes the persisted snapshot after reload", async ({ page }) => {
  await page.goto("/admin/settings", { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "참가 옵션 안내 편집" }).click();
  const guide = page.getByLabel("참가 옵션 가격 안내 문구");
  const original = await guide.inputValue();
  const savedValue = `${original}\n저장 후 재조회할 합성 안내`;
  let putCount = 0;
  page.on("request", (request) => {
    if (request.method() === "PUT" && new URL(request.url()).pathname === "/api/admin/settings") putCount += 1;
  });

  try {
    await guide.fill(savedValue);
    await page.getByRole("button", { name: "변경사항 저장" }).click();
    await expect(page.getByText("모든 변경사항 저장됨")).toBeVisible();
    expect(putCount).toBe(1);
    await page.reload({ waitUntil: "networkidle" });
    await expect(page.getByText(`저장된 값 · ${savedValue}`)).toBeVisible();
  } finally {
    await page.getByRole("button", { name: "참가 옵션 안내 편집" }).click();
    await page.getByLabel("참가 옵션 가격 안내 문구").fill(original);
    await page.getByRole("button", { name: "변경사항 저장" }).click();
    await expect(page.getByText("모든 변경사항 저장됨")).toBeVisible();
  }
});

registerAdminPricingVisualCases();
