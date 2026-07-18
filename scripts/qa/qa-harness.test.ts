import assert from "node:assert/strict";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import test from "node:test";
import { guardedNodeArguments, QA_GUARD_BOOTSTRAP } from "./child-process-egress";

const ROOT = process.cwd();
const RUNNER = "scripts/qa/run.ts";
const INTERNAL = "scripts/qa/internal-target.ts";
const EVIDENCE_DIR = ".omo/evidence/ui-ux-overhaul/integration";

const QA_SCRIPTS = [
  "qa:browsers:install",
  "qa:run",
  "test:unit",
  "test:integration",
  "qa:db:assert",
  "qa:db:up",
  "qa:db:push",
  "qa:db:seed",
  "qa:db:reset",
  "qa:db:down",
  "build:qa",
  "start:qa",
  "test:e2e:mobile",
  "qa:visual",
  "gate:f1",
  "gate:f2",
  "gate:f3",
] as const;

type PackageJson = {
  readonly scripts: Readonly<Record<string, string>>;
};

function packageJson(): PackageJson {
  return JSON.parse(readFileSync(`${ROOT}/package.json`, "utf8"));
}

function publicEnvironment(extraEnv: Readonly<Record<string, string>> = {}): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...process.env, EVIDENCE_DIR, ...extraEnv };
  delete env.SURFING_QA_CHILD_TOKEN;
  delete env.SURFING_QA_EXPECTED_CHILD_TOKEN;
  delete env.SURFING_QA_OWNER_TOKEN;
  return env;
}

function runTsx(args: readonly string[], extraEnv: Readonly<Record<string, string>> = {}) {
  return spawnSync("./node_modules/.bin/tsx", args, {
    cwd: ROOT,
    encoding: "utf8",
    env: publicEnvironment(extraEnv),
  });
}

async function waitForReady(child: ReturnType<typeof spawn>): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("lock owner readiness timed out")), 5_000);
    child.stdout?.on("data", (chunk: Buffer) => {
      if (chunk.toString().includes("QA_PROBE_READY")) {
        clearTimeout(timer);
        resolve();
      }
    });
    child.once("error", reject);
  });
}

