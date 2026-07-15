import assert from "node:assert/strict";
import { mkdirSync, rmSync } from "node:fs";
import net from "node:net";
import { spawnSync } from "node:child_process";
import test from "node:test";
import type { PrismaClient } from "@prisma/client";
import { seedMobileUx } from "./seed-mobile-ux";

const ROOT = process.cwd();
const INTERNAL = "scripts/qa/internal-target.ts";
const EVIDENCE_DIR = ".omo/evidence/ui-ux-overhaul/integration";
const FIXED_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:55432/surfing_ux_test";

function inheritedEnvironment(extra: Readonly<Record<string, string>> = {}): NodeJS.ProcessEnv {
  return {
    ...process.env,
    DATABASE_URL: FIXED_DATABASE_URL,
    DIRECT_URL: FIXED_DATABASE_URL,
    EVIDENCE_DIR,
    ...extra,
  };
}

function runNodeScript(source: string) {
  return spawnSync(process.execPath, ["--import", "tsx", "-e", source], {
    cwd: ROOT,
    encoding: "utf8",
    env: inheritedEnvironment(),
  });
}

async function listenOnAppPort(): Promise<net.Server> {
  const server = net.createServer();
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(3100, "127.0.0.1", resolve);
  });
  return server;
}

async function closeServer(server: net.Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error === undefined ? resolve() : reject(error));
  });
}

test("QA registry environment lock and egress refusal: security regressions", async (t) => {
  await t.test("destructive fixture seed refuses a non-local database before client access", async () => {
    const previousDatabaseUrl = process.env.DATABASE_URL;
    const previousDirectUrl = process.env.DIRECT_URL;
    let clientTouched = false;
    const client = new Proxy({}, {
      get() {
        clientTouched = true;
        throw new Error("database client must not be touched");
      },
    }) as PrismaClient;

    process.env.DATABASE_URL = "postgresql://example:example@db.example.invalid:5432/production";
    process.env.DIRECT_URL = process.env.DATABASE_URL;
    try {
      await assert.rejects(
        seedMobileUx(client, "00000000-0000-4000-8000-000000000001", EVIDENCE_DIR),
        /refused database candidate/i,
      );
      assert.equal(clientTouched, false);
    } finally {
      if (previousDatabaseUrl === undefined) delete process.env.DATABASE_URL;
      else process.env.DATABASE_URL = previousDatabaseUrl;
      if (previousDirectUrl === undefined) delete process.env.DIRECT_URL;
      else process.env.DIRECT_URL = previousDirectUrl;
    }
  });

  await t.test("matching forged environment capabilities cannot invoke an internal target", () => {
    const result = spawnSync("./node_modules/.bin/tsx", [INTERNAL, "qa:run"], {
      cwd: ROOT,
      encoding: "utf8",
      env: inheritedEnvironment({
        SURFING_QA_CHILD_TOKEN: "forged",
        SURFING_QA_EXPECTED_CHILD_TOKEN: "forged",
        SURFING_QA_EGRESS_GUARD: "installed-v1",
      }),
    });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /private child capability/i);
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, /QA_CHILD_SENTINEL/);
  });

  await t.test("allowed Node descendants inherit DNS and fetch refusal", () => {
    const dns = runNodeScript(`
      const dns = require("node:dns");
      try {
        dns.lookup("external.invalid", (error) => {
          process.stderr.write(String(error?.code ?? "unexpected-resolution"));
          process.exit(2);
        });
      } catch (error) {
        process.stderr.write(error?.name ?? "unknown-error");
        process.exit(error?.name === "EgressBlockedError" ? 0 : 3);
      }
    `);
    assert.equal(dns.status, 0, dns.stderr);
    assert.match(dns.stderr, /EgressBlockedError/);
    assert.doesNotMatch(dns.stderr, /ENOTFOUND/);

    const fetch = runNodeScript(`
      void (async () => {
        try {
          await fetch("https://external.invalid/qa");
          process.stderr.write("unexpected-response");
          process.exit(2);
        } catch (error) {
          const detail = error?.cause?.code ?? error?.name ?? "unknown-error";
          process.stderr.write(String(detail));
          process.exit(error?.name === "EgressBlockedError" ? 0 : 3);
        }
      })();
    `);
    assert.equal(fetch.status, 0, fetch.stderr);
    assert.match(fetch.stderr, /EgressBlockedError/);
    assert.doesNotMatch(fetch.stderr, /ENOTFOUND/);
  });

  await t.test("cleanup refuses an occupied application port before an all-clear receipt", async () => {
    mkdirSync(EVIDENCE_DIR, { recursive: true });
    rmSync(`${EVIDENCE_DIR}/cleanup-receipt.json`, { force: true });
    const server = await listenOnAppPort();
    try {
      const cleanup = runNodeScript(`
        void import("./scripts/qa/cleanup.ts")
          .then(({ cleanupQaResources }) => cleanupQaResources())
          .then(() => process.exit(0))
          .catch((error) => {
            process.stderr.write(error instanceof Error ? error.message : String(error));
            process.exit(1);
          });
      `);
      assert.notEqual(cleanup.status, 0);
      assert.match(cleanup.stderr, /QA application port remains open/i);
    } finally {
      await closeServer(server);
    }
  });
});
