import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";
import { getSession, getSessionFromRequest, type SessionUser } from "@/lib/session";

async function isSessionUserActive(kakaoId: string) {
  const [deleted, user] = await Promise.all([
    prisma.deletedKakaoId.findUnique({
      where: { kakaoId },
      select: { id: true },
    }),
    prisma.user.findUnique({
      where: { kakaoId },
      select: { id: true },
    }),
  ]);

  return !deleted && !!user;
}

export async function getActiveSession(): Promise<SessionUser | null> {
  const session = await getSession();
  if (!session) return null;
  return (await isSessionUserActive(session.kakaoId)) ? session : null;
}

export async function getActiveSessionFromRequest(req: NextRequest): Promise<SessionUser | null> {
  const session = getSessionFromRequest(req);
  if (!session) return null;
  return (await isSessionUserActive(session.kakaoId)) ? session : null;
}
