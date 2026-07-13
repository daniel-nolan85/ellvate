// Derives the default API base URL when EXPO_PUBLIC_API_URL is unset.
// A web origin is used whenever present (dev or production): the Expo API
// routes are served same-origin, so a production web deploy works without
// configuration. The native dev-server host is only meaningful in development;
// a production native build has no dev server, so it returns null.
export function deriveDefaultApiUrl(
  hostUri: string | null | undefined,
  isDev: boolean,
  webOrigin?: string | null,
): string | null {
  const origin = webOrigin?.trim();
  if (origin) {
    return origin;
  }

  if (!isDev) {
    return null;
  }

  const host = hostUri?.trim();
  if (!host) {
    return null;
  }

  return /^https?:\/\//.test(host) ? host : `http://${host}`;
}