test("QA registry environment lock and egress refusal", async (t) => {
  await t.test("transitive guard uses one Next-compatible preload", () => {
    const guarded = guardedNodeArguments(["worker.js"]);
    assert.deepEqual(guarded, ["--import", QA_GUARD_BOOTSTRAP, "worker.js"]);
    assert.deepEqual(guardedNodeArguments(guarded), guarded);
  });

  await t.test("registry owns every QA package script", () => {
    assert.equal(existsSync(`${ROOT}/scripts/qa/targets.ts`), true, "target registry behavior is missing");
    const scripts = packageJson().scripts;
    for (const name of QA_SCRIPTS) {
      assert.match(scripts[name] ?? "", /^tsx scripts\/qa\/run\.ts /, `${name} bypasses the wrapper`);
    }
    const audit = runTsx([RUNNER, "qa:run"]);
    assert.equal(audit.status, 0, audit.stderr);
  });

  await t.test("environment wrapper refuses unsafe candidates before child execution", () => {
    assert.equal(existsSync(`${ROOT}/${RUNNER}`), true, "sanitized environment wrapper behavior is missing");
    const result = runTsx([RUNNER, "qa:db:assert", "--candidate-database-url", "postgresql://db.invalid:5432/surfing"]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /refused database candidate/i);
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, /QA_CHILD_SENTINEL/);

    const invalidEvidence = spawnSync("./node_modules/.bin/tsx", [RUNNER, "probe:environment"], {
      cwd: ROOT,
      encoding: "utf8",
      env: publicEnvironment({ EVIDENCE_DIR: "/tmp/surfing-qa-escape" }),
    });
    assert.notEqual(invalidEvidence.status, 0);
    assert.match(invalidEvidence.stderr, /EVIDENCE_DIR must be inside/);

    const malformed = runTsx([RUNNER, "test:unit", "--workers=9"]);
    assert.notEqual(malformed.status, 0);
    assert.match(malformed.stderr, /malformed passthrough/);
  });

  await t.test("direct internal invocation is refused", () => {
    assert.equal(existsSync(`${ROOT}/${INTERNAL}`), true, "internal target refusal behavior is missing");
    const result = runTsx([INTERNAL, "qa:db:assert"], { SURFING_QA_CHILD_TOKEN: "" });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /child capability/i);
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, /QA_CHILD_SENTINEL/);
  });

  await t.test("lock and egress probes are registered", () => {
    assert.equal(existsSync(`${ROOT}/scripts/qa/process-egress-guard.ts`), true, "egress refusal behavior is missing");
    assert.equal(existsSync(`${ROOT}/scripts/qa/local-db.ts`), true, "owner lock behavior is missing");
    const scripts = packageJson().scripts;
    assert.match(scripts["test:unit"] ?? "", /scripts\/qa\/run\.ts/);

    const environment = runTsx([RUNNER, "probe:environment"], {
      KAKAO_CLIENT_SECRET: "inherited-value-must-be-cleared",
      VERCEL_OIDC_TOKEN: "inherited-value-must-be-cleared",
      HTTPS_PROXY: "http://external.invalid:8080",
      SURFING_QA_FORBIDDEN_SAMPLE: "must-not-survive",
    });
    assert.equal(environment.status, 0, environment.stderr);
    const receipt = readFileSync(`${EVIDENCE_DIR}/env-receipt.json`, "utf8");
    assert.doesNotMatch(receipt, /inherited-value|postgresql:|session-secret|admin-password/);
    assert.match(receipt, /"classification": "empty"/);

    rmSync(`${EVIDENCE_DIR}/server-egress-ledger.jsonl`, { force: true });
    const egress = runTsx([RUNNER, "probe:egress"]);
    assert.equal(egress.status, 0, egress.stderr);
    const ledger = readFileSync(`${EVIDENCE_DIR}/server-egress-ledger.jsonl`, "utf8");
    for (const protocol of ["dns.lookup", "dns.resolve", "dns.promises.lookup", "net.connect", "net.createConnection", "net.Socket.connect", "tls.connect", "fetch", "http.get", "https.get", "child-process", "child-process-shell", "undici.request"]) {
      assert.match(ledger, new RegExp(`"protocol":"${protocol.replace(".", "\\.")}"`));
    }
    assert.doesNotMatch(ledger, /https?:\/\//);
  });

  await t.test("live owners refuse competitors and interrupted owners clean the lock", async () => {
    rmSync(`${ROOT}/.tmp/qa`, { force: true, recursive: true });
    const owner = spawn("./node_modules/.bin/tsx", [RUNNER, "probe:hold-lock"], {
      cwd: ROOT,
      env: publicEnvironment(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    await waitForReady(owner);
    const competitor = runTsx([RUNNER, "qa:db:assert"]);
    assert.notEqual(competitor.status, 0);
    assert.match(competitor.stderr, /already owned by live pid/);
    owner.kill("SIGTERM");
    await new Promise<void>((resolve) => owner.once("exit", () => resolve()));
    assert.equal(existsSync(`${ROOT}/.tmp/qa/surfing-ux.lock`), false);

    mkdirSync(`${ROOT}/.tmp/qa`, { recursive: true });
    writeFileSync(`${ROOT}/.tmp/qa/surfing-ux.lock`, JSON.stringify({ pid: 2_147_483_647, lockId: "stale" }));
    const replacement = spawn("./node_modules/.bin/tsx", [RUNNER, "probe:hold-lock"], {
      cwd: ROOT,
      env: publicEnvironment(),
      stdio: ["ignore", "pipe", "pipe"],
    });
    await waitForReady(replacement);
    replacement.kill("SIGTERM");
    await new Promise<void>((resolve) => replacement.once("exit", () => resolve()));
    assert.equal(existsSync(`${ROOT}/.tmp/qa/surfing-ux.lock`), false);
  });

  await t.test("stale reset generation refuses before child execution", () => {
    mkdirSync(`${ROOT}/.tmp/qa`, { recursive: true });
    writeFileSync(`${ROOT}/.tmp/qa/generation`, "not-a-uuid\n");
    const result = runTsx([RUNNER, "probe:environment"]);
    rmSync(`${ROOT}/.tmp/qa/generation`, { force: true });
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /stale QA reset generation file is invalid/);
    assert.doesNotMatch(`${result.stdout}${result.stderr}`, /QA_CHILD_SENTINEL/);
  });

  await t.test("baseline manifest and literal ignore policy are present", () => {
    const manifest = readFileSync(`${ROOT}/.omo/evidence/ui-ux-audit/baseline-manifest.md`, "utf8");
    const rows = manifest.split("\n").filter((line) => /^\| `[^`]+\.png` \|/.test(line));
    assert.equal(rows.length, 34);

    const ignore = readFileSync(`${ROOT}/.gitignore`, "utf8");
    for (const literal of [
      "/.omo/drafts/",
      "/.omo/plans/",
      "/.omo/evidence/ui-ux-audit/private/",
      "/.omo/evidence/ui-ux-overhaul/**",
      "/tests/.auth/",
      "/public/uploads/",
      "/.tmp/qa/",
    ]) {
      assert.equal(ignore.split("\n").includes(literal), true, `missing literal ignore rule: ${literal}`);
    }
  });
});
