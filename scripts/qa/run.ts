import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";
import { assertLocalTestDatabaseUrl } from "./assert-local-test-db";
import { guardedNodeArguments } from "./child-process-egress";
import { buildChildEnvironment } from "./environment";
import { finalizeCleanupReceipt } from "./cleanup";
import { parseEvidenceDirectory } from "./evidence";
import { acquireQaLock } from "./lock";
import { parsePassthrough } from "./passthrough";
import { createPrivateCapability } from "./private-capability";
import { isQaTargetName, QA_TARGETS } from "./targets";

type ParsedCommand = {
  readonly targetName: string;
  readonly candidateDatabaseUrl: string | null;
  readonly passthrough: readonly string[];
};

class QaInvocationError extends Error {
  readonly name = "QaInvocationError";
}

function parseCommand(args: readonly string[]): ParsedCommand {
  const targetName = args[0] ?? "";
  let candidateDatabaseUrl: string | null = null;
  const passthrough: string[] = [];
  for (let index = 1; index < args.length; index += 1) {
    const value = args[index];
    if (value === "--candidate-database-url") {
      const candidate = args[index + 1];
      if (!candidate) {
        throw new QaInvocationError("malformed candidate database option");
      }
      candidateDatabaseUrl = candidate;
      index += 1;
    } else if (value !== undefined && value !== "--") {
      passthrough.push(value);
    }
  }
  return { targetName, candidateDatabaseUrl, passthrough };
}

async function spawnInternal(args: readonly string[], env: NodeJS.ProcessEnv): Promise<number> {
  const internal = resolve("scripts/qa/internal-target.ts");
  const capability = createPrivateCapability();
  const child = spawn(process.execPath, guardedNodeArguments([internal, ...args]), {
    cwd: process.cwd(),
    env,
    shell: false,
    stdio: ["inherit", "inherit", "inherit", capability.authDescriptor, capability.guardDescriptor],
  });
  capability.close();
  let interrupted = false;
  const forward = (signal: NodeJS.Signals) => {
    interrupted = true;
    child.kill(signal);
  };
  process.on("SIGINT", forward);
  process.on("SIGTERM", forward);
  const result = await new Promise<number>((resolveExit, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolveExit(code ?? (interrupted ? 143 : 1)));
  });
  process.off("SIGINT", forward);
  process.off("SIGTERM", forward);
  return result;
}

async function main(): Promise<void> {
  if (process.env.SURFING_QA_OWNER_TOKEN || process.env.SURFING_QA_CHILD_TOKEN) {
    throw new QaInvocationError("nested public QA launcher refused: live owner or child capability present");
  }
  const command = parseCommand(process.argv.slice(2));
  if (!isQaTargetName(command.targetName)) {
    throw new QaInvocationError("unknown QA target");
  }
  const target = QA_TARGETS[command.targetName];
  if (command.candidateDatabaseUrl) {
    assertLocalTestDatabaseUrl(command.candidateDatabaseUrl);
  }
  const passthrough = parsePassthrough(target, command.passthrough);
  const evidenceDirectory = parseEvidenceDirectory(process.env.EVIDENCE_DIR);
  const ownerToken = target.ownerLifecycle ? randomUUID() : null;
  const release = target.ownerLifecycle ? acquireQaLock() : () => undefined;
  let exitCode = 1;
  try {
    const env = buildChildEnvironment({ target, evidenceDirectory, ownerToken });
    exitCode = await spawnInternal([target.name, ...passthrough], env);
    process.exitCode = exitCode;
  } finally {
    release();
  }
  if (target.action === "db-down" && exitCode === 0) {
    await finalizeCleanupReceipt(evidenceDirectory);
  }
}

main().catch((error: unknown) => {
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error("unknown QA wrapper failure");
  }
  process.exitCode = 1;
});
