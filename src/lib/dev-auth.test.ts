import assert from "node:assert/strict";
import test from "node:test";
import { isDevAuthEnabled, safeReturnTo } from "@/lib/dev-auth";

const LOCAL_DB = "postgresql://postgres@127.0.0.1:54329/surfing_dev";

function env(overrides: Record<string, string | undefined>): NodeJS.ProcessEnv {
  return { NODE_ENV: "development", DEV_AUTH_BYPASS: "1", DATABASE_URL: LOCAL_DB, ...overrides } as NodeJS.ProcessEnv;
}

test("dev auth bypass is enabled only for next dev with a loopback database", () => {
  assert.equal(isDevAuthEnabled(env({})), true);
  assert.equal(isDevAuthEnabled(env({ DATABASE_URL: "postgresql://postgres@localhost:5432/x" })), true);
});

test("dev auth bypass refuses production, Vercel, remote databases and missing opt-in", () => {
  assert.equal(isDevAuthEnabled(env({ NODE_ENV: "production" })), false);
  assert.equal(isDevAuthEnabled(env({ NODE_ENV: "test" })), false);
  assert.equal(isDevAuthEnabled(env({ VERCEL: "1" })), false);
  assert.equal(isDevAuthEnabled(env({ DEV_AUTH_BYPASS: undefined })), false);
  assert.equal(isDevAuthEnabled(env({ DEV_AUTH_BYPASS: "true" })), false);
  assert.equal(
    isDevAuthEnabled(env({ DATABASE_URL: "postgresql://u:p@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres" })),
    false,
  );
  assert.equal(isDevAuthEnabled(env({ DATABASE_URL: undefined })), false);
  assert.equal(isDevAuthEnabled(env({ DATABASE_URL: "not a url" })), false);
});

test("dev login return paths stay on the same site", () => {
  assert.equal(safeReturnTo("/profile?setup=true"), "/profile?setup=true");
  assert.equal(safeReturnTo(null), "/");
  assert.equal(safeReturnTo("https://evil.example"), "/");
  assert.equal(safeReturnTo("//evil.example"), "/");
  assert.equal(safeReturnTo("/\\evil.example"), "/");
});
