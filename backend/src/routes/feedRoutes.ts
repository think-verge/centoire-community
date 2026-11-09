import { Router } from "express";
import * as feedController from "../controllers/feedController.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  CategoryFeedParamsSchema,
  CategoryFeedQuerySchema,
  DiscoverQuerySchema,
  FeedCursorQuerySchema,
} from "../schemas/feed.js";
import { asyncHandler } from "../utils/async-handler.js";

export const feedRouter = Router();

feedRouter.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  next();
});

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
feedRouter.get(
  "/category/:category",
  optionalAuth,
  validate({ params: CategoryFeedParamsSchema, query: CategoryFeedQuerySchema }),
  asyncHandler(feedController.category),
);
