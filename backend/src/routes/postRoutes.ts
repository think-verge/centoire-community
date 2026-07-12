import { Router } from "express";
import * as postController from "../controllers/postController.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { requireVerified } from "../middleware/requireVerified.js";
import { validate } from "../middleware/validate.js";
import { CreatePostInputSchema, UpdatePostInputSchema } from "../schemas/posts.js";
import { asyncHandler } from "../utils/async-handler.js";

export const postRouter = Router();

postRouter.post(
  "/",
  requireAuth,
  asyncHandler(requireVerified),
  validate({ body: CreatePostInputSchema }),
  asyncHandler(postController.create),
);
postRouter.get("/me/drafts", requireAuth, asyncHandler(postController.myDrafts));
postRouter.get("/:slug", optionalAuth, asyncHandler(postController.getBySlug));
postRouter.patch(
  "/:id",
  requireAuth,
  validate({ body: UpdatePostInputSchema }),
  asyncHandler(postController.update),
);
postRouter.post("/:id/publish", requireAuth, asyncHandler(postController.publish));
postRouter.delete("/:id", requireAuth, asyncHandler(postController.remove));
