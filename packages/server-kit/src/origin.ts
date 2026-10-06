import type { NextFunction, Request, Response } from "express";
import { ApiError } from "./api-error.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

/**
 * CSRF guard for cookie auth shared across *.centoire.com: any state-changing request that
 * carries an Origin (browsers always send one for cross-site and fetch/XHR writes) must come
 * from an allowed origin. Requests with no Origin (curl, server-to-server) are not browser CSRF.
 */
export function requireAllowedOrigin(allowed: string[]) {
  const set = new Set(allowed.map((o) => o.replace(/\/$/, "")));
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (SAFE_METHODS.has(req.method)) return next();
    const origin = req.get("origin");
    if (origin && !set.has(origin.replace(/\/$/, ""))) {
      throw new ApiError(403, "Origin not allowed");
    }
    next();
  };
}
