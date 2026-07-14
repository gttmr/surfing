import { readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { db } from "./local-db";
import { probeEgress, probeEnvironment, holdOwnerLock } from "./probes";
import { auditQaRegistry } from "./registry-audit";
import { runQaServer } from "./start-server";
import type { QaTarget } from "./targets";

export class QaTargetExecutionError extends Error {
  readonly name = "QaTargetExecutionError";
}

function runNode(args: readonly string[], timeout = 300_000): void {
  const result = spawnSync(process.execPath, args, {
    cwd: process.cwd(),
    env: process.env,
    shell: false,
    stdio: "inherit",
    timeout,
  });
  if (result.error) {
    throw new QaTargetExecutionError("guarded Node target failed to execute", { cause: result.error });
  }
  if (result.status !== 0) {
    throw new QaTargetExecutionError(`guarded Node target exited ${result.status}`);
  }
}

function testFiles(directory: string): readonly string[] {
  return readdirSync(directory)
    .filter((name) => name.endsWith(".test.ts"))
    .sort()
    .map((name) => join(directory, name));
}

function runTests(files: readonly string[], passthrough: readonly string[]): void {
  runNode([
    "--import",
    "tsx",
    "--import",
    resolve("scripts/qa/process-egress-guard.ts"),
    "--test",
    "--test-concurrency=1",
    ...passthrough.filter((value) => value !== "--test-concurrency=1"),
    ...files,
  ]);
}

function ownerToken(): string {
  const token = process.env.SURFING_QA_OWNER_TOKEN;
  if (!token) {
    throw new QaTargetExecutionError("owner capability is required for this target");
  }
  return token;
}

async function executeDatabaseAction(action: string, evidenceDirectory: string): Promise<boolean> {
  if (!action.startsWith("db-")) {
    return false;
  }
  const owner = ownerToken();
  switch (action) {
    case "db-up":
      await db.start(owner);
      return true;
    case "db-assert":
      await db.assertHealthy(owner);
      return true;
    case "db-push":
      await db.push(owner);
      return true;
    case "db-reset":
      await db.reset(owner, evidenceDirectory);
      return true;
    case "db-down":
      await db.down(owner);
      return true;
    default:
      return false;
  }
}

export async function executeTarget(target: QaTarget, passthrough: readonly string[]): Promise<number> {
  const evidenceDirectory = process.env.EVIDENCE_DIR ?? "";
  if (await executeDatabaseAction(target.action, evidenceDirectory)) {
    return 0;
  }
  switch (target.action) {
    case "registry-audit":
      auditQaRegistry();
      return 0;
    case "browsers-install":
      runNode(["node_modules/playwright/cli.js", "install", "chromium"], 600_000);
      return 0;
    case "test-unit":
      runTests([...testFiles("src/lib"), ...testFiles("scripts/qa")], passthrough);
      return 0;
    case "test-integration":
      runTests(testFiles("tests/integration"), passthrough);
      return 0;
    case "build":
      runNode(["node_modules/prisma/build/index.js", "generate"]);
      runNode(["--import", "tsx", "--import", resolve("scripts/qa/process-egress-guard.ts"), "node_modules/next/dist/bin/next", "build"]);
      return 0;
    case "start":
      return runQaServer();
    case "test-e2e":
      runNode(["node_modules/playwright/cli.js", "test", ...passthrough]);
      return 0;
    case "probe-environment":
      probeEnvironment(evidenceDirectory);
      return 0;
    case "probe-egress":
      await probeEgress();
      return 0;
    case "probe-hold-lock":
      await holdOwnerLock();
      return 0;
    case "not-implemented":
      throw new QaTargetExecutionError(`QA target ${target.name} is registered but not yet implemented`);
    default:
      throw new QaTargetExecutionError(`QA target action is not implemented: ${target.action}`);
  }
}
