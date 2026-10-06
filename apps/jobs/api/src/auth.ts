import type { NextFunction, Request, Response } from "express";
import { ApiError, createAuthMiddleware, createTokenVerifier } from "@centoire/server-kit";
import { env } from "./config/env.js";
import { isEmailVerified } from "./platform.js";

export const verifySessionToken = createTokenVerifier({
  hs256Secret: env.JWT_SECRET,
  publicKeyPem: env.JWT_PUBLIC_KEY,
  jwksUrl: env.JWKS_URL,
});

export const { requireAuth, optionalAuth, requirePermission } = createAuthMiddleware(verifySessionToken);

/** Applying, posting and creating companies require a verified email (checked against core). */
export async function requireVerified(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (!req.user) throw new ApiError(401, "Authentication required");
  if (!(await isEmailVerified(req.user.userId))) throw new ApiError(403, "Verify your email to do this");
  next();
}
