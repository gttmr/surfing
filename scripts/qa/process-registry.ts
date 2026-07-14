import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";

const REGISTRY_DIRECTORY = ".tmp/qa/processes";

type ProcessKind = "browser" | "server";
type ProcessRecord = {
  readonly kind: ProcessKind;
  readonly pid: number;
};

export class QaProcessRegistryError extends Error {
  readonly name = "QaProcessRegistryError";
}

function recordPath(record: ProcessRecord): string {
  return `${REGISTRY_DIRECTORY}/${record.kind}-${record.pid}.json`;
}

function parseRecord(path: string): ProcessRecord {
  const value: unknown = JSON.parse(readFileSync(path, "utf8"));
  if (typeof value !== "object" || value === null || !("kind" in value) || !("pid" in value)) {
    throw new QaProcessRegistryError("task-owned process record is malformed");
  }
  const kind = value.kind;
  if ((kind !== "browser" && kind !== "server") || typeof value.pid !== "number" || !Number.isInteger(value.pid) || value.pid < 1) {
    throw new QaProcessRegistryError("task-owned process record is malformed");
  }
  return { kind, pid: value.pid };
}

function processIsAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ESRCH") {
      return false;
    }
    throw error;
  }
}

export function registerTaskProcess(kind: ProcessKind, pid: number): () => void {
  const record = { kind, pid } as const;
  mkdirSync(REGISTRY_DIRECTORY, { recursive: true, mode: 0o700 });
  writeFileSync(recordPath(record), `${JSON.stringify(record)}\n`, { encoding: "utf8", mode: 0o600 });
  return () => rmSync(recordPath(record), { force: true });
}

export function assertTaskProcessesAbsent(): void {
  if (!existsSync(REGISTRY_DIRECTORY)) {
    return;
  }
  for (const name of readdirSync(REGISTRY_DIRECTORY)) {
    const path = `${REGISTRY_DIRECTORY}/${name}`;
    const record = parseRecord(path);
    if (processIsAlive(record.pid)) {
      throw new QaProcessRegistryError(`task-owned ${record.kind} process remains alive`);
    }
    rmSync(path, { force: true });
  }
  rmSync(REGISTRY_DIRECTORY, { force: true, recursive: true });
}
