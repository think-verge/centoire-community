import { Router } from "express";
import * as circleController from "../controllers/circleController.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import {
  CircleListQuerySchema,
  CirclePostsQuerySchema,
  CircleSlugParamsSchema,
  CreateCircleInputSchema,
} from "../schemas/community.js";
import { asyncHandler } from "../utils/async-handler.js";

export const circleRouter = Router();

circleRouter.get(
  "/",
  optionalAuth,
  validate({ query: CircleListQuerySchema }),
  asyncHandler(circleController.list),
);
circleRouter.post(
  "/",
  requireAuth,
  validate({ body: CreateCircleInputSchema }),
  asyncHandler(circleController.create),
);
const params = validate({ params: CircleSlugParamsSchema });
circleRouter.get("/:slug", optionalAuth, params, asyncHandler(circleController.getBySlug));
circleRouter.post("/:slug/join", requireAuth, params, asyncHandler(circleController.join));
circleRouter.delete("/:slug/join", requireAuth, params, asyncHandler(circleController.leave));
circleRouter.get(
  "/:slug/posts",
  optionalAuth,
  validate({ params: CircleSlugParamsSchema, query: CirclePostsQuerySchema }),
  asyncHandler(circleController.posts),
);
circleRouter.get("/:slug/members", optionalAuth, params, asyncHandler(circleController.members));
