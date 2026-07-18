import type { QaTarget } from "./targets";

export class QaArgumentError extends Error {
  readonly name = "QaArgumentError";
}

function isNodeTestArgument(value: string): boolean {
  return value === "--test-concurrency=1"
    || value.startsWith("--test-name-pattern=");
}

function isPlaywrightArgument(value: string): boolean {
  return value.startsWith("tests/e2e/")
    || value === "--workers=1"
    || value === "--project=mobile-390"
    || value === "--project=mobile-430";
}

function isVisualArgument(value: string): boolean {
  return value === "--compare-existing"
    || value.startsWith("tests/visual/goldens")
    || value.startsWith(".omo/evidence/ui-ux-overhaul/visual/");
}

export function parsePassthrough(target: QaTarget, values: readonly string[]): readonly string[] {
  const valid = values.every((value) => {
    switch (target.passthrough) {
      case "none":
        return false;
      case "node-test":
        return isNodeTestArgument(value);
      case "playwright":
        return isPlaywrightArgument(value);
      case "visual":
        return isVisualArgument(value);
      default:
        return false;
    }
  });
  if ((!valid && values.length > 0) || (target.passthrough === "none" && values.length > 0)) {
    throw new QaArgumentError(`malformed passthrough for target ${target.name}`);
  }
  return values;
}
