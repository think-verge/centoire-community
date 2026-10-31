import type { NextFunction, Request, RequestHandler, Response } from "express";
import jwt from "jsonwebtoken";
import { ApiError } from "./errors.js";

export interface Claims {
  userId: string;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: Claims;
    }
  }
}

export const HDR_GATEWAY_SECRET = "x-gateway-secret";
export const HDR_INTERNAL_SECRET = "x-internal-secret";
export const HDR_USER_ID = "x-user-id";
export const HDR_USER_EMAIL = "x-user-email";
export const HDR_USER_ROLE = "x-user-role";

export function verifyJwt(token: string, secret: string): Claims | undefined {
  try {
    return jwt.verify(token, secret) as Claims;
  } catch {
    return undefined;
  }
}

export function claimsToHeaders(c: Claims): Record<string, string> {
  return { [HDR_USER_ID]: c.userId, [HDR_USER_EMAIL]: c.email, [HDR_USER_ROLE]: c.role };
}

function str(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Resolves req.user. Claims forwarded by the gateway are trusted only when the
 * request carries the shared gateway secret (or the internal secret, for
 * service-to-service calls); otherwise the session cookie is verified directly,
 * so a service stays usable standalone in dev.
 */
export function resolveClaims(opts: { jwtSecret: string; gatewaySecret: string; internalSecret: string }): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    const gw = str(req.headers[HDR_GATEWAY_SECRET]);
    const internal = str(req.headers[HDR_INTERNAL_SECRET]);
    const trusted = gw === opts.gatewaySecret || internal === opts.internalSecret;
    if (trusted) {
      const userId = str(req.headers[HDR_USER_ID]);
      if (userId) {
        req.user = {
          userId,
          email: str(req.headers[HDR_USER_EMAIL]) ?? "",
          role: str(req.headers[HDR_USER_ROLE]) ?? "user",
        };
      }
    } else {
      const token = req.cookies?.token as string | undefined;
      if (token) req.user = verifyJwt(token, opts.jwtSecret);
    }
    next();
  };
}

export function requireUser(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) throw new ApiError(401, "Authentication required");
  next();
}

export function requireAdminUser(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) throw new ApiError(401, "Authentication required");
  if (req.user.role !== "admin") throw new ApiError(403, "Admin access required");
  next();
}
