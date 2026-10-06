const KEY = "centoire:returnTo";

function isAllowed(target: string, allowedOrigins: string[]): boolean {
  try {
    const u = new URL(target);
    return (
      (u.protocol === "https:" || u.protocol === "http:") &&
      allowedOrigins.some((o) => o.replace(/\/$/, "") === u.origin)
    );
  } catch {
    return false;
  }
}

/** Where mini apps send signed-out users: the core app's login page, remembering where to come back. */
export function loginUrl(coreUrl: string, returnTo: string): string {
  return `${coreUrl.replace(/\/$/, "")}/login?returnTo=${encodeURIComponent(returnTo)}`;
}

/**
 * Reads `?returnTo=` (falling back to the value stashed before a signup/verify detour) and returns
 * it only if it points at an allowed Centoire origin — never an arbitrary URL (open-redirect guard).
 */
export function readReturnTo(search: string, allowedOrigins: string[]): string | null {
  const fromQuery = new URLSearchParams(search).get("returnTo");
  try {
    if (fromQuery) sessionStorage.setItem(KEY, fromQuery);
  } catch {
    /* storage unavailable */
  }
  let candidate = fromQuery;
  if (!candidate) {
    try {
      candidate = sessionStorage.getItem(KEY);
    } catch {
      candidate = null;
    }
  }
  return candidate && isAllowed(candidate, allowedOrigins) ? candidate : null;
}

export function clearReturnTo(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}
