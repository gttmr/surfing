interface KakaoAuth {
  authorize(params: { redirectUri: string; state?: string }): void;
}

interface KakaoStatic {
  init(appKey: string): void;
  isInitialized(): boolean;
  Auth: KakaoAuth;
}

interface Window {
  Kakao?: KakaoStatic;
  __KAKAO_INIT__?: () => void;
}
