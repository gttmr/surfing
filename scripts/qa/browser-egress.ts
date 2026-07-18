import { join } from "node:path";
import type { BrowserContext } from "@playwright/test";
import { appendJsonEvidence } from "./evidence";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

export async function installBrowserEgressGuard(context: BrowserContext, evidenceDirectory: string): Promise<void> {
  const ledgerPath = join(evidenceDirectory, "browser-egress-ledger.jsonl");
  await context.route("**/*", async (route) => {
    const url = new URL(route.request().url());
    const port = Number(url.port || (url.protocol === "http:" ? "80" : "443"));
    const allowed = LOOPBACK_HOSTS.has(url.hostname) && port === 3100;
    appendJsonEvidence(ledgerPath, {
      protocol: "browser",
      host: url.hostname,
      port,
      outcome: allowed ? "allowed" : "blocked",
    });
    if (allowed) {
      await route.continue();
    } else {
      await route.abort("blockedbyclient");
    }
  });
}

export function recordBrowserOAuthLocation(evidenceDirectory: string): void {
  appendJsonEvidence(join(evidenceDirectory, "browser-egress-ledger.jsonl"), {
    protocol: "oauth-location",
    host: "external",
    outcome: "redirect-location-only",
  });
}
