import { cookies } from "next/headers";

const COOKIE_NAME = "admin_session";
const SESSION_VALUE = "authenticated";

export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  return cookieStore.get(COOKIE_NAME)?.value === SESSION_VALUE;
}

export function setAdminCookie(response: Response): Response {
  response.headers.set(
    "Set-Cookie",
    `${COOKIE_NAME}=${SESSION_VALUE}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400`
  );
  return response;
}

export function clearAdminCookie(response: Response): Response {
  response.headers.set(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
  );
  return response;
}
