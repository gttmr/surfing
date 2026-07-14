import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";

const MANIFEST_PATH = ".omo/evidence/ui-ux-audit/baseline-manifest.md";
const PRIVATE_ROOT = ".omo/evidence/ui-ux-audit/private";
const ROW_PATTERN = /^\| `([^`]+\.png)` \| `([0-9a-f]{64})` \| (\d+x\d+) \|/;

type ManifestRow = {
  readonly file: string;
  readonly sha256: string;
};

export class BaselineManifestError extends Error {
  readonly name = "BaselineManifestError";
}

function rows(): readonly ManifestRow[] {
  const manifest = readFileSync(MANIFEST_PATH, "utf8");
  return manifest.split("\n").flatMap((line) => {
    const match = ROW_PATTERN.exec(line);
    return match?.[1] && match[2] ? [{ file: match[1], sha256: match[2] }] : [];
  });
}

export function validateBaselineManifest(): void {
  const manifestRows = rows();
  if (manifestRows.length !== 34) {
    throw new BaselineManifestError(`baseline manifest expected 34 rows, found ${manifestRows.length}`);
  }
  for (const row of manifestRows) {
    if (basename(row.file) !== row.file) {
      throw new BaselineManifestError("baseline manifest contains a non-flat private path");
    }
    const privatePath = join(PRIVATE_ROOT, row.file);
    if (!existsSync(privatePath)) {
      continue;
    }
    const actual = createHash("sha256").update(readFileSync(privatePath)).digest("hex");
    if (actual !== row.sha256) {
      throw new BaselineManifestError(`private baseline hash mismatch for ${row.file}`);
    }
  }
}
