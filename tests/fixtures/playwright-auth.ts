import type { Browser, BrowserContext, BrowserContextOptions } from "@playwright/test";
import { installBrowserEgressGuard, recordBrowserOAuthLocation } from "../../scripts/qa/browser-egress";
import { encodeSession, type SessionPayload } from "../../src/lib/session";

export const QA_AUTH_CONTEXT_KEYS = ["public", "member", "shop", "kakao-admin", "password-admin"] as const;

export type QaAuthContextKey = (typeof QA_AUTH_CONTEXT_KEYS)[number];

type QaAuthContext = {
  readonly persona: "P0" | "P1" | "P4" | "P6" | "P7";
  readonly payload: SessionPayload | null;
};

const QA_AUTH_CONTEXTS = {
  public: { persona: "P0", payload: null },
  member: { persona: "P1", payload: { kakaoId: "qa-user-01", nickname: "합성 회원 01" } },
  shop: { persona: "P4", payload: { kakaoId: "qa-user-04", nickname: "합성 회원 04" } },
  "kakao-admin": { persona: "P6", payload: { kakaoId: "qa-user-05", nickname: "합성 회원 05", adminAuthenticated: true } },
  "password-admin": { persona: "P7", payload: { adminAuthenticated: true } },
} as const satisfies Record<QaAuthContextKey, QaAuthContext>;

export class QaAuthContextError extends Error {
  readonly name = "QaAuthContextError";
}

export function isQaAuthContextKey(value: string): value is QaAuthContextKey {
  return Object.hasOwn(QA_AUTH_CONTEXTS, value);
}

export function qaSessionPayload(key: string): SessionPayload | null {
  if (!isQaAuthContextKey(key)) {
    throw new QaAuthContextError(`unknown QA auth context: ${key}`);
  }
  return QA_AUTH_CONTEXTS[key].payload;
}

export function qaStorageState(key: string): BrowserContextOptions["storageState"] {
  const payload = qaSessionPayload(key);
  if (payload === null) {
    return { cookies: [], origins: [] };
  }
  return {
    cookies: [{
      name: "__session",
      value: encodeSession(payload),
      domain: "127.0.0.1",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
      expires: -1,
    }],
    origins: [],
  };
}

export async function createQaBrowserContext(
  browser: Browser,
  key: string,
  evidenceDirectory: string
): Promise<BrowserContext> {
  const storageState = qaStorageState(key);
  const context = await browser.newContext({ storageState });
  await installBrowserEgressGuard(context, evidenceDirectory);
  return context;
}

export async function inspectQaOAuthRedirect(context: BrowserContext, evidenceDirectory: string): Promise<string> {
  const response = await context.request.get("http://127.0.0.1:3100/api/auth/kakao?returnTo=%2Fshop", {
    failOnStatusCode: false,
    maxRedirects: 0,
    timeout: 5_000,
  });
  const location = response.headers().location;
  if (response.status() !== 307 || !location) {
    throw new QaAuthContextError("QA OAuth endpoint did not return an unfollowed redirect");
  }
  const destination = new URL(location);
  const isExpected = destination.protocol === "https:"
    && destination.hostname === "kauth.kakao.com"
    && destination.pathname === "/oauth/authorize"
    && destination.searchParams.get("client_id") === "surfing-qa-kakao-client-id"
    && destination.searchParams.get("state") === "/shop";
  if (!isExpected) {
    throw new QaAuthContextError("QA OAuth redirect shape is unexpected");
  }
  recordBrowserOAuthLocation(evidenceDirectory);
  return `${destination.origin}${destination.pathname}`;
}
