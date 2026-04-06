import { cookies } from "next/headers";
import {
  SESSION_COOKIE,
  SESSION_MAX_AGE,
  decodeSession,
  encodeSession,
  getSessionPayload,
} from "@/lib/session";

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
