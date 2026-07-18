import { existsSync, rmSync } from "node:fs";
import net from "node:net";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { QA_APP_PORT, QA_DATABASE_PORT, QA_HOST } from "./assert-local-test-db";
import { writeJsonEvidence } from "./evidence";
import { QA_LOCK_PATH } from "./lock";
import { assertTaskProcessesAbsent } from "./process-registry";

type CleanupStatus = "absent" | "removed";
type CleanupReceipt = {
  readonly container: CleanupStatus;
  readonly volume: CleanupStatus;
  readonly databasePort: CleanupStatus;
  readonly applicationPort: CleanupStatus;
  readonly ownerLock: CleanupStatus;
  readonly taskProcesses: CleanupStatus;
  readonly generation: CleanupStatus;
  readonly server: CleanupStatus;
  readonly browserAuth: CleanupStatus;
  readonly uploads: CleanupStatus;
};

export class QaCleanupError extends Error {
  readonly name = "QaCleanupError";
}

function dockerAbsent(args: readonly string[]): boolean {
  const result = spawnSync("docker", args, { encoding: "utf8", timeout: 10_000 });
  return result.status !== 0 || result.stdout.trim() === "";
}

async function assertPortAbsent(port: number, label: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const socket = net.connect({ host: QA_HOST, port });
    const timer = setTimeout(() => {
      socket.destroy();
      reject(new QaCleanupError(`QA ${label} port cleanup check timed out`));
    }, 1_000);
    socket.once("connect", () => {
      clearTimeout(timer);
      socket.destroy();
      reject(new QaCleanupError(`QA ${label} port remains open`));
    });
    socket.once("error", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

function removeGeneratedPath(path: string): CleanupStatus {
  if (!existsSync(path)) {
    return "absent";
  }
  rmSync(path, { force: true, recursive: true });
  return "removed";
}

async function assertCoreResourcesAbsent(): Promise<void> {
  if (!dockerAbsent(["compose", "-p", "surfing-ux-qa", "-f", "compose.qa.yml", "ps", "-q"])) {
    throw new QaCleanupError("QA database container remains present");
  }
  if (!dockerAbsent(["volume", "inspect", "surfing-ux-qa-data"])) {
    throw new QaCleanupError("QA database volume remains present");
  }
  await assertPortAbsent(QA_DATABASE_PORT, "database");
  await assertPortAbsent(QA_APP_PORT, "application");
  assertTaskProcessesAbsent();
}

export async function cleanupQaResources(): Promise<void> {
  await assertCoreResourcesAbsent();
  removeGeneratedPath(".tmp/qa/generation");
  removeGeneratedPath(".tmp/qa/server.pid");
  removeGeneratedPath(".tmp/qa/capabilities");
  removeGeneratedPath("tests/.auth");
  removeGeneratedPath(".tmp/qa/uploads");
}

export async function finalizeCleanupReceipt(evidenceDirectory: string): Promise<CleanupReceipt> {
  await assertCoreResourcesAbsent();
  if (existsSync(QA_LOCK_PATH)) {
    throw new QaCleanupError("QA owner lock remains present");
  }
  const receipt: CleanupReceipt = {
    container: "absent",
    volume: "absent",
    databasePort: "absent",
    applicationPort: "absent",
    ownerLock: "absent",
    taskProcesses: "absent",
    generation: removeGeneratedPath(".tmp/qa/generation"),
    server: removeGeneratedPath(".tmp/qa/server.pid"),
    browserAuth: removeGeneratedPath("tests/.auth"),
    uploads: removeGeneratedPath(".tmp/qa/uploads"),
  };
  writeJsonEvidence(join(evidenceDirectory, "cleanup-receipt.json"), receipt);
  return receipt;
}
