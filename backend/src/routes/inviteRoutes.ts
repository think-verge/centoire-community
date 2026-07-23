import { Router } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import * as inviteController from "../controllers/inviteController.js";

export const inviteRouter = Router();

// Admin-only invite management
inviteRouter.post(
  "/",
  requireAuth,
  requirePermission("user.invite"),
  asyncHandler(inviteController.createInvite),
);
inviteRouter.get(
  "/",
  requireAuth,
  requirePermission("user.invite"),
  asyncHandler(inviteController.listInvites),
);
inviteRouter.delete(
  "/:id",
  requireAuth,
  requirePermission("user.invite"),
  asyncHandler(inviteController.revokeInvite),
);
