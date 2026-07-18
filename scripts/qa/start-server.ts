import { spawn, type ChildProcess } from "node:child_process";
import { QA_HOST } from "./assert-local-test-db";
import { guardedNodeArguments } from "./child-process-egress";
import { registerTaskProcess } from "./process-registry";

export class QaServerError extends Error {
  readonly name = "QaServerError";
}

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

export async function runQaServer(): Promise<number> {
  const child = spawn(process.execPath, guardedNodeArguments([
    "node_modules/next/dist/bin/next",
    "start",
    "-H",
    QA_HOST,
    "-p",
    "3100",
  ]), { cwd: process.cwd(), env: process.env, shell: false, stdio: "inherit" });
  if (child.pid === undefined) {
    throw new QaServerError("QA server process did not expose a pid");
  }
  const unregister = registerTaskProcess("server", child.pid);
  child.once("exit", unregister);
  const terminate = (signal: NodeJS.Signals) => child.kill(signal);
  process.on("SIGINT", terminate);
  process.on("SIGTERM", terminate);
  try {
    await waitForReady(child);
    process.stdout.write("QA server ready on loopback port 3100\n");
    return await new Promise<number>((resolveExit, reject) => {
      child.once("error", reject);
      child.once("exit", (code) => resolveExit(code ?? 1));
    });
  } finally {
    process.off("SIGINT", terminate);
    process.off("SIGTERM", terminate);
    if (child.exitCode === null) {
      child.kill("SIGTERM");
    }
  }
}
