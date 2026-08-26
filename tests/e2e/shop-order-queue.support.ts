import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { installBrowserEgressGuard } from "../../scripts/qa/browser-egress";
import { seedMobileUx } from "../../scripts/qa/seed-mobile-ux";
import { createQaBrowserContext, qaStorageState } from "../fixtures/playwright-auth";

const client = new PrismaClient();
const evidenceDirectory = process.env.EVIDENCE_DIR;

export async function prepareShopOrderTest(context: BrowserContext) {
  if (!evidenceDirectory) throw new Error("EVIDENCE_DIR is required");
  await installBrowserEgressGuard(context, evidenceDirectory);
  await seedMobileUx(client, randomUUID(), evidenceDirectory);
  await context.clearCookies();
  const storage = qaStorageState("shop");
  if (storage && typeof storage !== "string") await context.addCookies(storage.cookies);
}

export async function closeShopOrderTestClient() {
  await client.$disconnect();
}

export async function openShopOrders(page: Page) {
  await page.goto("/shop/orders?meetingId=8101", { waitUntil: "networkidle" });
  await expect(page.getByRole("heading", { name: "실시간 주문 큐" })).toBeVisible();
}

export async function insertVisibleShopOrder() {
  const menu = await client.foodMenuItem.findUniqueOrThrow({
    where: { id: 8417 },
    select: { id: true, name: true, price: true },
  });
  await client.participantFoodOrder.create({
    data: {
      id: 8990,
      meetingId: 8101,
      participantId: 8801,
      createdAt: new Date("2026-01-01T06:00:00.000Z"),
      items: {
        create: {
          id: 9090,
          meetingId: 8101,
          participantId: 8801,
          menuItemId: menu.id,
          menuNameSnapshot: menu.name,
          unitPriceSnapshot: menu.price,
          quantity: 1,
          createdAt: new Date("2026-01-01T06:00:00.000Z"),
        },
      },
    },
  });
  return menu.name;
}

export async function createSecondShopContext(browser: Browser) {
  if (!evidenceDirectory) throw new Error("EVIDENCE_DIR is required");
  return createQaBrowserContext(browser, "shop", evidenceDirectory);
}

export async function setSyntheticVisibility(page: Page, visibility: "hidden" | "visible") {
  await page.evaluate(
    `Object.defineProperty(document, "visibilityState", { configurable: true, value: "${visibility}" }); document.dispatchEvent(new Event("visibilitychange"));`,
  );
}

export async function captureShopOrder(page: Page, name: string, projectName: string) {
  if (!evidenceDirectory) throw new Error("EVIDENCE_DIR is required");
  await mkdir(evidenceDirectory, { recursive: true });
  await page.screenshot({ path: join(evidenceDirectory, `${projectName}-${name}.png`), fullPage: true });
}

export async function assertShopOrderAccessible(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious")).toEqual([]);
}

export async function assertShopOrderGeometry(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const undersized = await page.locator("main button:visible, main input:visible, main select:visible, main summary:visible").evaluateAll((elements) => (
    elements.flatMap((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width + 0.5 < 44 || rect.height + 0.5 < 44
        ? [{ label: element.getAttribute("aria-label") ?? element.textContent?.trim() ?? element.tagName, width: rect.width, height: rect.height }]
        : [];
    })
  ));
  expect(undersized).toEqual([]);
}
