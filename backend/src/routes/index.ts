import { Router } from "express";
import { adminPostRouter } from "./adminPostRoutes.js";
import { agentRouter } from "./agentRoutes.js";
import { authRouter } from "./authRoutes.js";
import { circleRouter } from "./circleRoutes.js";
import {
  bookmarkFolderRouter,
  bookmarkRouter,
  commentRouter,
  postEngagementRouter,
} from "./engagementRoutes.js";
import { feedRouter } from "./feedRoutes.js";
import { internalRouter } from "./internalRoutes.js";
import { platformSyncRouter } from "./platformSyncRoutes.js";
import { inviteRouter } from "./inviteRoutes.js";
import { moderationRouter } from "./moderationRoutes.js";
import { notificationRouter } from "./notificationRoutes.js";
import { onboardingRouter } from "./onboardingRoutes.js";
import { postRouter } from "./postRoutes.js";
import { searchRouter } from "./searchRoutes.js";
import { sourceRouter } from "./sourceRoutes.js";
import { adminHashtagRouter, hashtagRouter } from "./hashtagRoutes.js";
import { uploadRouter } from "./uploadRoutes.js";
import { userRouter } from "./userRoutes.js";
import { env } from "../config/env.js";
import { registerNotificationListeners } from "../services/notificationService.js";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/hashtags", hashtagRouter);
apiRouter.use("/users", userRouter);
apiRouter.use("/onboarding", onboardingRouter);
apiRouter.use("/circles", circleRouter);
apiRouter.use("/feed", feedRouter);
apiRouter.use("/posts", postEngagementRouter);
apiRouter.use("/posts", postRouter);
apiRouter.use("/comments", commentRouter);
apiRouter.use("/bookmarks", bookmarkRouter);
apiRouter.use("/bookmark-folders", bookmarkFolderRouter);
apiRouter.use("/uploads", uploadRouter);
apiRouter.use("/sources", sourceRouter);
apiRouter.use("/admin/sources", sourceRouter);
apiRouter.use("/admin/posts", adminPostRouter);
apiRouter.use("/admin/invites", inviteRouter);
apiRouter.use("/admin/hashtags", adminHashtagRouter);
apiRouter.use("/moderation", moderationRouter);
if (!env.NOTIFICATIONS_EXTERNAL) {
  apiRouter.use("/notifications", notificationRouter);
  registerNotificationListeners();
}
apiRouter.use("/search", searchRouter);
apiRouter.use("/agent", agentRouter);
apiRouter.use("/internal/sync", platformSyncRouter);
apiRouter.use("/internal", internalRouter);

apiRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", uptimeSeconds: Math.round(process.uptime()) });
});
