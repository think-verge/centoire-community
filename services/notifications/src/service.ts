import { ApiError, decodeCursor, encodeCursor } from "@centoire/bahamut";
import { Types } from "mongoose";
import { Notification, type INotification, type NotificationType } from "./model.js";

const PAGE_SIZE = 20;

export interface NotifyInput {
  recipientId: string;
  actorId?: string;
  type: NotificationType;
  actor?: INotification["actor"];
  targetPostId?: string;
  targetPost?: INotification["targetPost"];
  targetCommentId?: string;
  targetCircleId?: string;
  targetCircle?: INotification["targetCircle"];
  targetInviteToken?: string;
}

export async function notify(input: NotifyInput): Promise<void> {
  if (input.actorId && input.actorId === input.recipientId) return; // never notify yourself
  await Notification.create(input);
}

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
    .limit(PAGE_SIZE + 1);

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
  if (!Types.ObjectId.isValid(notificationId)) throw new ApiError(404, "Notification not found");
  const notification = await Notification.findOne({ _id: notificationId, recipientId: userId });
  if (!notification) throw new ApiError(404, "Notification not found");
  if (!notification.readAt) {
    notification.readAt = new Date();
    await notification.save();
  }
}

export async function markAllRead(userId: string): Promise<void> {
  await Notification.updateMany({ recipientId: userId, readAt: { $exists: false } }, { $set: { readAt: new Date() } });
}

export async function deleteForUser(userId: string): Promise<void> {
  await Notification.deleteMany({ $or: [{ recipientId: userId }, { actorId: userId }] });
}
