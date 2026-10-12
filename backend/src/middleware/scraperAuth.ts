import { createHash, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";

const digest = (value: string) => createHash("sha256").update(value).digest();

/** Compares in constant time (hashing first makes both buffers the same length). */
export function secretsMatch(provided: string | undefined, expected: string): boolean {
  if (!provided) return false;
  return timingSafeEqual(digest(provided), digest(expected));
}

/** Machine auth for the external scraper-agent: its own secret, never the user JWT or the AI secret. */
export function requireScraperSecret(req: Request, res: Response, next: NextFunction): void {
  if (!secretsMatch(req.header("x-scraper-secret"), env.SCRAPER_SECRET)) {
    res.status(401).json({ detail: "Unauthorized" });
    return;
  }
  next();
}
