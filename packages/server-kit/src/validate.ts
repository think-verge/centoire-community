import type { NextFunction, Request, Response } from "express";

/** Anything with a zod-style `parse` (kept structural so server-kit needs no zod copy). */
interface Parser {
  parse(data: unknown): unknown;
}

interface ValidateTargets {
  body?: Parser;
  query?: Parser;
  params?: Parser;
}

export function validate(targets: ValidateTargets) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (targets.body) {
      req.body = targets.body.parse(req.body);
    }
    if (targets.query) {
      // express 5 exposes req.query as a getter; stash parsed values separately
      req.validatedQuery = targets.query.parse(req.query);
    }
    if (targets.params) {
      targets.params.parse(req.params);
    }
    next();
  };
}

declare global {
  namespace Express {
    interface Request {
      validatedQuery?: unknown;
    }
  }
}
