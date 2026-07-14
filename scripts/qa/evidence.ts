import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";

const EVIDENCE_ROOT = resolve(".omo/evidence/ui-ux-overhaul");

export class EvidencePathError extends Error {
  readonly name = "EvidencePathError";
}

export function parseEvidenceDirectory(candidate: string | undefined): string {
  if (!candidate) {
    throw new EvidencePathError("EVIDENCE_DIR is required");
  }
  const resolved = resolve(candidate);
  if (resolved !== EVIDENCE_ROOT && !resolved.startsWith(`${EVIDENCE_ROOT}${sep}`)) {
    throw new EvidencePathError("EVIDENCE_DIR must be inside .omo/evidence/ui-ux-overhaul");
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
