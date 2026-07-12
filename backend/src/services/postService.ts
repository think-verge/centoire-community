import { Types } from "mongoose";
import { Circle } from "../models/Circle.js";
import { CircleMembership } from "../models/CircleMembership.js";
import { Post, type IPost } from "../models/Post.js";
import { Tag } from "../models/Tag.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/api-error.js";
import { readTimeMinutes, tiptapToPlainText } from "../utils/read-time.js";
import { slugifyWithId } from "../utils/slugify.js";
import * as reputationService from "./reputationService.js";

interface PostInput {
  title: string;
  content?: unknown;
  tagIds?: string[];
  circleId?: string | null;
  coverImageUrl?: string | null;
  status?: "draft" | "published";
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
    return publishPost(userId, post._id.toString());
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

export async function publishPost(userId: string, postId: string): Promise<IPost> {
  const post = await getOwnPost(userId, postId);
  if (post.status === "published") return post;
  if (!post.title.trim()) throw new ApiError(422, "Give your post a title before publishing");
  if (!post.contentText?.trim()) {
    throw new ApiError(422, "Write something before publishing");
  }
  const firstPublish = !post.publishedAt;
  post.status = "published";
  post.publishedAt = post.publishedAt ?? new Date();
  await post.save();

  if (firstPublish) {
    await User.updateOne({ _id: post.authorId }, { $inc: { postCount: 1 } });
    if (post.tags.length) {
      await Tag.updateMany({ _id: { $in: post.tags } }, { $inc: { postCount: 1 } });
    }
    if (post.circleId) {
      await Circle.updateOne({ _id: post.circleId }, { $inc: { postCount: 1 } });
    }
    await reputationService.award(post.authorId!.toString(), {
      type: "post_published",
      refType: "post",
      refId: post._id.toString(),
    });
  }
  return post;
}

export async function deletePost(
  userId: string,
  role: "member" | "admin",
  postId: string,
): Promise<void> {
  const post = await Post.findById(postId);
  if (!post || post.status === "removed") throw new ApiError(404, "Post not found");
  const isOwner = post.authorId?.toString() === userId;
  if (!isOwner && role !== "admin") throw new ApiError(403, "You cannot delete this post");
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

export async function getBySlug(slug: string, viewerId?: string): Promise<IPost> {
  const post = await Post.findOne({ slug })
    .populate("authorId", "handle displayName avatarUrl reputation")
    .populate("sourceId", "name siteUrl faviconUrl")
    .populate("tags", "name slug")
    .populate("circleId", "name slug");
  if (!post || post.status === "removed") throw new ApiError(404, "Post not found");
  if (post.status === "draft" && post.authorId?._id?.toString() !== viewerId) {
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
