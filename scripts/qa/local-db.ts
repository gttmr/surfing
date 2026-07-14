import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { assertFixedDatabaseEnvironment } from "./assert-local-test-db";
import { cleanupQaResources } from "./cleanup";
import { writeJsonEvidence } from "./evidence";

const COMPOSE = ["compose", "-p", "surfing-ux-qa", "-f", "compose.qa.yml"] as const;
const GENERATION_PATH = ".tmp/qa/generation";

export class QaDatabaseLifecycleError extends Error {
  readonly name = "QaDatabaseLifecycleError";
}

function assertOwner(ownerToken: string): void {
  if (!ownerToken || ownerToken !== process.env.SURFING_QA_OWNER_TOKEN) {
    throw new QaDatabaseLifecycleError("owner capability refused for local database lifecycle");
  }
}

function run(command: string, args: readonly string[], timeout = 120_000): string {
  const result = spawnSync(command, args, {
    cwd: process.cwd(),
    encoding: "utf8",
    env: process.env,
    shell: false,
    timeout,
  });
  if (result.error) {
    throw new QaDatabaseLifecycleError(`${command} failed to execute`, { cause: result.error });
  }
  if (result.status !== 0) {
    throw new QaDatabaseLifecycleError(`${command} exited ${result.status}: ${result.stderr.trim()}`);
  }
  return result.stdout.trim();
}

function docker(args: readonly string[], timeout?: number): string {
  return run("docker", [...COMPOSE, ...args], timeout);
}

function prisma(args: readonly string[]): string {
  return run(process.execPath, ["node_modules/prisma/build/index.js", ...args]);
}

async function assertGeneration(): Promise<string | null> {
  if (!existsSync(GENERATION_PATH)) {
    return null;
  }
  const generation = readFileSync(GENERATION_PATH, "utf8").trim();
  if (process.env.QA_RESET_GENERATION !== generation) {
    throw new QaDatabaseLifecycleError("generation file differs from later child environment");
  }
  const prismaModule = await import("@prisma/client");
  const client = new prismaModule.PrismaClient();
  try {
    const setting = await client.setting.findUnique({ where: { key: "__qa_reset_generation" } });
    if (setting?.value !== generation) {
      throw new QaDatabaseLifecycleError("generation file differs from reserved Setting row");
    }
  } finally {
    await client.$disconnect();
  }
  return generation;
}

async function start(ownerToken: string): Promise<void> {
  assertOwner(ownerToken);
  assertFixedDatabaseEnvironment(process.env);
  docker(["up", "-d", "--wait", "--wait-timeout", "60", "db"], 90_000);
}

async function stop(ownerToken: string): Promise<void> {
  assertOwner(ownerToken);
  docker(["stop", "--timeout", "10", "db"], 30_000);
}

async function assertHealthy(ownerToken: string): Promise<string | null> {
  assertOwner(ownerToken);
  assertFixedDatabaseEnvironment(process.env);
  const binding = docker(["port", "db", "5432"]);
  if (binding !== "127.0.0.1:55432") {
    throw new QaDatabaseLifecycleError("PostgreSQL is not bound only to the fixed loopback port");
  }
  docker(["exec", "-T", "db", "pg_isready", "-U", "postgres", "-d", "surfing_ux_test"], 15_000);
  return assertGeneration();
}

async function push(ownerToken: string): Promise<void> {
  assertOwner(ownerToken);
  assertFixedDatabaseEnvironment(process.env);
  prisma(["generate"]);
  prisma(["db", "push", "--force-reset", "--skip-generate"]);
}

async function reset(ownerToken: string, evidenceDirectory: string): Promise<string> {
  assertOwner(ownerToken);
  await push(ownerToken);
  const generation = randomUUID();
  const prismaModule = await import("@prisma/client");
  const client = new prismaModule.PrismaClient();
  try {
    await client.setting.upsert({
      where: { key: "__qa_reset_generation" },
      create: { key: "__qa_reset_generation", value: generation },
      update: { value: generation },
    });
  } finally {
    await client.$disconnect();
  }
  mkdirSync(dirname(GENERATION_PATH), { recursive: true });
  const temporaryPath = `${GENERATION_PATH}.${process.pid}`;
  writeFileSync(temporaryPath, `${generation}\n`, { encoding: "utf8", mode: 0o600 });
  renameSync(temporaryPath, GENERATION_PATH);
  process.env.QA_RESET_GENERATION = generation;
  writeJsonEvidence(join(evidenceDirectory, "reset-receipt.json"), {
    generation: "generated-uuid",
    file: "present",
    setting: "present",
  });
  return generation;
}

async function down(ownerToken: string): Promise<void> {
  assertOwner(ownerToken);
  docker(["down", "--volumes", "--remove-orphans", "--timeout", "10"], 60_000);
  await cleanupQaResources();
}

export const db = { start, stop, assertHealthy, push, reset, down } as const;
