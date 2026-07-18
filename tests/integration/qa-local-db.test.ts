import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { chromium } from "@playwright/test";
import { installBrowserEgressGuard, recordBrowserOAuthLocation } from "../../scripts/qa/browser-egress";
import { db } from "../../scripts/qa/local-db";

test("local PostgreSQL owner lifecycle preserves generation and blocks browser egress", async () => {
  const ownerToken = process.env.SURFING_QA_OWNER_TOKEN ?? "";
  const evidenceDirectory = process.env.EVIDENCE_DIR ?? "";
  let browserClosed = true;
  try {
    await db.start(ownerToken);
    assert.equal(await db.assertHealthy(ownerToken), null);
    await db.push(ownerToken);
    const firstGeneration = await db.reset(ownerToken, evidenceDirectory);
    assert.equal(await db.assertHealthy(ownerToken), firstGeneration);

    await db.stop(ownerToken);
    await db.start(ownerToken);
    assert.equal(await db.assertHealthy(ownerToken), firstGeneration);

    const secondGeneration = await db.reset(ownerToken, evidenceDirectory);
    assert.notEqual(secondGeneration, firstGeneration);
    assert.equal(await db.assertHealthy(ownerToken), secondGeneration);

    const browser = await chromium.launch({ headless: true });
    browserClosed = false;
    try {
      const context = await browser.newContext();
      await installBrowserEgressGuard(context, evidenceDirectory);
      const page = await context.newPage();
      await assert.rejects(page.goto("https://external.invalid/qa", { timeout: 5_000 }));
      recordBrowserOAuthLocation(evidenceDirectory);
      await context.close();
    } finally {
      await browser.close();
      browserClosed = true;
    }

    const browserLedger = readFileSync(join(evidenceDirectory, "browser-egress-ledger.jsonl"), "utf8");
    assert.match(browserLedger, /"outcome":"blocked"/);
    assert.match(browserLedger, /"outcome":"redirect-location-only"/);
    assert.doesNotMatch(browserLedger, /https?:\/\//);
  } finally {
    assert.equal(browserClosed, true);
    await db.down(ownerToken);
  }
});
