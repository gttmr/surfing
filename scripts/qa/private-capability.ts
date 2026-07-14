import { randomUUID } from "node:crypto";
import { closeSync, mkdirSync, openSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";

const AUTH_FD = 3;
const GUARD_FD = 4;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
let installedGuardCapability = "";

export type PrivateCapability = {
  readonly authDescriptor: number;
  readonly guardDescriptor: number;
  close(): void;
};

export class QaPrivateCapabilityError extends Error {
  readonly name = "QaPrivateCapabilityError";
}

function unlinkedDescriptor(value: string, label: string): number {
  mkdirSync(".tmp/qa/capabilities", { recursive: true, mode: 0o700 });
  const path = `.tmp/qa/capabilities/${label}-${process.pid}-${randomUUID()}`;
  writeFileSync(path, `${value}\n`, { encoding: "utf8", mode: 0o600 });
  const descriptor = openSync(path, "r");
  unlinkSync(path);
  return descriptor;
}

function closeDescriptor(descriptor: number): void {
  try {
    closeSync(descriptor);
  } catch (error) {
    if (!(error instanceof Error && "code" in error && error.code === "EBADF")) {
      throw error;
    }
  }
}

function readCapability(descriptor: number): string {
  try {
    const value = readFileSync(descriptor, "utf8").trim();
    if (!UUID_PATTERN.test(value)) {
      throw new QaPrivateCapabilityError("private child capability is malformed");
    }
    return value;
  } catch (error) {
    if (error instanceof QaPrivateCapabilityError) {
      throw error;
    }
    throw new QaPrivateCapabilityError("private child capability is unavailable", { cause: error });
  }
}

export function createPrivateCapability(): PrivateCapability {
  const value = randomUUID();
  const authDescriptor = unlinkedDescriptor(value, "auth");
  const guardDescriptor = unlinkedDescriptor(value, "guard");
  return {
    authDescriptor,
    guardDescriptor,
    close() {
      closeDescriptor(authDescriptor);
      closeDescriptor(guardDescriptor);
    },
  };
}

export function installGuardCapability(): void {
  try {
    installedGuardCapability = readCapability(GUARD_FD);
    process.env.SURFING_QA_TRANSITIVE_GUARD = installedGuardCapability;
  } catch (error) {
    const inherited = process.env.SURFING_QA_TRANSITIVE_GUARD ?? "";
    if (!UUID_PATTERN.test(inherited)) {
      throw error;
    }
    installedGuardCapability = inherited;
  }
}

export function verifyInternalCapability(): void {
  const received = readCapability(AUTH_FD);
  if (!installedGuardCapability || received !== installedGuardCapability) {
    throw new QaPrivateCapabilityError("private child capability does not match the installed guard");
  }
}
