import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { ApiError } from "../utils/api-error.js";
import { isProduction } from "../config/env.js";

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ detail: "Not found" });
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ApiError) {
    res.status(err.statusCode).json({ detail: err.message });
    return;
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    const path = first?.path.join(".");
    res.status(422).json({
      detail: path ? `${path}: ${first?.message}` : (first?.message ?? "Invalid input"),
    });
    return;
  }
  if (!isProduction) {
    console.error("[error]", err);
  }
  res.status(500).json({ detail: "Internal server error" });
}
