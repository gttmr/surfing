import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { DEV_NEW_USER, isDevAuthEnabled, safeReturnTo } from "@/lib/dev-auth";
import { encodeSession, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";

// 로컬 개발 전용: 카카오 OAuth 없이 선택한 회원으로 세션 쿠키를 발급한다.
export async function POST(req: NextRequest) {
  if (!isDevAuthEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const form = await req.formData();
  const selected = String(form.get("kakaoId") ?? "");
  const returnTo = safeReturnTo(String(form.get("returnTo") ?? "/"));

  let kakaoId = selected;
  let nickname: string;
  let isNewUser = false;

  if (selected === DEV_NEW_USER) {
    // 카카오 첫 로그인과 같은 흐름(자동 가입 → 프로필 설정)을 재현한다.
    kakaoId = `dev-${randomBytes(4).toString("hex")}`;
    nickname = String(form.get("nickname") ?? "").trim() || "테스트 회원";
    await prisma.user.create({ data: { kakaoId, name: nickname, role: "MEMBER" } });
    isNewUser = true;
  } else {
    const user = await prisma.user.findUnique({ where: { kakaoId }, select: { name: true } });
    if (!user) {
      return NextResponse.json({ error: "회원을 찾을 수 없습니다" }, { status: 404 });
    }
    await prisma.deletedKakaoId.deleteMany({ where: { kakaoId } });
    nickname = user.name || "카카오 사용자";
  }

  const res = NextResponse.redirect(
    new URL(isNewUser ? "/profile?setup=true" : returnTo, req.nextUrl.origin),
    303,
  );
  res.cookies.set(SESSION_COOKIE, encodeSession({ kakaoId, nickname }), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
  return res;
}
