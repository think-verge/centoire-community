import { Router } from "express";
import * as userController from "../controllers/userController.js";
import { optionalAuth, requireAuth, requirePermission } from "../middleware/auth.js";
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
userRouter.delete(
  "/me",
  requireAuth,
  asyncHandler(userController.deleteMe),
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
userRouter.get("/me/blocks", requireAuth, asyncHandler(userController.getBlockedUsers));
userRouter.get("/me/mutes", requireAuth, asyncHandler(userController.getMutedUsers));
userRouter.post("/:id/follow", requireAuth, asyncHandler(userController.follow));
userRouter.delete("/:id/follow", requireAuth, asyncHandler(userController.unfollow));
userRouter.post("/:id/block", requireAuth, asyncHandler(userController.blockUser));
userRouter.delete("/:id/block", requireAuth, asyncHandler(userController.unblockUser));
userRouter.post("/:id/mute", requireAuth, asyncHandler(userController.muteUser));
userRouter.delete("/:id/mute", requireAuth, asyncHandler(userController.unmuteUser));
userRouter.patch(
  "/:id/role",
  requireAuth,
  requirePermission("user.promote"),
  asyncHandler(userController.promoteUser),
);
userRouter.get("/check-handle", optionalAuth, asyncHandler(userController.checkHandle));
userRouter.get("/featured", optionalAuth, asyncHandler(userController.getFeatured));
userRouter.get("/:handle", optionalAuth, asyncHandler(userController.getByHandle));
userRouter.get("/:handle/posts", optionalAuth, asyncHandler(userController.getUserPosts));
