import { Router } from "express";
import * as feedController from "../controllers/feedController.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { DiscoverQuerySchema, FeedCursorQuerySchema } from "../schemas/feed.js";
import { asyncHandler } from "../utils/async-handler.js";

export const feedRouter = Router();

feedRouter.get(
  "/for-you",
  requireAuth,
  validate({ query: FeedCursorQuerySchema }),
  asyncHandler(feedController.forYou),
);
feedRouter.get(
  "/following",
  requireAuth,
  validate({ query: FeedCursorQuerySchema }),
  asyncHandler(feedController.following),
);
feedRouter.get(
  "/discover",
  optionalAuth,
  validate({ query: DiscoverQuerySchema }),
  asyncHandler(feedController.discover),
);
