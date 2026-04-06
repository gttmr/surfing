export function kakaoLogin(returnTo: string) {
  window.location.href = `/api/auth/kakao?returnTo=${encodeURIComponent(returnTo)}`;
}
