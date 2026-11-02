import { Router } from "express";
import { env } from "../config/env.js";
import * as syncService from "../services/syncService.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";

// Service-to-service only (reached through the gateway's private listener).
export const platformSyncRouter = Router();

platformSyncRouter.use((req, _res, next) => {
  if (req.headers["x-internal-secret"] !== env.INTERNAL_SECRET) throw new ApiError(401, "Unauthorized");
  next();
});

function kindOf(raw: unknown): syncService.SyncKind {
  if (!syncService.SYNC_KINDS.includes(raw as syncService.SyncKind)) throw new ApiError(404, "Unknown sync kind");
  return raw as syncService.SyncKind;
}

platformSyncRouter.get(
  "/:kind/ids",
  asyncHandler(async (req, res) => {
    res.json(await syncService.ids(kindOf(req.params.kind), req.query.after as string | undefined, req.query.limit));
  }),
);

platformSyncRouter.get(
  "/:kind",
  asyncHandler(async (req, res) => {
    res.json(await syncService.changes(kindOf(req.params.kind), req.query.cursor as string | undefined, req.query.limit));
  }),
);
