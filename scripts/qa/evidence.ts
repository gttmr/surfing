import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";

const EVIDENCE_ROOT = resolve(".tmp/qa/evidence");

export class EvidencePathError extends Error {
  readonly name = "EvidencePathError";
}

export function parseEvidenceDirectory(candidate: string | undefined, targetName: string): string {
  const resolved = resolve(candidate ?? `.tmp/qa/evidence/${targetName.replaceAll(":", "-")}`);
  if (resolved !== EVIDENCE_ROOT && !resolved.startsWith(`${EVIDENCE_ROOT}${sep}`)) {
    throw new EvidencePathError("EVIDENCE_DIR must be inside .tmp/qa/evidence");
  }
  mkdirSync(resolved, { recursive: true });
  return resolved;
}

export function writeJsonEvidence(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

export function appendJsonEvidence(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify(value)}\n`, { encoding: "utf8", mode: 0o600 });
}
