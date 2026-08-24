import dns from "node:dns";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import tls from "node:tls";
import { syncBuiltinESMExports } from "node:module";
import { createRequire } from "node:module";
import { join } from "node:path";
import { appendJsonEvidence } from "./evidence";
import { installChildProcessGuard } from "./child-process-egress";
import { installGuardCapability } from "./private-capability";
import { EgressBlockedError } from "./egress-error";
export { EgressBlockedError } from "./egress-error";

type Outcome = "allowed" | "blocked" | "redirect-location-only";
type LedgerRow = {
  readonly protocol: string;
  readonly host?: string;
  readonly basename?: string;
  readonly port?: number;
  readonly outcome: Outcome;
};

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const evidenceDirectory = process.env.EVIDENCE_DIR ?? "";
const ledgerPath = join(evidenceDirectory, "server-egress-ledger.jsonl");
const allowedExecutables = new Set((process.env.SURFING_QA_ALLOWED_EXECUTABLES ?? "").split(",").filter(Boolean));

function record(row: LedgerRow): void {
  if (evidenceDirectory) {
    appendJsonEvidence(ledgerPath, row);
  }
}

function networkAllowed(host: string, port: number): boolean {
  return LOOPBACK_HOSTS.has(host) && Number.isInteger(port) && port > 0 && port <= 65_535;
}

function guardNetwork(protocol: string, host: string, port: number): void {
  const outcome = networkAllowed(host, port) ? "allowed" : "blocked";
  record({ protocol, host, port, outcome });
  if (outcome === "blocked") {
    throw new EgressBlockedError(`blocked ${protocol} egress to ${host}:${port}`);
  }
}

function guardDns(protocol: string, host: string): void {
  const outcome = LOOPBACK_HOSTS.has(host) ? "allowed" : "blocked";
  record({ protocol, host, outcome });
  if (outcome === "blocked") {
    throw new EgressBlockedError(`blocked DNS egress for ${host}`);
  }
}

function numericPort(value: unknown, fallback: number): number {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return Number(value);
  }
  return fallback;
}

function socketTarget(args: readonly unknown[]): { readonly host: string; readonly port: number } {
  const first = args[0];
  if (Array.isArray(first)) {
    return socketTarget(first);
  }
  if (typeof first === "number") {
    return { host: typeof args[1] === "string" ? args[1] : "localhost", port: first };
  }
  if (typeof first === "object" && first !== null) {
    const host = "host" in first && typeof first.host === "string" ? first.host : "localhost";
    const port = "port" in first ? numericPort(first.port, 0) : 0;
    return { host, port };
  }
  return { host: "", port: 0 };
}

function requestTarget(input: unknown, defaultPort: number): { readonly host: string; readonly port: number } {
  if (typeof input === "string" || input instanceof URL) {
    const url = new URL(input.toString());
    return { host: url.hostname, port: numericPort(url.port, defaultPort) };
  }
  if (typeof input === "object" && input !== null) {
    const hostValue = "hostname" in input ? input.hostname : "host" in input ? input.host : "";
    const host = typeof hostValue === "string" ? hostValue.split(":")[0] ?? "" : "";
    const port = "port" in input ? numericPort(input.port, defaultPort) : defaultPort;
    return { host, port };
  }
  return { host: "", port: defaultPort };
}

function installDnsGuard(): void {
  const originalLookup = dns.lookup.bind(dns);
  const originalResolve = dns.resolve.bind(dns);
  Object.defineProperty(dns, "lookup", { configurable: true, value(host: string, ...args: unknown[]) {
    guardDns("dns.lookup", host);
    return Reflect.apply(originalLookup, dns, [host, ...args]);
  } });
  Object.defineProperty(dns, "resolve", { configurable: true, value(host: string, ...args: unknown[]) {
    guardDns("dns.resolve", host);
    return Reflect.apply(originalResolve, dns, [host, ...args]);
  } });
  const originalPromiseLookup = dns.promises.lookup.bind(dns.promises);
  const originalPromiseResolve = dns.promises.resolve.bind(dns.promises);
  Object.defineProperty(dns.promises, "lookup", { configurable: true, value(host: string, ...args: unknown[]) {
    guardDns("dns.promises.lookup", host);
    return Reflect.apply(originalPromiseLookup, dns.promises, [host, ...args]);
  } });
  Object.defineProperty(dns.promises, "resolve", { configurable: true, value(host: string, ...args: unknown[]) {
    guardDns("dns.promises.resolve", host);
    return Reflect.apply(originalPromiseResolve, dns.promises, [host, ...args]);
  } });
}

