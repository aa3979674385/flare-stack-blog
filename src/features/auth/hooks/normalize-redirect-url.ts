const REDIRECT_URL_ALLOW_LIST: Array<string> = [];

export function normalizeRedirectUrl(
  redirectTo: string | undefined,
  fallback: string,
) {
  // SSR 守卫：本函数依赖 window.location，服务端没有 window。若在渲染期被调用，
  // 抛错会让 React 把整个 Suspense 边界标记为出错，进而导致水合失败（#419）。
  // 这里降级为相对路径，保证服务端不抛错；调用方应尽量在事件回调里惰性调用。
  if (typeof window === "undefined") {
    if (!redirectTo) return fallback;
    return redirectTo.startsWith("/") ? redirectTo : fallback;
  }

  const safeFallback = `${window.location.origin}${fallback}`;

  if (!redirectTo) {
    return safeFallback;
  }

  try {
    const normalizedUrl = new URL(redirectTo, window.location.origin);
    const isSameOrigin = normalizedUrl.origin === window.location.origin;
    const isAllowedExternalHostname = REDIRECT_URL_ALLOW_LIST.includes(
      normalizedUrl.hostname,
    );

    if (!isSameOrigin && !isAllowedExternalHostname) {
      return safeFallback;
    }

    if (normalizedUrl.pathname.startsWith("/api/")) {
      return `${normalizedUrl.pathname}${normalizedUrl.search}${normalizedUrl.hash}`;
    }

    return normalizedUrl.toString();
  } catch {
    return safeFallback;
  }
}
