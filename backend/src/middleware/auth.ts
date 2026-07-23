import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { hasPermission, type Permission } from "../config/permissions.js";
import type { UserRole } from "../models/User.js";
import { ApiError } from "../utils/api-error.js";

export interface AuthPayload {
  userId: string;
  email: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthPayload;
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

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = readToken(req);
  if (!token) throw new ApiError(401, "Authentication required");
  req.user = verifyToken(token);
  next();
}

export function optionalAuth(req: Request, _res: Response, next: NextFunction): void {
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
    if (!hasPermission(req.user.role, permission)) throw new ApiError(403, "Insufficient permissions");
    next();
  };
}
