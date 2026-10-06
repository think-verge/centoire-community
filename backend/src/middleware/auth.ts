import type { NextFunction, Request, Response } from "express";
import { createAuthMiddleware, createTokenVerifier, ApiError } from "@centoire/server-kit";
import { env } from "../config/env.js";

export type { AuthPayload } from "@centoire/contracts";

/** Core accepts HS256 (legacy/dev) and RS256 (when a key pair is configured) tokens. */
export const verifySessionToken = createTokenVerifier({
  hs256Secret: env.JWT_SECRET,
  publicKeyPem: env.JWT_PUBLIC_KEY || undefined,
});

export const { requireAuth, optionalAuth, requirePermission } =
  createAuthMiddleware(verifySessionToken);

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) throw new ApiError(401, "Authentication required");
  if (req.user.role !== "admin") throw new ApiError(403, "Admin access required");
  next();
}
