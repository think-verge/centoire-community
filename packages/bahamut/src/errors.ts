import type { NextFunction, Request, RequestHandler, Response } from "express";
import { ZodError } from "zod";

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ detail: "Not found" });
}

// Preserves the {detail} error shape the UI's axios interceptor expects.
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
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
  if (err && typeof err === "object" && (err as { name?: string }).name === "CastError") {
    res.status(422).json({ detail: "Invalid input" });
    return;
  }
  if (process.env.NODE_ENV !== "production") console.error("[error]", err);
  res.status(500).json({ detail: "Internal server error" });
}
