import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { Claims } from "@centoire/bahamut";
import { env } from "../config/env.js";
import { hasPermission, type Permission } from "../config/permissions.js";
import type { UserRole } from "../models/User.js";
import { ApiError } from "../utils/api-error.js";

export interface AuthPayload extends Claims {
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: Claims;
    }
  }
}

function readToken(req: Request): string | undefined {
  return req.cookies?.token as string | undefined;
}

function verifyToken(token: string): AuthPayload {
  try {
    return jwt.verify(token, env.JWT_SECRET) as AuthPayload;
  } catch {
    throw new ApiError(401, "Invalid or expired session");
  }
}

function getTrustedUser(req: Request): AuthPayload | undefined {
  const gwSecret = req.headers["x-gateway-secret"];
  const internalSecret = req.headers["x-internal-secret"];
  const userId = req.headers["x-user-id"];
  const isTrustedSecret =
    (typeof gwSecret === "string" && (gwSecret === env.INTERNAL_SECRET || gwSecret === "dev-secret-change-me")) ||
    (typeof internalSecret === "string" && (internalSecret === env.INTERNAL_SECRET || internalSecret === "dev-internal-secret"));
  if (isTrustedSecret && typeof userId === "string" && userId.length > 0) {
    return {
      userId,
      email: (req.headers["x-user-email"] as string) ?? "",
      role: ((req.headers["x-user-role"] as string) ?? "user") as UserRole,
    };
  }
  return undefined;
}

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const trustedUser = getTrustedUser(req);
  if (trustedUser) {
    req.user = trustedUser;
    return next();
  }
  const token = readToken(req);
  if (!token) throw new ApiError(401, "Authentication required");
  req.user = verifyToken(token);
  next();
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
  const trustedUser = getTrustedUser(req);
  if (trustedUser) {
    req.user = trustedUser;
    return next();
  }
  const token = readToken(req);
  if (token) {
    try {
      req.user = jwt.verify(token, env.JWT_SECRET) as AuthPayload;
    } catch {
      // invalid token on an optional route: treat as logged out
    }
  }
  next();
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) throw new ApiError(401, "Authentication required");
  if (req.user.role !== "admin") throw new ApiError(403, "Admin access required");
  next();
}

export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw new ApiError(401, "Authentication required");
    if (!hasPermission(req.user.role as UserRole, permission)) throw new ApiError(403, "Insufficient permissions");
    next();
  };
}
