import { NextRequest, NextResponse } from "next/server";
import { getSessionPayloadFromRequest } from "@/lib/session";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const session = getSessionPayloadFromRequest(request);

  if (pathname.startsWith("/admin") && pathname !== "/admin/login") {
    if (!session?.adminAuthenticated) {
      return NextResponse.redirect(new URL("/admin/login", request.url));
    }
  }

  if (pathname.startsWith("/shop")) {
    if (!session?.kakaoId) {
      const returnTo = `${pathname}${search}`;
      return NextResponse.redirect(
        new URL(`/api/auth/kakao?returnTo=${encodeURIComponent(returnTo)}`, request.url)
      );
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/shop/:path*"],
};
