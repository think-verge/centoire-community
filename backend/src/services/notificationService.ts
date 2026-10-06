import { Types } from "mongoose";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { mailer } from "./mailerService.js";
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
  app?: "core" | "jobs";
  message?: string;
  link?: string;
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

// Mini-app events arrive through the outbox poller (see workers/outboxPoller.ts) and carry
// the text/link to show, because only the producing app knows its own routes.
const jobsLink = (path: string) => `${env.JOBS_PUBLIC_URL}${path}`;

async function emailUser(userId: string, subject: string, message: string, link: string): Promise<void> {
  const user = await User.findById(userId).select("email");
  if (user?.email) await mailer.sendNotification(user.email, subject, message, link).catch(() => undefined);
}

onDomainEvent("jobs.application.submitted", ({ actorId, recipientIds, jobId, jobTitle }) => {
  const link = jobsLink(`/employer/jobs/${jobId}/applicants`);
  const message = `New application for ${jobTitle}`;
  for (const recipientId of recipientIds) {
    void notify({ recipientId, actorId, type: "jobs.application.submitted", app: "jobs", message, link });
    void emailUser(recipientId, message, message, link);
  }
});
onDomainEvent("jobs.application.status_changed", ({ actorId, recipientId, applicationId, jobTitle, companyName, status }) => {
  void notify({
    recipientId,
    actorId,
    type: "jobs.application.status_changed",
    app: "jobs",
    message: `Your application for ${jobTitle} at ${companyName} is now ${status}`,
    link: jobsLink(`/me/applications/${applicationId}`),
  });
});
onDomainEvent("jobs.job.approved", ({ recipientId, jobId, jobTitle }) => {
  void notify({
    recipientId,
    type: "jobs.job.approved",
    app: "jobs",
    message: `Your job "${jobTitle}" was approved and is live`,
    link: jobsLink(`/jobs/${jobId}`),
  });
});
onDomainEvent("jobs.job.rejected", ({ recipientId, jobId, jobTitle, reason }) => {
  void notify({
    recipientId,
    type: "jobs.job.rejected",
    app: "jobs",
    message: `Your job "${jobTitle}" was not approved${reason ? `: ${reason}` : ""}`,
    link: jobsLink(`/employer/jobs/${jobId}/edit`),
  });
});
onDomainEvent("jobs.company.member_invited", ({ actorId, recipientId, companyName }) => {
  void notify({
    recipientId,
    actorId,
    type: "jobs.company.member_invited",
    app: "jobs",
    message: `You were added to ${companyName} on Centoire Jobs`,
    link: jobsLink("/employer"),
  });
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
