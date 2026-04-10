import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  decodeSession,
  encodeSession,
  getSessionPayload,
  getSessionPayloadFromRequest,
} from "@/lib/session";

export type UserRole = "ADMIN" | "MEMBER" | "BANNED" | "SHOP_OWNER";

export function canAccessShopPortalRole(role: string | null | undefined) {
  return role === "ADMIN" || role === "SHOP_OWNER";
}

function buildAdminSessionToken(payload: Awaited<ReturnType<typeof getSessionPayload>>) {
  return encodeSession({
    ...payload,
    adminAuthenticated: true,
  });
}

export async function isAdminAuthenticated(): Promise<boolean> {
  const session = await getSessionPayload();
  return !!session?.adminAuthenticated;
}

export async function getCurrentUserRole(): Promise<UserRole | null> {
  const session = await getSessionPayload();
  if (!session?.kakaoId) return null;

  const user = await prisma.user.findUnique({
    where: { kakaoId: session.kakaoId },
    select: { role: true },
  });

  return (user?.role as UserRole | undefined) ?? null;
}

export async function getCurrentUserRoleFromRequest(req: NextRequest): Promise<UserRole | null> {
  const session = getSessionPayloadFromRequest(req);
  if (!session?.kakaoId) return null;

  const user = await prisma.user.findUnique({
    where: { kakaoId: session.kakaoId },
    select: { role: true },
  });

  return (user?.role as UserRole | undefined) ?? null;
}

export async function canAccessShopPortal(): Promise<boolean> {
  return canAccessShopPortalRole(await getCurrentUserRole());
}

export async function canAccessShopPortalFromRequest(req: NextRequest): Promise<boolean> {
  return canAccessShopPortalRole(await getCurrentUserRoleFromRequest(req));
}

export async function setAdminCookie(response: Response): Promise<Response> {
  const session = await getSessionPayload();
  response.headers.set(
    "Set-Cookie",
    `${SESSION_COOKIE}=${buildAdminSessionToken(session)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}`
  );
  return response;
}

export async function clearAdminCookie(response: Response): Promise<Response> {
  const cookieStore = await cookies();
  const existingToken = cookieStore.get(SESSION_COOKIE)?.value;
  const payload = existingToken ? decodeSession(existingToken) : null;

  if (payload?.kakaoId && payload.nickname) {
    response.headers.set(
      "Set-Cookie",
      `${SESSION_COOKIE}=${encodeSession({
        kakaoId: payload.kakaoId,
        nickname: payload.nickname,
        profileImage: payload.profileImage,
      })}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}`
    );
    return response;
  }

  response.headers.set(
    "Set-Cookie",
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
  return response;
}
