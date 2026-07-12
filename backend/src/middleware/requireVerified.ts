import type { NextFunction, Request, Response } from "express";
import { User } from "../models/User.js";
import { ApiError } from "../utils/api-error.js";

/** Posting, commenting, and voting require a verified email. */
export async function requireVerified(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user) throw new ApiError(401, "Authentication required");
  const user = await User.findById(req.user.userId).select("emailVerified");
  if (!user?.emailVerified) {
    throw new ApiError(403, "Verify your email to do this");
  }
  next();
}
