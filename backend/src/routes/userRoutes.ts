import { Router } from "express";
import * as userController from "../controllers/userController.js";
import { optionalAuth, requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { SetInterestsInputSchema, UpdateMeInputSchema } from "../schemas/community.js";
import { asyncHandler } from "../utils/async-handler.js";

export const userRouter = Router();

userRouter.patch(
  "/me",
  requireAuth,
  validate({ body: UpdateMeInputSchema }),
  asyncHandler(userController.updateMe),
);
userRouter.put(
  "/me/interests",
  requireAuth,
  validate({ body: SetInterestsInputSchema }),
  asyncHandler(userController.setInterests),
);
userRouter.post(
  "/me/complete-onboarding",
  requireAuth,
  asyncHandler(userController.completeOnboarding),
);
userRouter.post("/:id/follow", requireAuth, asyncHandler(userController.follow));
userRouter.delete("/:id/follow", requireAuth, asyncHandler(userController.unfollow));
userRouter.get("/:handle", optionalAuth, asyncHandler(userController.getByHandle));
userRouter.get("/:handle/posts", optionalAuth, asyncHandler(userController.getUserPosts));
