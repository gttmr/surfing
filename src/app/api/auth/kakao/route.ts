import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const clientId = process.env.KAKAO_CLIENT_ID;
  const redirectUri = process.env.KAKAO_REDIRECT_URI?.trim() || new URL("/api/auth/kakao/callback", req.nextUrl.origin).toString();

  if (!clientId) {
    return NextResponse.json({ error: "카카오 앱이 설정되지 않았습니다" }, { status: 500 });
  }

  const returnTo = req.nextUrl.searchParams.get("returnTo") ?? "/";
  const force = req.nextUrl.searchParams.get("force") === "true";
  const state = encodeURIComponent(returnTo);

  const userAgent = req.headers.get("user-agent") ?? "";
  const isKakaoTalk = userAgent.includes("KAKAOTALK");
  const prompt = !force && isKakaoTalk ? "&prompt=none" : "";

  const kakaoUrl =
    `https://kauth.kakao.com/oauth/authorize` +
    `?client_id=${clientId}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&state=${state}` +
    prompt;

  return NextResponse.redirect(kakaoUrl);
}
