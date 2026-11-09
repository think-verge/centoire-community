import { normalizeHashtag } from "../utils/hashtag.js";
import { Types } from "mongoose";
import { Post, type IPost } from "../models/Post.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/api-error.js";
import { emitRejection, finalizePublish } from "./postService.js";

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
  hashtag?: string;
  author?: string;
  sort?: "oldest" | "momentum";
}

export async function listQueue(params: QueueParams = {}): Promise<QueuePage> {
  const filter: Record<string, unknown> = {};

  // Status filter (defaults to pending_review)
  if (params.status === "all") {
    filter.status = { $in: ["pending_review", "rejected"] };
  } else {
    filter.status = params.status ?? "pending_review";
  }

  if ((params.sort ?? "momentum") === "momentum") return listByMomentum(filter, params);

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

  // Hashtag filter (normalized name)
  if (params.hashtag) {
    const name = normalizeHashtag(params.hashtag);
    if (name) filter.hashtags = name;
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
    .populate("circleId", "name slug");

  const hasMore = items.length > QUEUE_PAGE_SIZE;
  if (hasMore) items.pop();

  const nextCursor = hasMore
    ? Buffer.from(JSON.stringify({ id: items[items.length - 1]._id.toString() })).toString("base64url")
    : null;

  return { items, nextCursor };
}

/** Breaking → rising → early → posts without a tag (user posts, RSS imports) → steady → settled.
 *  Within a tag the most widely covered story comes first, then the newest. The engine's ranks are
 *  0-4 (breaking..settled); untagged posts sit at 2.5 so they're never buried under quiet stories.
 *  The order isn't monotonic in _id, so this pages by offset. */
async function listByMomentum(filter: Record<string, unknown>, params: QueueParams): Promise<QueuePage> {
  const offset = params.cursor
    ? Number(JSON.parse(Buffer.from(params.cursor, "base64url").toString()).offset ?? 0)
    : 0;
  const rows = await Post.aggregate<{ _id: Types.ObjectId }>([
    { $match: filter },
    {
      $addFields: {
        _rank: { $ifNull: ["$discovery.momentum.rank", 2.5] },
        _websites: { $ifNull: ["$discovery.websiteCount", 0] },
      },
    },
    { $sort: { _rank: 1, _websites: -1, createdAt: -1, _id: -1 } },
    { $skip: offset },
    { $limit: QUEUE_PAGE_SIZE + 1 },
    { $project: { _id: 1 } },
  ]);
  const hasMore = rows.length > QUEUE_PAGE_SIZE;
  const ids = rows.slice(0, QUEUE_PAGE_SIZE).map((r) => r._id);
  const docs = await Post.find({ _id: { $in: ids } })
    .populate("authorId", "handle displayName avatarUrl role")
    .populate("sourceId", "name siteUrl faviconUrl")
    .populate("circleId", "name slug");
  const byId = new Map(docs.map((d) => [d._id.toString(), d]));
  const items = ids.map((id) => byId.get(id.toString())).filter((d): d is NonNullable<typeof d> => Boolean(d));
  const nextCursor = hasMore
    ? Buffer.from(JSON.stringify({ offset: offset + QUEUE_PAGE_SIZE })).toString("base64url")
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
  emitRejection(post);
  return post;
}
