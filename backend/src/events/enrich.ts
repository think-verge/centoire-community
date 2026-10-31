import type { CircleSnapshot, DomainEvent, DomainEventPayloads, PostSnapshot, UserSnapshot } from "@centoire/contracts";
import { Circle } from "../models/Circle.js";
import { Post } from "../models/Post.js";
import { User } from "../models/User.js";

async function userSnapshot(id: string): Promise<UserSnapshot | undefined> {
  const u = await User.findById(id).select("handle displayName avatarUrl").lean();
  if (!u) return undefined;
  return { id, handle: u.handle, displayName: u.displayName, avatarUrl: u.avatarUrl };
}

async function postSnapshot(id: string): Promise<PostSnapshot | undefined> {
  const p = await Post.findById(id).select("slug title").lean();
  return p ? { id, slug: p.slug, title: p.title } : undefined;
}

async function circleSnapshot(id: string): Promise<CircleSnapshot | undefined> {
  const c = await Circle.findById(id).select("slug name avatarUrl").lean();
  return c ? { id, slug: c.slug, name: c.name, avatarUrl: c.avatarUrl } : undefined;
}

/**
 * Cross-service consumers must not read core's collections, so snapshots of the
 * referenced actor/post/circle are attached when the event leaves core.
 */
export async function enrichEvent<T extends DomainEvent>(
  event: T,
  payload: DomainEventPayloads[T],
): Promise<DomainEventPayloads[T]> {
  const p = payload as Record<string, unknown>;
  const [actor, post, circle] = await Promise.all([
    typeof p.actorId === "string" ? userSnapshot(p.actorId) : event === "user.followed" ? userSnapshot(p.followerId as string) : undefined,
    typeof p.postId === "string" ? postSnapshot(p.postId) : undefined,
    typeof p.circleId === "string" ? circleSnapshot(p.circleId) : undefined,
  ]);
  return { ...payload, ...(actor && { actor }), ...(post && { post }), ...(circle && { circle }) };
}
