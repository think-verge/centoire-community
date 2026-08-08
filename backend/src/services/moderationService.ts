import { Types } from "mongoose";
import { Post, type IPost } from "../models/Post.js";
import { Tag } from "../models/Tag.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/api-error.js";
import { finalizePublish } from "./postService.js";

const QUEUE_PAGE_SIZE = 20;

export interface QueuePage {
  items: IPost[];
  nextCursor: string | null;
}

export interface QueueParams {
  cursor?: string;
  status?: "pending_review" | "rejected" | "all";
  origin?: "native" | "aggregated";
  source?: string;
  tag?: string;
  author?: string;
}

export async function listQueue(params: QueueParams = {}): Promise<QueuePage> {
  const filter: Record<string, unknown> = {};

  // Status filter (defaults to pending_review)
  if (params.status === "all") {
    filter.status = { $in: ["pending_review", "rejected"] };
  } else {
    filter.status = params.status ?? "pending_review";
  }

  // Cursor-based pagination
  if (params.cursor) {
    const { id } = JSON.parse(Buffer.from(params.cursor, "base64url").toString());
    filter._id = { $gt: new Types.ObjectId(id) };
  }

  // Origin filter
  if (params.origin) filter.origin = params.origin;

  // Source filter (sourceId string → ObjectId)
  if (params.source && Types.ObjectId.isValid(params.source)) {
    filter.sourceId = new Types.ObjectId(params.source);
  }

  // Tag filter (slug → ObjectId)
  if (params.tag) {
    const tag = await Tag.findOne({ slug: params.tag }).select("_id").lean();
    if (tag) filter.tags = tag._id;
  }

  // Author filter (email → userId); return empty results if user not found
  if (params.author) {
    const user = await User.findOne({ email: params.author }).select("_id").lean();
    if (!user) return { items: [], nextCursor: null };
    filter.authorId = user._id;
  }

  const items = await Post.find(filter)
    .sort({ createdAt: 1, _id: 1 })
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
