export const FIXED_DATABASE_URL = "postgresql://postgres:postgres@127.0.0.1:55432/surfing_ux_test";
export const QA_HOST = "127.0.0.1";
export const QA_DATABASE_PORT = 55432;
export const QA_APP_PORT = 3100;

export class QaDatabaseRefusalError extends Error {
  readonly name = "QaDatabaseRefusalError";
}

export function assertLocalTestDatabaseUrl(candidate: string): void {
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch (error) {
    throw new QaDatabaseRefusalError("refused database candidate: malformed URL", { cause: error });
  }

  const valid = parsed.protocol === "postgresql:"
    && parsed.hostname === QA_HOST
    && parsed.port === String(QA_DATABASE_PORT)
    && parsed.pathname.endsWith("_test")
    && parsed.pathname === "/surfing_ux_test";
  if (!valid) {
    throw new QaDatabaseRefusalError("refused database candidate: expected fixed loopback test database");
  }
}

export function assertFixedDatabaseEnvironment(env: NodeJS.ProcessEnv): void {
  assertLocalTestDatabaseUrl(env.DATABASE_URL ?? "");
  if (env.DATABASE_URL !== FIXED_DATABASE_URL || env.DIRECT_URL !== FIXED_DATABASE_URL) {
    throw new QaDatabaseRefusalError("refused database candidate: fixed database URLs differ");
  }
}
