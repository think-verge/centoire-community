import { Router } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { requireAuth, requirePermission } from "../middleware/auth.js";
import * as moderationController from "../controllers/moderationController.js";

export const moderationRouter = Router();

// All moderation routes require authentication
moderationRouter.use(requireAuth);

// Queue — requires moderation.review
moderationRouter.get(
  "/queue",
  requirePermission("moderation.review"),
  asyncHandler(moderationController.listQueue),
);
moderationRouter.post(
  "/:id/approve",
  requirePermission("moderation.review"),
  asyncHandler(moderationController.approvePost),
);
moderationRouter.post(
  "/:id/reject",
  requirePermission("moderation.review"),
  asyncHandler(moderationController.rejectPost),
);

// Policies — requires moderation.manage_policies
moderationRouter.get(
  "/policies",
  requirePermission("moderation.manage_policies"),
  asyncHandler(moderationController.listPolicies),
);
moderationRouter.post(
  "/policies",
  requirePermission("moderation.manage_policies"),
  asyncHandler(moderationController.createPolicy),
);
moderationRouter.patch(
  "/policies/:id",
  requirePermission("moderation.manage_policies"),
  asyncHandler(moderationController.updatePolicy),
);
moderationRouter.delete(
  "/policies/:id",
  requirePermission("moderation.manage_policies"),
  asyncHandler(moderationController.deletePolicy),
);
