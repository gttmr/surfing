import { readFileSync } from "node:fs";
import { isQaTargetName, QA_TARGET_NAMES } from "./targets";

type PackageJson = {
  readonly scripts: Readonly<Record<string, string>>;
};

const QA_SCRIPT_PATTERN = /^(qa:|test:|build:qa$|start:qa$)/;
const PRODUCT_SCRIPTS = {
  dev: "next dev",
  build: "prisma generate && next build",
  start: "next start -p ${PORT:-3000}",
  postinstall: "prisma generate",
} as const;

export class QaRegistryAuditError extends Error {
  readonly name = "QaRegistryAuditError";
}

export function auditQaRegistry(): void {
  const packageJson: PackageJson = JSON.parse(readFileSync("package.json", "utf8"));
  for (const [name, command] of Object.entries(packageJson.scripts)) {
    if (!QA_SCRIPT_PATTERN.test(name)) {
      continue;
    }
    if (!isQaTargetName(name)) {
      throw new QaRegistryAuditError(`QA package script is absent from registry: ${name}`);
    }
    if (command !== `tsx scripts/qa/run.ts ${name}`) {
      throw new QaRegistryAuditError(`QA package script bypasses wrapper: ${name}`);
    }
  }
  for (const name of QA_TARGET_NAMES.filter((value) => !value.startsWith("probe:"))) {
    if (packageJson.scripts[name] !== `tsx scripts/qa/run.ts ${name}`) {
      throw new QaRegistryAuditError(`registered QA target is absent from package scripts: ${name}`);
    }
  }
  for (const [name, command] of Object.entries(PRODUCT_SCRIPTS)) {
    if (packageJson.scripts[name] !== command) {
      throw new QaRegistryAuditError(`product lifecycle script changed: ${name}`);
    }
  }
}
