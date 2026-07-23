import { Router } from "express";
import { authRouter } from "./authRoutes.js";
import { circleRouter } from "./circleRoutes.js";
import {
  bookmarkFolderRouter,
  bookmarkRouter,
  commentRouter,
  postEngagementRouter,
} from "./engagementRoutes.js";
import { feedRouter } from "./feedRoutes.js";
import { inviteRouter } from "./inviteRoutes.js";
import { moderationRouter } from "./moderationRoutes.js";
import { onboardingRouter } from "./onboardingRoutes.js";
import { postRouter } from "./postRoutes.js";
import { searchRouter } from "./searchRoutes.js";
import { sourceRouter } from "./sourceRoutes.js";
import { tagRouter } from "./tagRoutes.js";
import { uploadRouter } from "./uploadRoutes.js";
import { userRouter } from "./userRoutes.js";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/tags", tagRouter);
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
apiRouter.use("/admin/sources", sourceRouter);
apiRouter.use("/admin/invites", inviteRouter);
apiRouter.use("/moderation", moderationRouter);
apiRouter.use("/search", searchRouter);

apiRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", uptimeSeconds: Math.round(process.uptime()) });
});
