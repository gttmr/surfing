// 로컬 개발 전용 카카오 로그인 우회.
// `next dev` + DEV_AUTH_BYPASS=1 + 로컬(loopback) DB 일 때만 켜진다.
// Vercel 배포나 운영 DB 연결에서는 어떤 경우에도 꺼진다.

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "[::1]"]);

export const DEV_NEW_USER = "__new__";

export function isLoopbackDatabaseUrl(databaseUrl: string | undefined): boolean {
  if (!databaseUrl) return false;
  try {
    return LOOPBACK_HOSTS.has(new URL(databaseUrl).hostname);
  } catch {
    return false;
  }
}

export function isDevAuthEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return (
    env.NODE_ENV === "development" &&
    !env.VERCEL &&
    env.DEV_AUTH_BYPASS === "1" &&
    isLoopbackDatabaseUrl(env.DATABASE_URL)
  );
}

/** 오픈 리다이렉트 방지: 같은 사이트 내부 경로만 허용 */
export function safeReturnTo(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return "/";
  }
  return value;
}
