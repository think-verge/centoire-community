import type { Request } from "express";
import { LEGACY_SESSION_COOKIE, SESSION_COOKIE } from "@centoire/contracts";

/** Prefers the domain-scoped cookie; falls back to the pre-SSO host-only one. */
export function readSessionToken(req: Request): string | undefined {
  const cookies = req.cookies as Record<string, string | undefined> | undefined;
  return cookies?.[SESSION_COOKIE] ?? cookies?.[LEGACY_SESSION_COOKIE];
}
