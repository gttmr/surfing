import { closeSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

export const QA_LOCK_PATH = ".tmp/qa/surfing-ux.lock";

type LockRecord = {
  readonly pid: number;
  readonly lockId: string;
};

export class QaLockError extends Error {
  readonly name = "QaLockError";
}

function parseLockRecord(raw: string): LockRecord | null {
  const value: unknown = JSON.parse(raw);
  if (typeof value !== "object" || value === null || !("pid" in value) || !("lockId" in value)) {
    return null;
  }
  if (typeof value.pid !== "number" || !Number.isInteger(value.pid) || typeof value.lockId !== "string") {
    return null;
  }
  return { pid: value.pid, lockId: value.lockId };
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

function removeStaleLock(): boolean {
  try {
    const record = parseLockRecord(readFileSync(QA_LOCK_PATH, "utf8"));
    if (record && processIsAlive(record.pid)) {
      throw new QaLockError(`QA lifecycle already owned by live pid ${record.pid}`);
    }
    unlinkSync(QA_LOCK_PATH);
    return true;
  } catch (error) {
    if (error instanceof QaLockError) {
      throw error;
    }
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return true;
    }
    throw error;
  }
}

export function acquireQaLock(): () => void {
  mkdirSync(dirname(QA_LOCK_PATH), { recursive: true });
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const descriptor = openSync(QA_LOCK_PATH, "wx", 0o600);
      const record: LockRecord = { pid: process.pid, lockId: randomUUID() };
      writeFileSync(descriptor, `${JSON.stringify(record)}\n`, "utf8");
      closeSync(descriptor);
      return () => {
        try {
          unlinkSync(QA_LOCK_PATH);
        } catch (error) {
          if (!(error instanceof Error && "code" in error && error.code === "ENOENT")) {
            throw error;
          }
        }
      };
    } catch (error) {
      if (!(error instanceof Error && "code" in error && error.code === "EEXIST")) {
        throw error;
      }
      removeStaleLock();
    }
  }
  throw new QaLockError("could not acquire QA lifecycle lock");
}
