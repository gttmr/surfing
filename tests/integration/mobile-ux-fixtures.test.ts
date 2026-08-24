import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { PrismaClient } from "@prisma/client";
import { chromium } from "@playwright/test";
import { db } from "../../scripts/qa/local-db";
import { inspectMobileUxSeed, seedMobileUx } from "../../scripts/qa/seed-mobile-ux";
import { decodeSession, encodeSession } from "../../src/lib/session";
import { buildMobileUxFixture, MOBILE_UX_FIXTURE_IDS, MOBILE_UX_PERSONAS, parseMobileUxFixtureKey } from "../fixtures/mobile-ux";
import { createQaBrowserContext, QA_AUTH_CONTEXT_KEYS, qaSessionPayload } from "../fixtures/playwright-auth";
import { ROUTE_CASE_MATRIX } from "../fixtures/route-case-matrix";

test("fixture contract has stable dense mobile UX data", () => {
  // Given a fixed Seoul calendar date
  const first = buildMobileUxFixture("2026-07-14");
  const second = buildMobileUxFixture("2026-07-14");

  // When the fixture is generated twice, then its stable contract is identical
  assert.deepEqual(first, second);
  assert.deepEqual(first.meetings.map((meeting) => meeting.id), MOBILE_UX_FIXTURE_IDS.meetings);
  assert.equal(first.users.length, 35);
  assert.equal(first.menus.length, 37);
  assert.equal(first.menus.filter((menu) => menu.isActive).length, 36);
  assert.equal(first.variants.length, 60);
  assert.deepEqual(new Set(first.orderStates), new Set(["ACTIVE", "PREPARING", "SERVED", "CANCELLED", "MIXED"]));
  assert.deepEqual(new Set(first.usageStates), new Set(["MISSING", "SUBMITTED", "CONFIRMED"]));
  assert.equal(MOBILE_UX_PERSONAS.length, 9);
  assert.match(first.checksum, /^[a-f0-9]{64}$/);
  assert.throws(() => buildMobileUxFixture("2026-99-99"), /not a calendar date/);
  assert.throws(() => parseMobileUxFixtureKey("unknown"), /unknown mobile UX fixture key/);
});

test("atomic route matrix is flat and targets representative access", () => {
  // Given the focused registry, when each case is inspected, then every record is atomic and unique
  const ids = ROUTE_CASE_MATRIX.map((routeCase) => routeCase.id);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.length >= 19);
  assert.equal(ROUTE_CASE_MATRIX.some((routeCase) => routeCase.route === "/" && routeCase.auth === "public"), true);
  assert.equal(ROUTE_CASE_MATRIX.some((routeCase) => routeCase.route === "/shop" && routeCase.auth === "shop"), true);
  assert.equal(ROUTE_CASE_MATRIX.some((routeCase) => routeCase.route === "/admin" && routeCase.auth === "password-admin"), true);
  assert.equal(ROUTE_CASE_MATRIX.some((routeCase) => routeCase.expected.kind === "access-barrier"), true);
});

test("P0-P8 session matrix exposes five representative browser contexts", async () => {
  // Given the UI-first auth set, when session payloads are encoded, then they decode without real credentials
  assert.deepEqual(QA_AUTH_CONTEXT_KEYS, ["public", "member", "shop", "kakao-admin", "password-admin"]);
  for (const key of QA_AUTH_CONTEXT_KEYS) {
    const payload = qaSessionPayload(key);
    if (payload === null) {
      assert.equal(key, "public");
      continue;
    }
    assert.deepEqual(decodeSession(encodeSession(payload)), payload);
  }

  assert.throws(() => qaSessionPayload("unknown-fixture"), /unknown QA auth context/);
  const valid = encodeSession({ kakaoId: "qa-user-01", nickname: "합성 회원 01" });
  assert.equal(decodeSession(`${valid}tampered`), null);

  const browser = await chromium.launch({ headless: true });
  try {
    for (const key of QA_AUTH_CONTEXT_KEYS) {
      const context = await createQaBrowserContext(browser, key, process.env.EVIDENCE_DIR ?? "");
      const cookies = await context.cookies("http://127.0.0.1:3100");
      assert.equal(cookies.length, key === "public" ? 0 : 1);
      await context.close();
    }
    await assert.rejects(createQaBrowserContext(browser, "unknown-fixture", process.env.EVIDENCE_DIR ?? ""), /unknown QA auth context/);
  } finally {
    await browser.close();
  }
});

test("reset idempotence preserves keyed fixture data with a fresh generation", async () => {
  // Given the guarded local PostgreSQL owner
  const ownerToken = process.env.SURFING_QA_OWNER_TOKEN ?? "";
  const evidenceDirectory = process.env.EVIDENCE_DIR ?? "";
  const client = new PrismaClient();
  try {
    await assert.rejects(seedMobileUx(client, "old-generation", evidenceDirectory), /seed generation must be a UUID/);
    await db.start(ownerToken);

    // When reset and seed run twice
    const firstGeneration = await db.reset(ownerToken, evidenceDirectory);
    const first = await inspectMobileUxSeed(client);
    const secondGeneration = await db.reset(ownerToken, evidenceDirectory);
    const second = await inspectMobileUxSeed(client);

    // Then keyed data and checksum stay stable while the generation rotates everywhere
    assert.notEqual(firstGeneration, secondGeneration);
    assert.deepEqual(first.counts, { users: 35, meetings: 4, menus: 37, activeMenus: 36, activeVariants: 60 });
    assert.deepEqual(second.counts, first.counts);
    assert.deepEqual(second.meetingIds, MOBILE_UX_FIXTURE_IDS.meetings);
    assert.equal(second.checksum, first.checksum);
    assert.deepEqual(second.roles, ["ADMIN", "BANNED", "MEMBER", "SHOP_OWNER"]);
    assert.deepEqual(second.companionLinks, { linked: 1, unlinked: 1 });
    assert.deepEqual(second.orderStates, ["ACTIVE", "CANCELLED", "MIXED", "PREPARING", "SERVED"]);
    assert.deepEqual(second.usageStates, ["CONFIRMED", "MISSING", "SUBMITTED"]);
    assert.equal(second.repeatedSubmissionCount, 2);
    assert.equal(second.generation, secondGeneration);
    assert.equal(readFileSync(".tmp/qa/generation", "utf8").trim(), secondGeneration);
    assert.equal(await db.assertHealthy(ownerToken), secondGeneration);
  } finally {
    await client.$disconnect();
    await db.down(ownerToken);
  }
});
