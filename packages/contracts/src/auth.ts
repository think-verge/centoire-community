export type UserRole = "member" | "creator" | "editor" | "admin";

/** Claims carried by the session JWT shared by every Centoire app. */
export interface AuthPayload {
  userId: string;
  email: string;
  role: UserRole;
}

/** Domain-scoped session cookie (".centoire.com" in production). */
export const SESSION_COOKIE = "cnt_session";
/** Pre-SSO host-only cookie; still read for one JWT lifetime, then removed. */
export const LEGACY_SESSION_COOKIE = "token";
export const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
