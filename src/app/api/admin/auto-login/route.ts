import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSessionFromRequest } from "@/lib/session";
import { setAdminCookie } from "@/lib/auth";

// 카카오 로그인된 ADMIN 역할 사용자는 비밀번호 없이 관리자 인증
export async function POST(req: NextRequest) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { kakaoId: session.kakaoId },
    select: { role: true },
  });

  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  const res = NextResponse.json({ ok: true });
  return setAdminCookie(res);
}
