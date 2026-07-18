const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "[::1]"]);

function isLoopback(url: URL): boolean {
  return LOOPBACK_HOSTS.has(url.hostname);
}

function requestCallback(requestOrigin: string): string {
  return new URL("/api/auth/kakao/callback", requestOrigin).toString();
}

export function resolveKakaoRedirectUri(
  requestOrigin: string,
  configuredRedirectUri: string | undefined,
): string {
  const fallback = requestCallback(requestOrigin);
  const configured = configuredRedirectUri?.trim();
  if (!configured) return fallback;

  let configuredUrl: URL;
  try {
    configuredUrl = new URL(configured);
  } catch {
    return fallback;
  }

  const requestUrl = new URL(requestOrigin);
  if (!isLoopback(requestUrl) && isLoopback(configuredUrl)) {
    return fallback;
  }

  return configuredUrl.toString();
}

export function resolveKakaoAuthOrigin(
  requestOrigin: string,
  configuredRedirectUri: string | undefined,
): string {
  return new URL(resolveKakaoRedirectUri(requestOrigin, configuredRedirectUri)).origin;
}
