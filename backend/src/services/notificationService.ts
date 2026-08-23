import { Types } from "mongoose";
import { Notification, type INotification, type NotificationType } from "../models/Notification.js";
import { onDomainEvent } from "../events/eventBus.js";
import { decodeCursor, encodeCursor } from "../utils/cursor.js";
import { ApiError } from "../utils/api-error.js";

const PAGE_SIZE = 20;

interface NotifyInput {
  recipientId: string;
  actorId?: string;
  type: NotificationType;
  targetPostId?: string;
  targetCommentId?: string;
  targetUserId?: string;
}

async function notify(input: NotifyInput): Promise<void> {
  if (input.actorId && input.actorId === input.recipientId) return; // never notify yourself
  await Notification.create(input);
}

// This module is the sole subscriber of these domain events — emitters
// (voteService, engagementService, userService, postService, moderationService)
// only ever call emitDomainEvent(), never notify() directly. That seam is what
// lets notification-service become its own process later without touching them.
onDomainEvent("user.followed", ({ followerId, followeeId }) => {
  void notify({ recipientId: followeeId, actorId: followerId, type: "user.followed" });
});
onDomainEvent("post.upvoted", ({ actorId, recipientId, postId }) => {
  void notify({ recipientId, actorId, type: "post.upvoted", targetPostId: postId });
});
onDomainEvent("comment.upvoted", ({ actorId, recipientId, commentId, postId }) => {
  void notify({ recipientId, actorId, type: "comment.upvoted", targetCommentId: commentId, targetPostId: postId });
});
onDomainEvent("comment.created", ({ actorId, recipientId, postId, commentId }) => {
  void notify({ recipientId, actorId, type: "comment.created", targetPostId: postId, targetCommentId: commentId });
});
onDomainEvent("comment.replied", ({ actorId, recipientId, postId, commentId }) => {
  void notify({ recipientId, actorId, type: "comment.replied", targetPostId: postId, targetCommentId: commentId });
});
onDomainEvent("comment.mentioned", ({ actorId, recipientId, postId, commentId }) => {
  void notify({ recipientId, actorId, type: "comment.mentioned", targetPostId: postId, targetCommentId: commentId });
});
onDomainEvent("post.approved", ({ postId, recipientId }) => {
  void notify({ recipientId, type: "post.approved", targetPostId: postId });
});
onDomainEvent("post.rejected", ({ postId, recipientId }) => {
  void notify({ recipientId, type: "post.rejected", targetPostId: postId });
});

const LIST_POPULATE = [
  { path: "actorId", select: "handle displayName avatarUrl" },
  { path: "targetPostId", select: "slug title" },
];

interface KeysetCursor extends Record<string, unknown> {
  createdAt: string;
  id: string;
}

export interface NotificationPage {
  items: INotification[];
  nextCursor: string | null;
}

export async function listForUser(userId: string, cursor?: string): Promise<NotificationPage> {
  const decoded = decodeCursor<KeysetCursor>(cursor);
  const filter: Record<string, unknown> = { recipientId: userId };
  if (decoded) {
    filter.$or = [
      { createdAt: { $lt: new Date(decoded.createdAt) } },
      { createdAt: new Date(decoded.createdAt), _id: { $lt: new Types.ObjectId(decoded.id) } },
    ];
  }

  const items = await Notification.find(filter)
    .sort({ createdAt: -1, _id: -1 })
    .limit(PAGE_SIZE + 1)
    .populate(LIST_POPULATE);

  const hasMore = items.length > PAGE_SIZE;
  const page = hasMore ? items.slice(0, PAGE_SIZE) : items;
  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last ? encodeCursor({ createdAt: last.createdAt.toISOString(), id: String(last._id) }) : null;

  return { items: page, nextCursor };
}

export async function unreadCount(userId: string): Promise<number> {
  return Notification.countDocuments({ recipientId: userId, readAt: { $exists: false } });
}

export async function markRead(userId: string, notificationId: string): Promise<void> {
  const notification = await Notification.findOne({ _id: notificationId, recipientId: userId });
  if (!notification) throw new ApiError(404, "Notification not found");
  if (!notification.readAt) {
    notification.readAt = new Date();
    await notification.save();
  }
}

export async function markAllRead(userId: string): Promise<void> {
  await Notification.updateMany(
    { recipientId: userId, readAt: { $exists: false } },
    { $set: { readAt: new Date() } },
  );
}
