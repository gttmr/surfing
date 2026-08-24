import { randomUUID } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, type BrowserContext, type Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";
import { installBrowserEgressGuard } from "../../scripts/qa/browser-egress";
import { seedMobileUx } from "../../scripts/qa/seed-mobile-ux";
import { encodeSession } from "../../src/lib/session";
import { qaStorageState, type QaAuthContextKey } from "../fixtures/playwright-auth";

const client = new PrismaClient();
const evidenceDirectory = process.env.EVIDENCE_DIR;

export async function prepareOrderTest(context: BrowserContext) {
  if (!evidenceDirectory) throw new Error("EVIDENCE_DIR is required");
  await installBrowserEgressGuard(context, evidenceDirectory);
  await seedMobileUx(client, randomUUID(), evidenceDirectory);
}

export async function closeOrderTestClient() {
  await client.$disconnect();
}

export async function restoreOrderFixture() {
  if (!evidenceDirectory) throw new Error("EVIDENCE_DIR is required");
  await seedMobileUx(client, randomUUID(), evidenceDirectory);
}

export async function authenticate(context: BrowserContext, key: QaAuthContextKey) {
  await context.clearCookies();
  const storage = qaStorageState(key);
  if (storage && typeof storage !== "string") await context.addCookies(storage.cookies);
}

export async function authenticateBanned(context: BrowserContext) {
  await context.clearCookies();
  await context.addCookies([{
    name: "__session",
    value: encodeSession({ kakaoId: "qa-user-08", nickname: "합성 회원 08" }),
    domain: "127.0.0.1",
    path: "/",
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
    expires: -1,
  }]);
}

export async function openMemberOrders(page: Page) {
  const meetingsResponse = await page.request.get("/api/meetings");
  const meetings: unknown = await meetingsResponse.json();
  if (!Array.isArray(meetings)) throw new Error("meeting response missing");
  const dense = meetings.find((meeting) => (
    typeof meeting === "object" && meeting !== null && "id" in meeting && meeting.id === 8101
  ));
  if (!dense || typeof dense !== "object" || !("date" in dense) || typeof dense.date !== "string") {
    throw new Error("dense meeting missing");
  }
  await page.goto(`/?date=${dense.date}`, { waitUntil: "networkidle" });
  const trigger = page.getByRole("button", { name: "점심 메뉴 주문 및 내역 열기" });
  await expect(trigger).toBeVisible();
  await trigger.click();
  const sheet = page.getByRole("dialog", { name: "점심 메뉴 주문" });
  await expect(sheet).toBeVisible();
  return sheet;
}

export async function capture(page: Page, name: string, projectName: string) {
  if (!evidenceDirectory) throw new Error("EVIDENCE_DIR is required");
  await mkdir(evidenceDirectory, { recursive: true });
  await page.screenshot({ path: join(evidenceDirectory, `${projectName}-${name}.png`) });
}

export async function assertAccessible(page: Page) {
  const result = await new AxeBuilder({ page }).analyze();
  expect(result.violations.filter((violation) => violation.impact === "critical" || violation.impact === "serious")).toEqual([]);
}
