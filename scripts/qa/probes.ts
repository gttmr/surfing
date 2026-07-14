import childProcess from "node:child_process";
import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EMPTY_DANGEROUS_KEYS } from "./environment";
import { EgressBlockedError } from "./process-egress-guard";

export class QaProbeError extends Error {
  readonly name = "QaProbeError";
}

async function expectBlocked(action: () => unknown | Promise<unknown>, name: string): Promise<void> {
  try {
    await action();
  } catch (error) {
    if (error instanceof EgressBlockedError) {
      return;
    }
    throw error;
  }
  throw new QaProbeError(`${name} egress probe unexpectedly succeeded`);
}

export function probeEnvironment(evidenceDirectory: string): void {
  if (process.env.SURFING_QA_FORBIDDEN_SAMPLE !== undefined) {
    throw new QaProbeError("non-allowlisted operating system environment key survived reconstruction");
  }
  for (const key of EMPTY_DANGEROUS_KEYS) {
    if (process.env[key] !== "") {
      throw new QaProbeError(`dangerous environment key is not explicitly empty: ${key}`);
    }
  }
  const receipt: unknown = JSON.parse(readFileSync(join(evidenceDirectory, "env-receipt.json"), "utf8"));
  const serialized = JSON.stringify(receipt);
  if (/postgresql:|surfing-qa-session|surfing-qa-admin|kakao-client-id/.test(serialized)) {
    throw new QaProbeError("environment receipt contains a value instead of classifications");
  }
}

export async function probeEgress(): Promise<void> {
  await expectBlocked(() => dns.lookup("external.invalid", () => undefined), "dns callback");
  await expectBlocked(() => dns.resolve("external.invalid", () => undefined), "dns resolve callback");
  await expectBlocked(() => dns.promises.lookup("external.invalid"), "dns");
  await expectBlocked(() => net.connect({ host: "203.0.113.1", port: 443 }), "socket");
  await expectBlocked(() => net.createConnection({ host: "203.0.113.1", port: 443 }), "connection");
  await expectBlocked(() => new net.Socket().connect({ host: "203.0.113.1", port: 443 }), "socket prototype");
  await expectBlocked(() => tls.connect({ host: "203.0.113.1", port: 443 }), "TLS");
  await expectBlocked(() => fetch("https://external.invalid/qa"), "fetch");
  await expectBlocked(() => http.get("http://external.invalid/qa"), "http");
  await expectBlocked(() => https.get("https://external.invalid/qa"), "HTTPS");
  await expectBlocked(() => childProcess.spawnSync("curl", ["https://external.invalid/qa"]), "child process");
  await expectBlocked(() => childProcess.execSync("true"), "shell child process");
  const undici = await import("undici");
  await expectBlocked(() => undici.request("https://external.invalid/qa"), "undici");
}

export async function holdOwnerLock(): Promise<void> {
  process.stdout.write("QA_PROBE_READY\n");
  await new Promise<void>((resolve, reject) => {
    const finish = () => {
      clearTimeout(timer);
      process.off("SIGINT", finish);
      process.off("SIGTERM", finish);
      resolve();
    };
    const timer = setTimeout(() => {
      process.off("SIGINT", finish);
      process.off("SIGTERM", finish);
      reject(new QaProbeError("owner lock probe reached its bounded timeout"));
    }, 15_000);
    process.once("SIGINT", finish);
    process.once("SIGTERM", finish);
  });
}
