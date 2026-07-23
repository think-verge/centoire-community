import { Types } from "mongoose";
import { Circle } from "../models/Circle.js";
import { CircleMembership } from "../models/CircleMembership.js";
import { Post, type IPost } from "../models/Post.js";
import { Tag } from "../models/Tag.js";
import { User, type UserRole } from "../models/User.js";
import { ApiError } from "../utils/api-error.js";
import { readTimeMinutes, tiptapToPlainText } from "../utils/read-time.js";
import { slugifyWithId } from "../utils/slugify.js";
import { hasPermission } from "../config/permissions.js";
import * as reputationService from "./reputationService.js";
import { evaluate as evaluatePolicy } from "./policyService.js";

interface PostInput {
  title: string;
  content?: unknown;
  tagIds?: string[];
  circleId?: string | null;
  coverImageUrl?: string | null;
  status?: "draft" | "published";
  role?: UserRole;
}

function deriveTextFields(post: IPost): void {
  const text = post.content ? tiptapToPlainText(post.content) : "";
  post.contentText = text;
  post.excerpt = text.slice(0, 300);
  post.readTimeMinutes = readTimeMinutes(text);
}

async function assertCircleMember(circleId: string, userId: string): Promise<void> {
  const membership = await CircleMembership.findOne({ circleId, userId });
  if (!membership) throw new ApiError(422, "Join the circle before posting to it");
}

export async function createPost(userId: string, input: PostInput): Promise<IPost> {
  if (input.circleId) await assertCircleMember(input.circleId, userId);
  const post = new Post({
    origin: "native",
    status: "draft",
    authorId: userId,
    title: input.title,
    slug: slugifyWithId(input.title),
    content: input.content,
    tags: input.tagIds ?? [],
    circleId: input.circleId ?? undefined,
    coverImageUrl: input.coverImageUrl ?? undefined,
  });
  deriveTextFields(post);
  await post.save();
  if (input.status === "published") {
    return publishPost(userId, post._id.toString(), input.role ?? "member");
  }
  return post;
}

export async function updatePost(
  userId: string,
  postId: string,
  input: Partial<PostInput>,
): Promise<IPost> {
  const post = await getOwnPost(userId, postId);
  if (input.circleId) await assertCircleMember(input.circleId, userId);

  if (input.title !== undefined) post.title = input.title;
  if (input.content !== undefined) post.content = input.content;
  if (input.tagIds !== undefined) {
    post.tags = input.tagIds.map((id) => new Types.ObjectId(id));
  }
  if (input.circleId !== undefined) {
    post.circleId = input.circleId ? new Types.ObjectId(input.circleId) : undefined;
  }
  if (input.coverImageUrl !== undefined) {
    post.coverImageUrl = input.coverImageUrl ?? undefined;
  }
  deriveTextFields(post);
  await post.save();
  return post;
}

// finalizePublish handles all side effects when a post reaches "published" status.
// Called by both publishPost (bypass path) and moderationService.approve (editor path).
// Safe to call on aggregated posts — null-guards authorId before touching user/reputation.
export async function finalizePublish(post: IPost): Promise<void> {
  const firstPublish = !post.publishedAt;
  post.status = "published";
  post.publishedAt = post.publishedAt ?? new Date();
  post.reviewedAt = post.reviewedAt ?? new Date();
  await post.save();

  if (firstPublish) {
    if (post.authorId) {
      await User.updateOne({ _id: post.authorId }, { $inc: { postCount: 1 } });
    }
    if (post.tags.length) {
      await Tag.updateMany({ _id: { $in: post.tags } }, { $inc: { postCount: 1 } });
    }
    if (post.circleId) {
      await Circle.updateOne({ _id: post.circleId }, { $inc: { postCount: 1 } });
    }
    if (post.authorId) {
      await reputationService.award(post.authorId.toString(), {
        type: "post_published",
        refType: "post",
        refId: post._id.toString(),
      });
    }
  }
}

export async function publishPost(userId: string, postId: string, role: UserRole): Promise<IPost> {
  const post = await getOwnPost(userId, postId);
  // Idempotent: already in a terminal or queued state
  if (post.status === "published" || post.status === "pending_review") return post;
  if (!post.title.trim()) throw new ApiError(422, "Give your post a title before publishing");
  if (!post.contentText?.trim()) throw new ApiError(422, "Write something before publishing");

  if (hasPermission(role, "post.bypass_queue")) {
    // Creators, editors, admins bypass the moderation queue
    await finalizePublish(post);
    return post;
  }

  // Check if a moderation policy auto-approves or auto-rejects this author
  const policyOutcome = await evaluatePolicy({ authorId: post.authorId?.toString() });
  if (policyOutcome === "auto_approve") {
    await finalizePublish(post);
    return post;
  }
  if (policyOutcome === "auto_reject") {
    post.status = "rejected";
    post.reviewedAt = new Date();
    post.rejectionReason = "Rejected by moderation policy";
    await post.save();
    return post;
  }

  // Default: enter the moderation queue
  post.status = "pending_review";
  await post.save();
  return post;
}

export async function deletePost(
  userId: string,
  role: UserRole,
  postId: string,
): Promise<void> {
  const post = await Post.findById(postId);
  if (!post || post.status === "removed") throw new ApiError(404, "Post not found");
  const isOwner = post.authorId?.toString() === userId;
  const canModerate = role === "admin" || role === "editor";
  if (!isOwner && !canModerate) throw new ApiError(403, "You cannot delete this post");
  post.status = "removed";
  await post.save();
}

async function getOwnPost(userId: string, postId: string): Promise<IPost> {
  if (!Types.ObjectId.isValid(postId)) throw new ApiError(404, "Post not found");
  const post = await Post.findById(postId);
  if (!post || post.status === "removed") throw new ApiError(404, "Post not found");
  if (post.authorId?.toString() !== userId) {
    throw new ApiError(403, "You can only edit your own posts");
  }
  return post;
}

export async function getBySlug(
  slug: string,
  viewerId?: string,
  viewerRole?: UserRole,
): Promise<IPost> {
  const post = await Post.findOne({ slug })
    .populate("authorId", "handle displayName avatarUrl reputation")
    .populate("sourceId", "name siteUrl faviconUrl")
    .populate("tags", "name slug")
    .populate("circleId", "name slug");
  if (!post || post.status === "removed") throw new ApiError(404, "Post not found");
  const isAuthor = post.authorId?._id?.toString() === viewerId;
  const canModerate = viewerRole === "editor" || viewerRole === "admin";
  if (post.status === "draft" && !isAuthor) throw new ApiError(404, "Post not found");
  if (post.status === "pending_review" && !isAuthor && !canModerate) {
    throw new ApiError(404, "Post not found");
  }
  if (post.status === "rejected" && !isAuthor && !canModerate) {
    throw new ApiError(404, "Post not found");
  }
  return post;
}

export async function incrementViews(postId: Types.ObjectId): Promise<void> {
  await Post.updateOne({ _id: postId }, { $inc: { viewCount: 1 } });
}

export async function listDrafts(userId: string): Promise<IPost[]> {
  return Post.find({ authorId: userId, status: "draft" })
    .sort({ updatedAt: -1 })
    .populate("tags", "name slug")
    .populate("circleId", "name slug");
}
