import { Types } from "mongoose";
import { Post, type IPost } from "../models/Post.js";
import { ApiError } from "../utils/api-error.js";
import { finalizePublish } from "./postService.js";

const QUEUE_PAGE_SIZE = 20;

export interface QueuePage {
  items: IPost[];
  nextCursor: string | null;
}

export async function listQueue(cursor?: string): Promise<QueuePage> {
  const filter: Record<string, unknown> = { status: "pending_review" };
  if (cursor) {
    const { id } = JSON.parse(Buffer.from(cursor, "base64url").toString());
    filter._id = { $gt: new Types.ObjectId(id) };
  }

  const items = await Post.find(filter)
    .sort({ createdAt: 1, _id: 1 }) // oldest pending first
    .limit(QUEUE_PAGE_SIZE + 1)
    .populate("authorId", "handle displayName avatarUrl role")
    .populate("sourceId", "name siteUrl faviconUrl")
    .populate("tags", "name slug")
    .populate("circleId", "name slug");

  const hasMore = items.length > QUEUE_PAGE_SIZE;
  if (hasMore) items.pop();

  const nextCursor = hasMore
    ? Buffer.from(JSON.stringify({ id: items[items.length - 1]._id.toString() })).toString("base64url")
    : null;

  return { items, nextCursor };
}

export async function approve(editorId: string, postId: string): Promise<IPost> {
  if (!Types.ObjectId.isValid(postId)) throw new ApiError(404, "Post not found");
  const post = await Post.findOne({ _id: postId, status: "pending_review" });
  if (!post) throw new ApiError(404, "Post not found or not pending review");

  // reviewedBy is set to the human editor; finalizePublish sets reviewedAt and status
  post.reviewedBy = new Types.ObjectId(editorId);
  await finalizePublish(post);
  return post;
}

export async function reject(editorId: string, postId: string, reason: string): Promise<IPost> {
  if (!Types.ObjectId.isValid(postId)) throw new ApiError(404, "Post not found");
  const post = await Post.findOne({ _id: postId, status: "pending_review" });
  if (!post) throw new ApiError(404, "Post not found or not pending review");

  post.status = "rejected";
  post.reviewedBy = new Types.ObjectId(editorId);
  post.reviewedAt = new Date();
  post.rejectionReason = reason;
  await post.save();
  return post;
}
