/**
 * The only place a /r/:id redirect target is decided. It comes from the post's stored
 * externalUrl, never from the request, so the endpoint cannot be used as an open redirect.
 */
export function resolveReadTarget(externalUrl: string | undefined | null): string | null {
  if (!externalUrl) return null;
  try {
    const url = new URL(externalUrl);
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}
