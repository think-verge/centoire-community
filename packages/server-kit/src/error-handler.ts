import type { NextFunction, Request, Response } from "express";
import { ApiError } from "./api-error.js";

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ detail: "Not found" });
}

interface ZodLikeError {
  name: string;
  issues: Array<{ path: Array<string | number>; message: string }>;
}

function isZodError(err: unknown): err is ZodLikeError {
  return (
    typeof err === "object" &&
    err !== null &&
    (err as { name?: string }).name === "ZodError" &&
    Array.isArray((err as { issues?: unknown }).issues)
  );
}

function isMongooseInputError(err: unknown): boolean {
  const name = (err as { name?: string } | null)?.name;
  return name === "CastError" || name === "ValidationError";
}

/** Maps ApiError / Zod / Mongoose input errors to `{detail}`; everything else is a 500. */
export function createErrorHandler(options: { isProduction: boolean }) {
  return function errorHandler(
    err: unknown,
    _req: Request,
    res: Response,
    _next: NextFunction,
  ): void {
    if (err instanceof ApiError) {
      res.status(err.statusCode).json({ detail: err.message });
      return;
    }
    if (isZodError(err)) {
      const first = err.issues[0];
      const path = first?.path.join(".");
      res.status(422).json({
        detail: path ? `${path}: ${first?.message}` : (first?.message ?? "Invalid input"),
      });
      return;
    }
    if (isMongooseInputError(err)) {
      res.status(422).json({ detail: "Invalid input" });
      return;
    }
    if (!options.isProduction) {
      console.error("[error]", err);
    }
    res.status(500).json({ detail: "Internal server error" });
  };
}
