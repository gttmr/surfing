/**
 * 카카오 JS SDK를 이용한 로그인.
 * 모바일에서 카카오톡 앱이 설치되어 있으면 앱으로 바로 인증하여
 * ID/PW 입력 없이 로그인됩니다.
 */
export function kakaoLogin(returnTo: string) {
  const redirectUri = `${window.location.origin}/api/auth/kakao/callback`;

  if (typeof window !== "undefined" && window.Kakao?.isInitialized()) {
    window.Kakao.Auth.authorize({
      redirectUri,
      state: encodeURIComponent(returnTo),
    });
  } else {
    // SDK 로드 실패 시 기존 REST API 폴백
    window.location.href = `/api/auth/kakao?returnTo=${encodeURIComponent(returnTo)}`;
  }
}
