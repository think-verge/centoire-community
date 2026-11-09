import { Types } from "mongoose";
import type { PostLifecycleEventPayload } from "@centoire/contracts";
import { Circle } from "../models/Circle.js";
import { Post, type IPost } from "../models/Post.js";
import { emitDomainEvent } from "../events/eventBus.js";
import { ApiError } from "../utils/api-error.js";

export async function resolveCirclePrivacy(circleId?: Types.ObjectId | string | null): Promise<boolean> {
  if (!circleId) return false;
  const circle = await Circle.findById(circleId).select("isPrivate").lean();
  return Boolean(circle?.isPrivate);
}

export async function buildPostLifecyclePayload(post: IPost): Promise<PostLifecycleEventPayload> {
  const isCirclePrivate = await resolveCirclePrivacy(post.circleId);
  const payload: PostLifecycleEventPayload = {
    postId: post._id.toString(),
    title: post.title,
    excerpt: post.excerpt ?? "",
    aiSummary: post.aiSummary || undefined,
    hashtags: post.hashtags ?? [],
    authorId: post.authorId ? post.authorId.toString() : undefined,
    circleId: post.circleId ? post.circleId.toString() : undefined,
    curated: Boolean(post.curated),
    origin: post.origin,
    isCirclePrivate,
  };

  // Native posts supply full plain-text content; external posts use title + excerpt + summary only.
  if (post.origin === "native" && post.contentText) {
    payload.contentText = post.contentText;
  }

  return payload;
}

export async function emitPostLifecycleEvent(
  action: "post.created" | "post.updated",
  post: IPost,
): Promise<PostLifecycleEventPayload> {
  const payload = await buildPostLifecyclePayload(post);
  emitDomainEvent(action, payload);
  return payload;
}

export async function setPostCurated(postId: string, curated?: boolean): Promise<IPost> {
  if (!Types.ObjectId.isValid(postId)) throw new ApiError(404, "Post not found");
  const post = await Post.findById(postId);
  if (!post || post.status === "removed") throw new ApiError(404, "Post not found");

  post.curated = typeof curated === "boolean" ? curated : !post.curated;
  await post.save();

  if (post.status === "published") {
    await emitPostLifecycleEvent("post.updated", post);
  }

  return post;
}
