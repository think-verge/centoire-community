import { registry, z, jsonResponse } from "./registry.js";

const NotificationTypeEnum = z.enum([
  "user.followed",
  "post.upvoted",
  "comment.upvoted",
  "comment.created",
  "comment.replied",
  "comment.mentioned",
  "post.approved",
  "post.rejected",
]);

const NotificationActorSchema = z.object({
  id: z.string(),
  handle: z.string().nullable(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
});

const NotificationTargetPostSchema = z.object({
  id: z.string(),
  slug: z.string(),
  title: z.string(),
});

export const NotificationSchema = registry.register(
  "Notification",
  z.object({
    id: z.string(),
    type: NotificationTypeEnum,
    actor: NotificationActorSchema.nullable(),
    targetPost: NotificationTargetPostSchema.nullable(),
    readAt: z.string().nullable(),
    createdAt: z.string(),
  }),
);

export const NotificationPageSchema = registry.register(
  "NotificationPage",
  z.object({
    items: z.array(NotificationSchema),
    nextCursor: z.string().nullable(),
  }),
);

export const UnreadCountSchema = registry.register(
  "UnreadCount",
  z.object({ count: z.number() }),
);

export const NotificationCursorQuerySchema = z.object({
  cursor: z.string().optional(),
});

export function registerNotificationPaths(): void {
  registry.registerPath({
    method: "get",
    path: "/notifications",
    tags: ["notifications"],
    operationId: "listNotifications",
    request: { query: NotificationCursorQuerySchema },
    responses: { 200: jsonResponse("Notifications page", NotificationPageSchema) },
  });
  registry.registerPath({
    method: "get",
    path: "/notifications/unread-count",
    tags: ["notifications"],
    operationId: "getUnreadNotificationCount",
    responses: { 200: jsonResponse("Unread notification count", UnreadCountSchema) },
  });
  registry.registerPath({
    method: "patch",
    path: "/notifications/{id}/read",
    tags: ["notifications"],
    operationId: "markNotificationRead",
    request: { params: z.object({ id: z.string() }) },
    responses: { 204: { description: "Marked as read" } },
  });
  registry.registerPath({
    method: "patch",
    path: "/notifications/read-all",
    tags: ["notifications"],
    operationId: "markAllNotificationsRead",
    responses: { 204: { description: "All marked as read" } },
  });
}
