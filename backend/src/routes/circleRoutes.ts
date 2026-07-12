import { Router } from "express";
import * as circleController from "../controllers/circleController.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { CircleListQuerySchema, CreateCircleInputSchema } from "../schemas/community.js";
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
circleRouter.get("/:slug", optionalAuth, asyncHandler(circleController.getBySlug));
circleRouter.post("/:slug/join", requireAuth, asyncHandler(circleController.join));
circleRouter.delete("/:slug/join", requireAuth, asyncHandler(circleController.leave));
circleRouter.get("/:slug/posts", optionalAuth, asyncHandler(circleController.posts));
circleRouter.get("/:slug/members", optionalAuth, asyncHandler(circleController.members));
