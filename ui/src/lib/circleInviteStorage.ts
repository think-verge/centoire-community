export interface PendingCircleInvite {
  token: string;
  slug: string;
}

const STORAGE_KEY = "centoire_pending_circle_invite";

export function normalizeCircleSlug(raw?: string | null): string {
  if (!raw) return "";
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function savePendingCircleInvite(token: string, slug: string): void {
  const cleanSlug = normalizeCircleSlug(slug);
  if (!token || !cleanSlug) return;
  const data = JSON.stringify({ token, slug: cleanSlug });
  try {
    sessionStorage.setItem(STORAGE_KEY, data);
  } catch {
    // ignore
  }
  try {
    localStorage.setItem(STORAGE_KEY, data);
  } catch {
    // ignore
  }
}

export function getPendingCircleInvite(): PendingCircleInvite | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY) || localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && (parsed.token || parsed.slug)) {
      return { token: parsed.token || "", slug: normalizeCircleSlug(parsed.slug) };
    }
    return null;
  } catch {
    return null;
  }
}

export function clearPendingCircleInvite(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}
