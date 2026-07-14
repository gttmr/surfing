import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { FIXED_DATABASE_URL } from "./assert-local-test-db";
import { writeJsonEvidence } from "./evidence";
import type { QaTarget } from "./targets";

const FIXED_VALUES = {
  DATABASE_URL: FIXED_DATABASE_URL,
  DIRECT_URL: FIXED_DATABASE_URL,
  SESSION_SECRET: "surfing-qa-session-secret-not-production",
  ADMIN_PASSWORD: "surfing-qa-admin-password",
  KAKAO_CLIENT_ID: "surfing-qa-kakao-client-id",
  KAKAO_REDIRECT_URI: "http://127.0.0.1:3100/api/auth/kakao/callback",
  NEXT_PUBLIC_SITE_URL: "http://127.0.0.1:3100",
  PORT: "3100",
  NEXT_TELEMETRY_DISABLED: "1",
} as const;

export const EMPTY_DANGEROUS_KEYS = [
  "KAKAO_CLIENT_SECRET",
  "NEXT_PUBLIC_KAKAO_JS_KEY",
  "GCS_PROFILE_IMAGE_BUCKET",
  "GOOGLE_APPLICATION_CREDENTIALS",
  "GOOGLE_CLOUD_PROJECT",
  "GCLOUD_PROJECT",
  "BLOB_READ_WRITE_TOKEN",
  "VERCEL",
  "VERCEL_ENV",
  "VERCEL_OIDC_TOKEN",
  "HTTP_PROXY",
  "HTTPS_PROXY",
  "ALL_PROXY",
  "NO_PROXY",
] as const;

const ALLOWED_OS_KEYS = ["PATH", "HOME", "TMPDIR", "TMP", "TEMP", "LANG", "TZ", "CI", "TERM"] as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type EnvironmentInput = {
  readonly target: QaTarget;
  readonly evidenceDirectory: string;
  readonly ownerToken: string | null;
};

type ReceiptRow = {
  readonly key: string;
  readonly classification: "empty" | "fixed" | "generated";
};

function readGeneration(): string {
  const path = ".tmp/qa/generation";
  if (!existsSync(path)) {
    return "";
  }
  const generation = readFileSync(path, "utf8").trim();
  if (!UUID_PATTERN.test(generation)) {
    throw new Error("stale QA reset generation file is invalid");
  }
  const inherited = process.env.QA_RESET_GENERATION;
  if (inherited && inherited !== generation) {
    throw new Error("stale QA reset generation does not match the owner file");
  }
  return generation;
}

function copyAllowedOperatingSystemValues(env: NodeJS.ProcessEnv, receipt: ReceiptRow[]): void {
  for (const key of ALLOWED_OS_KEYS) {
    const value = process.env[key];
    if (value !== undefined) {
      env[key] = value;
      receipt.push({ key, classification: "fixed" });
    }
  }
  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith("LC_") && value !== undefined) {
      env[key] = value;
      receipt.push({ key, classification: "fixed" });
    }
  }
}

export function buildChildEnvironment(input: EnvironmentInput): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { NODE_ENV: input.target.nodeEnvironment };
  const receipt: ReceiptRow[] = [{ key: "NODE_ENV", classification: "generated" }];
  copyAllowedOperatingSystemValues(env, receipt);

  for (const [key, value] of Object.entries(FIXED_VALUES)) {
    env[key] = value;
    receipt.push({ key, classification: "fixed" });
  }
  for (const key of EMPTY_DANGEROUS_KEYS) {
    env[key] = "";
    receipt.push({ key, classification: "empty" });
  }

  env.EVIDENCE_DIR = input.evidenceDirectory;
  env.QA_RESET_GENERATION = readGeneration();
  env.SURFING_QA_ALLOWED_EXECUTABLES = input.target.allowedExecutables.join(",");
  if (input.ownerToken) {
    env.SURFING_QA_OWNER_TOKEN = input.ownerToken;
  }

  for (const key of ["EVIDENCE_DIR", "QA_RESET_GENERATION", "SURFING_QA_ALLOWED_EXECUTABLES", "SURFING_QA_OWNER_TOKEN"] as const) {
    if (env[key] !== undefined) {
      receipt.push({ key, classification: "generated" });
    }
  }
  receipt.sort((left, right) => left.key.localeCompare(right.key));
  writeJsonEvidence(join(input.evidenceDirectory, "env-receipt.json"), { keys: receipt });
  return env;
}
