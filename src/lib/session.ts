import { createHmac } from "crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";

const SECRET = process.env.SESSION_SECRET ?? "dev-secret-change-in-production";
const COOKIE_NAME = "__session";

export interface SessionUser {
  kakaoId: string;
  nickname: string;
  profileImage?: string;
}

export interface SessionPayload {
  adminAuthenticated?: boolean;
  kakaoId?: string;
  nickname?: string;
  profileImage?: string;
}

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function encodeSession(payloadData: SessionPayload): string {
  const payload = Buffer.from(JSON.stringify(payloadData)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(token: string): SessionPayload | null {
  try {
    const dot = token.lastIndexOf(".");
    if (dot === -1) return null;
    const payload = token.slice(0, dot);
    const sig = token.slice(dot + 1);
    if (sign(payload) !== sig) return null;
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as SessionPayload;
  } catch {
    return null;
  }
}

export function toSessionUser(payload: SessionPayload | null): SessionUser | null {
  if (!payload?.kakaoId || !payload.nickname) return null;
  return {
    kakaoId: payload.kakaoId,
    nickname: payload.nickname,
    profileImage: payload.profileImage,
  };
}

/** Server Component / Server Action에서 사용 */
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  return token ? toSessionUser(decodeSession(token)) : null;
}

/** Route Handler에서 사용 */
export function getSessionFromRequest(req: NextRequest): SessionUser | null {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  return token ? toSessionUser(decodeSession(token)) : null;
}

export async function getSessionPayload(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  return token ? decodeSession(token) : null;
}

export function getSessionPayloadFromRequest(req: NextRequest): SessionPayload | null {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  return token ? decodeSession(token) : null;
}

export const SESSION_COOKIE = COOKIE_NAME;
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7일
