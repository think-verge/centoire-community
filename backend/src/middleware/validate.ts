import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

interface ValidateTargets {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
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
