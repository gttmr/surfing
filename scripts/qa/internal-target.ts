import { assertFixedDatabaseEnvironment } from "./assert-local-test-db";
import { verifyInternalCapability } from "./private-capability";
import { isQaTargetName, QA_TARGETS } from "./targets";

class QaChildRefusalError extends Error {
  readonly name = "QaChildRefusalError";
}

async function main(): Promise<void> {
  verifyInternalCapability();
  assertFixedDatabaseEnvironment(process.env);
  const targetName = process.argv[2] ?? "";
  if (!isQaTargetName(targetName)) {
    throw new QaChildRefusalError("unknown child target refused before target import");
  }
  process.stdout.write("QA_CHILD_SENTINEL accepted\n");
  const { executeTarget } = await import("./target-actions");
  const exitCode = await executeTarget(QA_TARGETS[targetName], process.argv.slice(3));
  process.exitCode = exitCode;
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "unknown internal QA target failure");
  process.exitCode = 1;
});
