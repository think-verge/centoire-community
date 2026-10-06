import type { CookieOptions, Request, Response } from "express";
import { LEGACY_SESSION_COOKIE, SESSION_COOKIE, SESSION_MAX_AGE_MS } from "@centoire/contracts";
import { env } from "../config/env.js";
import type { IUser } from "../models/User.js";
import { signSessionToken } from "./authService.js";

function baseOptions(): CookieOptions {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    path: "/",
    ...(env.COOKIE_DOMAIN ? { domain: env.COOKIE_DOMAIN } : {}),
  };
}

/** Sets the shared session cookie and drops the pre-SSO host-only one. */
export function setSessionCookie(res: Response, user: IUser): void {
  res.cookie(SESSION_COOKIE, signSessionToken(user), { ...baseOptions(), maxAge: SESSION_MAX_AGE_MS });
  res.clearCookie(LEGACY_SESSION_COOKIE, { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: "lax", path: "/" });
}

/** clearCookie only matches when domain/path/sameSite/secure equal those used to set it. */
export function clearSessionCookie(res: Response): void {
  res.clearCookie(SESSION_COOKIE, baseOptions());
  res.clearCookie(LEGACY_SESSION_COOKIE, { httpOnly: true, secure: env.COOKIE_SECURE, sameSite: "lax", path: "/" });
}

/** True when the request is authenticated only by the old host-only cookie. */
export function usesLegacySession(req: Request): boolean {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  return Boolean(cookies?.[LEGACY_SESSION_COOKIE]) && !cookies?.[SESSION_COOKIE];
}
