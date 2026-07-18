import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, type BrowserContext, type Locator, type Page } from "@playwright/test";
import { installBrowserEgressGuard } from "../../scripts/qa/browser-egress";
import { qaStorageState } from "../fixtures/playwright-auth";

const evidenceDirectory = process.env.EVIDENCE_DIR;

export async function prepareAdminContext(context: BrowserContext): Promise<void> {
  if (!evidenceDirectory) throw new Error("EVIDENCE_DIR is required");
  await installBrowserEgressGuard(context, evidenceDirectory);
  await context.clearCookies();
  const storage = qaStorageState("password-admin");
  if (storage && typeof storage !== "string" && storage.cookies.length > 0) {
    await context.addCookies(storage.cookies);
  }
}

export async function capture(page: Page, name: string, projectName: string): Promise<void> {
  if (!evidenceDirectory) throw new Error("EVIDENCE_DIR is required");
  await mkdir(evidenceDirectory, { recursive: true });
  await page.screenshot({ path: join(evidenceDirectory, `${projectName}-admin-meetings-${name}.png`) });
}

export async function assertAccessible(page: Page): Promise<void> {
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations.filter((item) => item.impact === "critical" || item.impact === "serious")).toEqual([]);
}

export async function assertMobileGeometry(page: Page): Promise<void> {
  const geometry = await page.evaluate(() => {
    const dock = document.querySelector<HTMLElement>('nav[aria-label="관리자 메뉴"]');
    const main = document.querySelector<HTMLElement>("main");
    const dockRect = dock?.getBoundingClientRect();
    return {
      horizontalOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      dockBottomGap: dockRect ? window.innerHeight - dockRect.bottom : Number.POSITIVE_INFINITY,
      dockHeight: dockRect?.height ?? Number.POSITIVE_INFINITY,
      mainBottomPadding: main ? Number.parseFloat(window.getComputedStyle(main).paddingBottom) : 0,
    };
  });
  expect(geometry.horizontalOverflow).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.dockBottomGap)).toBeLessThanOrEqual(1);
  expect(geometry.mainBottomPadding).toBeGreaterThanOrEqual(geometry.dockHeight);
}

export async function assertControlClearsDock(page: Page, control: Locator): Promise<void> {
  await control.scrollIntoViewIfNeeded();
  const controlBox = await control.boundingBox();
  const dockBox = await page.getByRole("navigation", { name: "관리자 메뉴" }).boundingBox();
  expect(controlBox?.y !== undefined && controlBox.height !== undefined ? controlBox.y + controlBox.height : Number.POSITIVE_INFINITY)
    .toBeLessThanOrEqual(dockBox?.y ?? Number.NEGATIVE_INFINITY);
}

export async function assertDialogChunkFitsParagraph(chunk: Locator): Promise<void> {
  const geometry = await chunk.evaluate((element) => {
    const chunkRects = Array.from(element.getClientRects()).filter((rect) => rect.width > 0 && rect.height > 0);
    const paragraphRect = element.closest("p")?.getBoundingClientRect();
    const chunkRect = chunkRects[0];
    return {
      lineCount: chunkRects.length,
      insideParagraph: Boolean(chunkRect && paragraphRect
        && chunkRect.left >= paragraphRect.left - 1
        && chunkRect.right <= paragraphRect.right + 1
        && chunkRect.top >= paragraphRect.top - 1
        && chunkRect.bottom <= paragraphRect.bottom + 1),
    };
  });
  expect(geometry.lineCount).toBe(1);
  expect(geometry.insideParagraph).toBe(true);
}
