import { expect, test } from "@playwright/test";
import { join } from "node:path";
import { installBrowserEgressGuard, recordBrowserOAuthLocation } from "../../scripts/qa/browser-egress";
import { writeJsonEvidence } from "../../scripts/qa/evidence";

type Rgba = readonly [number, number, number, number];

function composite(foreground: Rgba, background: Rgba): Rgba {
  return [
    foreground[0] * foreground[3] + background[0] * (1 - foreground[3]),
    foreground[1] * foreground[3] + background[1] * (1 - foreground[3]),
    foreground[2] * foreground[3] + background[2] * (1 - foreground[3]),
    1,
  ];
}

function luminance(color: Rgba): number {
  const channels = color.slice(0, 3).map((value) => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0);
}

function contrastRatio(foreground: Rgba, background: Rgba): number {
  const flattenedForeground = composite(foreground, background);
  const [lighter, darker] = [luminance(flattenedForeground), luminance(background)]
    .sort((left, right) => right - left);
  return ((lighter ?? 0) + 0.05) / ((darker ?? 0) + 0.05);
}

function requireColor(colors: ReadonlyMap<string, readonly number[]>, token: string): Rgba {
  const color = colors.get(token);
  if (!color || color.length < 3) {
    throw new Error(`Unable to resolve color token ${token}`);
  }
  return [color[0] ?? 0, color[1] ?? 0, color[2] ?? 0, color[3] ?? 1];
}

test.beforeEach(async ({ context }) => {
  const evidenceDirectory = process.env.EVIDENCE_DIR;
  if (!evidenceDirectory) {
    throw new Error("EVIDENCE_DIR is required for mobile foundation evidence");
  }
  await installBrowserEgressGuard(context, evidenceDirectory);
});