function installSocketGuard(): void {
  const originalNetConnect = net.connect.bind(net);
  const originalCreateConnection = net.createConnection.bind(net);
  const originalSocketConnect = net.Socket.prototype.connect;
  const originalTlsConnect = tls.connect.bind(tls);
  Object.defineProperty(net, "connect", { configurable: true, value(...args: unknown[]) {
    const target = socketTarget(args);
    guardNetwork("net.connect", target.host, target.port);
    return Reflect.apply(originalNetConnect, net, args);
  } });
  Object.defineProperty(net, "createConnection", { configurable: true, value(...args: unknown[]) {
    const target = socketTarget(args);
    guardNetwork("net.createConnection", target.host, target.port);
    return Reflect.apply(originalCreateConnection, net, args);
  } });
  Object.defineProperty(net.Socket.prototype, "connect", { configurable: true, value(...args: unknown[]) {
    const target = socketTarget(args);
    guardNetwork("net.Socket.connect", target.host, target.port);
    return Reflect.apply(originalSocketConnect, this, args);
  } });
  Object.defineProperty(tls, "connect", { configurable: true, value(...args: unknown[]) {
    const target = socketTarget(args);
    guardNetwork("tls.connect", target.host, target.port);
    return Reflect.apply(originalTlsConnect, tls, args);
  } });
}

function installHttpModuleGuard(module: typeof http | typeof https, protocol: "http" | "https", defaultPort: number): void {
  const originalRequest = module.request.bind(module);
  const originalGet = module.get.bind(module);
  Object.defineProperty(module, "request", { configurable: true, value(...args: unknown[]) {
    const target = requestTarget(args[0], defaultPort);
    guardNetwork(`${protocol}.request`, target.host, target.port);
    return Reflect.apply(originalRequest, module, args);
  } });
  Object.defineProperty(module, "get", { configurable: true, value(...args: unknown[]) {
    const target = requestTarget(args[0], defaultPort);
    guardNetwork(`${protocol}.get`, target.host, target.port);
    return Reflect.apply(originalGet, module, args);
  } });
}

function installFetchGuard(): void {
  const originalFetch = globalThis.fetch.bind(globalThis);
  Object.defineProperty(globalThis, "fetch", { configurable: true, value(input: string | URL | Request, init?: RequestInit) {
    const target = requestTarget(input instanceof Request ? input.url : input, 443);
    guardNetwork("fetch", target.host, target.port);
    return originalFetch(input, init);
  } });
}

function installUndiciGuard(): void {
  const require = createRequire(import.meta.url);
  const moduleValue: unknown = require("undici");
  if (typeof moduleValue !== "object" || moduleValue === null) {
    return;
  }
  for (const key of ["fetch", "request"] as const) {
    const original: unknown = Reflect.get(moduleValue, key);
    if (typeof original !== "function") {
      continue;
    }
    Object.defineProperty(moduleValue, key, { configurable: true, value(input: unknown, ...args: unknown[]) {
      const target = requestTarget(input, 443);
      guardNetwork(`undici.${key}`, target.host, target.port);
      return Reflect.apply(original, moduleValue, [input, ...args]);
    } });
  }
}

export function recordRedirectLocationOnly(): void {
  record({ protocol: "oauth-location", host: "external", outcome: "redirect-location-only" });
}

installGuardCapability();
installDnsGuard();
installSocketGuard();
installHttpModuleGuard(http, "http", 80);
installHttpModuleGuard(https, "https", 443);
installFetchGuard();
installUndiciGuard();
installChildProcessGuard(allowedExecutables, record);
syncBuiltinESMExports();
