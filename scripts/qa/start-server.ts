import { spawn, type ChildProcess } from "node:child_process";
import { QA_HOST } from "./assert-local-test-db";
import { guardedNodeArguments } from "./child-process-egress";
import { registerTaskProcess } from "./process-registry";

export class QaServerError extends Error {
  readonly name = "QaServerError";
}

export type QaServerHandle = {
  readonly stop: () => Promise<void>;
  readonly wait: () => Promise<number>;
};

async function waitForReady(child: ChildProcess): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (child.exitCode !== null) {
      throw new QaServerError(`QA server exited before readiness with code ${child.exitCode}`);
    }
    try {
      const response = await fetch("http://127.0.0.1:3100/", {
        redirect: "manual",
        signal: AbortSignal.timeout(500),
      });
      if (response.status > 0) {
        return;
      }
    } catch (error) {
      if (!(error instanceof TypeError || error instanceof DOMException)) {
        throw error;
      }
    }
    await new Promise<void>((resolveWait) => setTimeout(resolveWait, 250));
  }
  throw new QaServerError("QA server readiness timed out");
}

function waitForExit(child: ChildProcess): Promise<number> {
  if (child.exitCode !== null) return Promise.resolve(child.exitCode);
  return new Promise<number>((resolveExit, reject) => {
    child.once("error", reject);
    child.once("exit", (code) => resolveExit(code ?? 1));
  });
}

export async function startQaServer(environment: NodeJS.ProcessEnv = process.env): Promise<QaServerHandle> {
  const child = spawn(process.execPath, guardedNodeArguments([
    "node_modules/next/dist/bin/next",
    "start",
    "-H",
    QA_HOST,
    "-p",
    "3100",
  ]), { cwd: process.cwd(), env: environment, shell: false, stdio: "inherit" });
  if (child.pid === undefined) {
    throw new QaServerError("QA server process did not expose a pid");
  }
  const unregister = registerTaskProcess("server", child.pid);
  child.once("exit", unregister);
  try {
    await waitForReady(child);
    process.stdout.write("QA server ready on loopback port 3100\n");
  } catch (error) {
    if (child.exitCode === null) {
      child.kill("SIGTERM");
    }
    await waitForExit(child).catch(() => undefined);
    throw error;
  }

  return {
    wait: () => waitForExit(child),
    stop: async () => {
      if (child.exitCode === null) child.kill("SIGTERM");
      await waitForExit(child);
    },
  };
}

export async function runQaServer(): Promise<number> {
  const server = await startQaServer({ ...process.env, NODE_ENV: "production" });
  const terminate = (signal: NodeJS.Signals) => {
    void server.stop();
    if (signal === "SIGINT") process.exitCode = 130;
    if (signal === "SIGTERM") process.exitCode = 143;
  };
  process.on("SIGINT", terminate);
  process.on("SIGTERM", terminate);
  try {
    return await server.wait();
  } finally {
    process.off("SIGINT", terminate);
    process.off("SIGTERM", terminate);
    await server.stop();
  }
}
