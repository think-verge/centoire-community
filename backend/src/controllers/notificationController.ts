import type { Request, Response } from "express";
import * as notificationService from "../services/notificationService.js";
import type { INotification } from "../models/Notification.js";

interface PopulatedRef {
  _id: unknown;
  [key: string]: unknown;
}

function ref(value: unknown): PopulatedRef | null {
  if (value && typeof value === "object" && "_id" in value) return value as PopulatedRef;
  return null;
}

function serialize(notification: INotification) {
  const actor = ref(notification.actorId);
  const targetPost = ref(notification.targetPostId);
  return {
    id: notification._id.toString(),
    type: notification.type,
    actor: actor
      ? {
          id: String(actor._id),
          handle: (actor.handle as string) ?? null,
          displayName: (actor.displayName as string) ?? "",
          avatarUrl: (actor.avatarUrl as string) ?? null,
        }
      : null,
    targetPost: targetPost
      ? {
          id: String(targetPost._id),
          slug: (targetPost.slug as string) ?? "",
          title: (targetPost.title as string) ?? "",
        }
      : null,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  };
}

export async function list(req: Request, res: Response): Promise<void> {
  const { cursor } = (req.validatedQuery ?? {}) as { cursor?: string };
  const page = await notificationService.listForUser(req.user!.userId, cursor);
  res.json({ items: page.items.map(serialize), nextCursor: page.nextCursor });
}

export async function unreadCount(req: Request, res: Response): Promise<void> {
  const count = await notificationService.unreadCount(req.user!.userId);
  res.json({ count });
}

export async function markRead(req: Request, res: Response): Promise<void> {
  await notificationService.markRead(req.user!.userId, req.params.id as string);
  res.status(204).end();
}

export async function markAllRead(req: Request, res: Response): Promise<void> {
  await notificationService.markAllRead(req.user!.userId);
  res.status(204).end();
}
