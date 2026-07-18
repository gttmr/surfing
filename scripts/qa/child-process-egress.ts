import childProcess from "node:child_process";
import { basename, resolve } from "node:path";
import { createPrivateCapability } from "./private-capability";
import { registerTaskProcess } from "./process-registry";
import { EgressBlockedError } from "./egress-error";

type Outcome = "allowed" | "blocked";
type RecordRow = (row: {
  readonly protocol: string;
  readonly basename: string;
  readonly outcome: Outcome;
}) => void;

const BROWSER_EXECUTABLES = new Set(["chrome", "chromium", "chrome-headless-shell", "chrome_crashpad_handler"]);

function trackBrowserProcess(executable: string, result: unknown): void {
  if (!BROWSER_EXECUTABLES.has(executable) || typeof result !== "object" || result === null) {
    return;
  }
  const pid = Reflect.get(result, "pid");
  const once = Reflect.get(result, "once");
  if (typeof pid !== "number" || typeof once !== "function") {
    return;
  }
  const unregister = registerTaskProcess("browser", pid);
  Reflect.apply(once, result, ["exit", unregister]);
}

function executableAllowed(command: string, allowedExecutables: ReadonlySet<string>, record: RecordRow): string {
  const executable = basename(command);
  const outcome = allowedExecutables.has(executable) ? "allowed" : "blocked";
  record({ protocol: "child-process", basename: executable, outcome });
  if (outcome === "blocked") {
    throw new EgressBlockedError(`blocked child process executable ${executable}`);
  }
  return executable;
}

function commandArguments(value: unknown): readonly string[] | null {
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    return null;
  }
  return value;
}

function optionsRecord(value: unknown): object {
  return typeof value === "object" && value !== null ? value : {};
}

function stdioWithCapability(value: unknown, authDescriptor: number, guardDescriptor: number): readonly unknown[] {
  if (Array.isArray(value)) {
    return [value[0] ?? "pipe", value[1] ?? "pipe", value[2] ?? "pipe", authDescriptor, guardDescriptor];
  }
  const standard = typeof value === "string" ? value : "pipe";
  return [standard, standard, standard, authDescriptor, guardDescriptor];
}

export const QA_GUARD_BOOTSTRAP = resolve("scripts/qa/process-egress-bootstrap.mjs");

export function guardedNodeArguments(args: readonly string[]): readonly string[] {
  if (args.includes(QA_GUARD_BOOTSTRAP)) {
    return args;
  }
  return ["--import", QA_GUARD_BOOTSTRAP, ...args];
}

function guardedNodeCall(rest: readonly unknown[]): {
  readonly args: readonly unknown[];
  close(): void;
} {
  const nodeArgs = commandArguments(rest[0]);
  if (!nodeArgs) {
    throw new EgressBlockedError("blocked Node child without an explicit argument array");
  }
  const capability = createPrivateCapability();
  const options = optionsRecord(rest[1]);
  return {
    args: [
      guardedNodeArguments(nodeArgs),
      { ...options, stdio: stdioWithCapability(Reflect.get(options, "stdio"), capability.authDescriptor, capability.guardDescriptor) },
      ...rest.slice(2),
    ],
    close: capability.close,
  };
}

function guardedForkCall(rest: readonly unknown[]): {
  readonly args: readonly unknown[];
  close(): void;
} {
  const moduleArgs = commandArguments(rest[0]);
  const optionsIndex = moduleArgs ? 1 : 0;
  const options = optionsRecord(rest[optionsIndex]);
  const execArgvValue = Reflect.get(options, "execArgv");
  const execArgv = commandArguments(execArgvValue) ?? process.execArgv;
  const capability = createPrivateCapability();
  const guardedOptions = {
    ...options,
    execArgv: guardedNodeArguments(execArgv),
    silent: false,
    stdio: ["inherit", "inherit", "inherit", capability.authDescriptor, capability.guardDescriptor, "ipc"],
  };
  return {
    args: moduleArgs ? [moduleArgs, guardedOptions] : [guardedOptions],
    close: capability.close,
  };
}

export function installChildProcessGuard(allowedExecutables: ReadonlySet<string>, record: RecordRow): void {
  for (const key of ["spawn", "spawnSync", "execFile", "execFileSync"] as const) {
    const original = childProcess[key];
    Object.defineProperty(childProcess, key, { configurable: true, value(command: string, ...rest: unknown[]) {
      const executable = executableAllowed(command, allowedExecutables, record);
      if (executable !== basename(process.execPath)) {
        const result: unknown = Reflect.apply(original, childProcess, [command, ...rest]);
        if (key === "spawn") {
          trackBrowserProcess(executable, result);
        }
        return result;
      }
      const guarded = guardedNodeCall(rest);
      try {
        return Reflect.apply(original, childProcess, [command, ...guarded.args]);
      } finally {
        guarded.close();
      }
    } });
  }
  for (const key of ["exec", "execSync"] as const) {
    Object.defineProperty(childProcess, key, { configurable: true, value() {
      record({ protocol: "child-process-shell", basename: "shell", outcome: "blocked" });
      throw new EgressBlockedError("blocked shell child process");
    } });
  }
  const originalFork = childProcess.fork;
  Object.defineProperty(childProcess, "fork", { configurable: true, value(modulePath: string, ...rest: unknown[]) {
    executableAllowed(process.execPath, allowedExecutables, record);
    const guarded = guardedForkCall(rest);
    try {
      return Reflect.apply(originalFork, childProcess, [modulePath, ...guarded.args]);
    } finally {
      guarded.close();
    }
  } });
}
