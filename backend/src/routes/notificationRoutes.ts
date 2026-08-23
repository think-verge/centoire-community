import { Router } from "express";
import * as notificationController from "../controllers/notificationController.js";
import { requireAuth } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { NotificationCursorQuerySchema } from "../schemas/notifications.js";
import { asyncHandler } from "../utils/async-handler.js";

export const notificationRouter = Router();

notificationRouter.use(requireAuth);

notificationRouter.get(
  "/",
  validate({ query: NotificationCursorQuerySchema }),
  asyncHandler(notificationController.list),
);
notificationRouter.get("/unread-count", asyncHandler(notificationController.unreadCount));
notificationRouter.patch("/:id/read", asyncHandler(notificationController.markRead));
notificationRouter.patch("/read-all", asyncHandler(notificationController.markAllRead));
