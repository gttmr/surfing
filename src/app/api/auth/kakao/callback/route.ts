import { NextRequest, NextResponse } from "next/server";
import { encodeSession, SESSION_COOKIE, SESSION_MAX_AGE } from "@/lib/session";
import { prisma } from "@/lib/db";

function getKakaoRedirectUri(req: NextRequest) {
  const configured = process.env.KAKAO_REDIRECT_URI?.trim();
  if (configured) {
    return configured;
  }

  const isLocal =
    req.nextUrl.hostname === "localhost" ||
    req.nextUrl.hostname === "127.0.0.1";

  if (isLocal) {
    return new URL("/api/auth/kakao/callback", req.nextUrl.origin).toString();
  }

  return new URL("/api/auth/kakao/callback", req.nextUrl.origin).toString();
}

function getAuthOrigin(req: NextRequest) {
  const configured = process.env.KAKAO_REDIRECT_URI?.trim();
  if (configured) {
    return new URL(configured).origin;
  }

  const isLocal =
    req.nextUrl.hostname === "localhost" ||
    req.nextUrl.hostname === "127.0.0.1";

  if (isLocal) {
    return req.nextUrl.origin;
  }

  return new URL(getKakaoRedirectUri(req)).origin;
}

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const errorParam = req.nextUrl.searchParams.get("error");
  const errorDescription = req.nextUrl.searchParams.get("error_description");
  const returnTo = state ? decodeURIComponent(state) : "/";
  const redirectUri = getKakaoRedirectUri(req);
  const authOrigin = getAuthOrigin(req);

  if (errorParam) {
    if (errorParam === "consent_required" || errorParam === "interaction_required") {
      const fallbackUrl = `/api/auth/kakao?returnTo=${encodeURIComponent(returnTo)}&force=true`;
      return NextResponse.redirect(new URL(fallbackUrl, authOrigin));
    }
    console.error(`Kakao OAuth Error: ${errorParam} - ${errorDescription}`);
    return NextResponse.redirect(new URL(`${returnTo}?auth_error=${errorParam}`, authOrigin));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/", authOrigin));
  }

  // 1) 인가 코드 → 액세스 토큰 교환
  const params = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: process.env.KAKAO_CLIENT_ID!,
    redirect_uri: redirectUri,
    code,
  });
  if (process.env.KAKAO_CLIENT_SECRET) {
    params.set("client_secret", process.env.KAKAO_CLIENT_SECRET);
  }

  const tokenRes = await fetch("https://kauth.kakao.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded;charset=utf-8" },
    body: params.toString(),
  });

  const tokenText = await tokenRes.text();
  let tokenData;
  try {
    tokenData = JSON.parse(tokenText || "{}");
  } catch {
    console.error("Kakao Token Parsing Error:", tokenText);
    return NextResponse.redirect(new URL(`${returnTo}?auth_error=token_parse_failed`, authOrigin));
  }

  if (!tokenData.access_token) {
    console.error("No access token. Data:", JSON.stringify(tokenData));
    return NextResponse.redirect(new URL(`${returnTo}?auth_error=token`, authOrigin));
  }

  // 2) 사용자 정보 조회
  const userRes = await fetch("https://kapi.kakao.com/v2/user/me", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  const userText = await userRes.text();
  let userData;
  try {
    userData = JSON.parse(userText || "{}");
  } catch {
    console.error("Kakao User Parsing Error. Raw response:", userText);
    return NextResponse.redirect(new URL(`${returnTo}?auth_error=user_parse_failed`, authOrigin));
  }

  const kakaoId = String(userData.id);
  const nickname: string =
    userData.kakao_account?.profile?.nickname ??
    userData.properties?.nickname ??
    "카카오 사용자";
  const profileImage: string | undefined =
    userData.kakao_account?.profile?.thumbnail_image_url ??
    userData.properties?.thumbnail_image ??
    undefined;

  // DB에 회원 정보 기록 또는 갱신 (자동 회원가입)
  // 삭제된 이력이 있어도 재가입 허용 - 신규 회원과 동일하게 처리
  let isNewUser = false;
  try {
    const syncResult = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.findUnique({ where: { kakaoId } });
      const deletedRecord = await tx.deletedKakaoId.findUnique({ where: { kakaoId } });
      const wasDeleted = !!deletedRecord;

      await tx.user.upsert({
        where: { kakaoId },
        update: {
          profileImage: profileImage || null,
        },
        create: {
          kakaoId,
          name: nickname,
          profileImage: profileImage || null,
          role: "MEMBER",
        },
      });

      if (deletedRecord) {
        await tx.deletedKakaoId.delete({ where: { kakaoId } });
      }

      return { isNewUser: !existing || wasDeleted };
    });

    isNewUser = syncResult.isNewUser;
  } catch (dbError) {
    console.error("Failed to upsert user:", dbError);
    return NextResponse.redirect(
      new URL(`${returnTo}?auth_error=account_sync_failed`, authOrigin),
    );
  }

  // 3) 세션 쿠키 설정 후 리다이렉트
  const token = encodeSession({ kakaoId, nickname, profileImage });
  const redirectTo = isNewUser ? "/profile?setup=true" : returnTo;
  const res = NextResponse.redirect(new URL(redirectTo, authOrigin));
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });

  return res;
}
