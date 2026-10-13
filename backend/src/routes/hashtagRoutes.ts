import { Router } from "express";
import rateLimit from "express-rate-limit";
import * as hashtagController from "../controllers/hashtagController.js";
import { optionalAuth, requireAuth, requirePermission } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  HashtagListQuerySchema,
  HashtagNameParamsSchema,
  HashtagTrendingQuerySchema,
} from "../schemas/hashtags.js";
import { asyncHandler } from "../utils/async-handler.js";

// Typeahead fires on (debounced) keystrokes and is public, so cap it per IP.
const suggestLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { detail: "Too many requests, slow down" },
});

export const hashtagRouter = Router();

hashtagRouter.get("/", suggestLimiter, validate({ query: HashtagListQuerySchema }), asyncHandler(hashtagController.list));
// Static path before "/:name" so "trending" is never read as a hashtag.
hashtagRouter.get("/trending", validate({ query: HashtagTrendingQuerySchema }), asyncHandler(hashtagController.trending));
hashtagRouter.get("/:name", optionalAuth, validate({ params: HashtagNameParamsSchema }), asyncHandler(hashtagController.getByName));
hashtagRouter.put("/:name/follow", requireAuth, validate({ params: HashtagNameParamsSchema }), asyncHandler(hashtagController.follow));
hashtagRouter.delete("/:name/follow", requireAuth, validate({ params: HashtagNameParamsSchema }), asyncHandler(hashtagController.unfollow));

export const adminHashtagRouter = Router();
adminHashtagRouter.use(requireAuth, requirePermission("moderation.manage_policies"));
adminHashtagRouter.post("/:name/block", validate({ params: HashtagNameParamsSchema }), asyncHandler(hashtagController.block));
adminHashtagRouter.post("/:name/unblock", validate({ params: HashtagNameParamsSchema }), asyncHandler(hashtagController.unblock));