test("uses the full mobile shell with local fonts and accessible global interaction defaults", async ({ page }, testInfo) => {
  const externalRequests: string[] = [];
  const consoleErrors: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (!(["127.0.0.1", "localhost", "::1", "[::1]"].includes(url.hostname))) {
      externalRequests.push(request.url());
    }
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      consoleErrors.push(message.text());
    }
  });

  await page.goto("/", { waitUntil: "networkidle" });

  const geometry = await page.evaluate(() => {
    const shell = document.querySelector<HTMLElement>(".brand-mobile-shell");
    const main = document.querySelector<HTMLElement>("main");
    document.documentElement.style.setProperty("--brand-safe-bottom", "20px");
    const foundationScrim = document.createElement("div");
    foundationScrim.className = "fixed inset-0";
    foundationScrim.dataset.foundationScrim = "true";
    shell?.append(foundationScrim);
    const foundationToast = document.createElement("div");
    foundationToast.className = "brand-toast-info fixed bottom-6 right-6 px-4 py-3";
    foundationToast.textContent = "저장 상태 안내";
    shell?.append(foundationToast);
    const spacer = document.createElement("div");
    spacer.style.height = `${window.innerHeight}px`;
    shell?.append(spacer);
    const finalControl = document.createElement("button");
    finalControl.type = "button";
    finalControl.textContent = "마지막 확인";
    finalControl.style.width = "100%";
    shell?.append(finalControl);
    finalControl.scrollIntoView({ block: "end" });
    const fixed = [...document.querySelectorAll<HTMLElement>(".fixed")].map((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right };
    });
    const shellRect = shell?.getBoundingClientRect();
    const mainRect = main?.getBoundingClientRect();
    const toastRect = foundationToast.getBoundingClientRect();
    const finalControlRect = finalControl.getBoundingClientRect();
    const result = {
      shellWidth: shellRect?.width ?? 0,
      mainWidth: mainRect?.width ?? 0,
      fixedCount: fixed.length,
      fixedInsideShell: fixed.every((rect) => (
        shellRect !== undefined && rect.left >= shellRect.left && rect.right <= shellRect.right
      )),
      toastSafeBottom: window.innerHeight - toastRect.bottom,
      scrollPaddingBottom: Number.parseFloat(getComputedStyle(document.documentElement).scrollPaddingBottom),
      finalControlReachable: finalControlRect.bottom <= toastRect.top,
    };
    foundationScrim.remove();
    foundationToast.remove();
    spacer.remove();
    finalControl.remove();
    document.documentElement.style.removeProperty("--brand-safe-bottom");
    window.scrollTo(0, 0);
    return result;
  });
  expect.soft(geometry.shellWidth).toBe(testInfo.project.name === "mobile-390" ? 390 : 430);
  expect.soft(geometry.mainWidth).toBe(testInfo.project.name === "mobile-390" ? 390 : 430);
  expect.soft(geometry.fixedCount).toBeGreaterThan(0);
  expect.soft(geometry.fixedInsideShell).toBe(true);
  expect.soft(geometry.toastSafeBottom).toBeGreaterThanOrEqual(44);
  expect.soft(geometry.scrollPaddingBottom).toBeGreaterThanOrEqual(116);
  expect.soft(geometry.finalControlReachable).toBe(true);

  const firstControl = page.locator("a, button, input, select, textarea").first();
  await firstControl.focus();
  const focusAndTarget = await firstControl.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    return {
      minWidth: rect.width,
      minHeight: rect.height,
      focusVisible: style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) > 0,
    };
  });
  expect.soft(focusAndTarget.minWidth).toBeGreaterThanOrEqual(44);
  expect.soft(focusAndTarget.minHeight).toBeGreaterThanOrEqual(44);
  expect.soft(focusAndTarget.focusVisible).toBe(true);

  const undersizedFrequentControls = await page.locator(
    "button, [role=button], input:not([type=checkbox]):not([type=radio]), select, textarea, summary",
  ).evaluateAll((elements) => elements.flatMap((element) => {
    const rect = element.getBoundingClientRect();
    if (rect.width >= 44 && rect.height >= 44) {
      return [];
    }
    return [{ tag: element.tagName, width: rect.width, height: rect.height }];
  }));
  expect.soft(undersizedFrequentControls).toEqual([]);

  const resolvedColors = await page.evaluate(() => {
    const tokens = [
      "--brand-text-subtle",
      "--brand-page",
      "--brand-success-text",
      "--brand-success-surface",
      "--brand-on-status",
      "--brand-success",
      "--brand-danger-text",
      "--brand-danger-surface",
      "--brand-danger",
      "--brand-preparing-text",
      "--brand-preparing-surface",
    ];
    const colors: Array<{ token: string; color: number[] }> = [];
    for (const token of tokens) {
      const probe = document.createElement("span");
      probe.style.color = `var(${token})`;
      document.body.append(probe);
      const color = getComputedStyle(probe).color.match(/[\d.]+/g)?.map(Number) ?? [];
      probe.remove();
      colors.push({ token, color });
    }
    return colors;
  });
  const colors = new Map(resolvedColors.map(({ token, color }) => [token, color]));
  const contrastEvidence = {
    subtle: contrastRatio(requireColor(colors, "--brand-text-subtle"), requireColor(colors, "--brand-page")),
    successSurface: contrastRatio(
      requireColor(colors, "--brand-success-text"), requireColor(colors, "--brand-success-surface"),
    ),
    successToast: contrastRatio(requireColor(colors, "--brand-on-status"), requireColor(colors, "--brand-success")),
    dangerSurface: contrastRatio(
      requireColor(colors, "--brand-danger-text"), requireColor(colors, "--brand-danger-surface"),
    ),
    dangerToast: contrastRatio(requireColor(colors, "--brand-on-status"), requireColor(colors, "--brand-danger")),
    preparing: contrastRatio(
      requireColor(colors, "--brand-preparing-text"), requireColor(colors, "--brand-preparing-surface"),
    ),
  };
  for (const ratio of Object.values(contrastEvidence)) {
    expect.soft(ratio).toBeGreaterThanOrEqual(4.5);
  }

  const fontEvidence = await page.evaluate(async () => {
    await document.fonts.ready;
    const resources = performance.getEntriesByType("resource").map((entry) => entry.name);
    return {
      pretendardLoaded: document.fonts.check('400 16px "Pretendard"'),
      materialSymbolsLoaded: document.fonts.check('400 24px "Material Symbols Outlined"'),
      fontResources: resources.filter((url) => /\.(?:woff2?|ttf)(?:\?|$)/i.test(url)),
      reducedMotionTransition: getComputedStyle(document.querySelector("a, button, input") ?? document.body)
        .transitionDuration,
    };
  });
  expect.soft(fontEvidence.pretendardLoaded).toBe(true);
  expect.soft(fontEvidence.materialSymbolsLoaded).toBe(true);
  expect.soft(fontEvidence.fontResources.length).toBeGreaterThan(0);
  expect.soft(fontEvidence.fontResources.every((url) => new URL(url).origin === new URL(page.url()).origin)).toBe(true);
  expect.soft(fontEvidence.reducedMotionTransition).toBe("0s");
  expect.soft(externalRequests).toEqual([]);
  expect.soft(consoleErrors.filter((message) => /integrity|kakao|retry/i.test(message))).toEqual([]);

  writeJsonEvidence(join(process.env.EVIDENCE_DIR ?? "", `foundation-${testInfo.project.name}.json`), {
    viewport: testInfo.project.use.viewport,
    geometry,
    focusAndTarget,
    undersizedFrequentControls,
    contrastEvidence,
    fontEvidence,
    externalRequests,
    consoleErrors,
  });

  await page.screenshot({
    path: `${process.env.EVIDENCE_DIR}/foundation-${testInfo.project.name}.png`,
    fullPage: false,
    animations: "disabled",
    caret: "hide",
  });
});

test("keeps long Korean content bounded at 200 percent zoom", async ({ page }, testInfo) => {
  await page.goto("/", { waitUntil: "domcontentloaded" });
  await page.evaluate(() => {
    document.documentElement.style.zoom = "2";
    const target = document.querySelector<HTMLElement>("main") ?? document.body;
    const paragraph = document.createElement("p");
    paragraph.dataset.foundationLongKorean = "true";
    paragraph.textContent = "아주 긴 한글 문장에서도 모임 참가와 정산 상태를 차분히 확인하고 다음 행동을 놓치지 않아야 합니다".repeat(5);
    target.prepend(paragraph);
  });
  const zoomEvidence = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  }));
  expect(zoomEvidence.overflow).toBe(false);
  writeJsonEvidence(join(process.env.EVIDENCE_DIR ?? "", `zoom-${testInfo.project.name}.json`), zoomEvidence);
});

test("preserves the unfollowed REST Kakao authorization redirect", async ({ request }) => {
  const response = await request.get("/api/auth/kakao?returnTo=/", { maxRedirects: 0 });
  expect(response.status()).toBeGreaterThanOrEqual(300);
  expect(response.status()).toBeLessThan(400);
  expect(response.headers().location).toMatch(
    /^https:\/\/kauth\.kakao\.com\/oauth\/authorize\?client_id=[^&]+&redirect_uri=[^&]+&response_type=code&state=%2F/,
  );
  const evidenceDirectory = process.env.EVIDENCE_DIR;
  if (!evidenceDirectory) {
    throw new Error("EVIDENCE_DIR is required for OAuth evidence");
  }
  recordBrowserOAuthLocation(evidenceDirectory);
});
