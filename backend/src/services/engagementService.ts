import { Types } from "mongoose";
import { Bookmark, BookmarkFolder } from "../models/Bookmark.js";
import { Comment, type IComment } from "../models/Comment.js";
import { Post } from "../models/Post.js";
import { Vote, type VoteTargetType } from "../models/Vote.js";
import { ApiError } from "../utils/api-error.js";
import * as reputationService from "./reputationService.js";

const REP_BY_TARGET: Record<VoteTargetType, { type: "post_upvoted" | "comment_upvoted"; amount: number }> = {
  post: { type: "post_upvoted", amount: 10 },
  comment: { type: "comment_upvoted", amount: 5 },
};

async function getTarget(targetType: VoteTargetType, targetId: string) {
  if (!Types.ObjectId.isValid(targetId)) throw new ApiError(404, "Not found");
  if (targetType === "post") {
    const post = await Post.findById(targetId);
    if (!post || post.status !== "published") throw new ApiError(404, "Post not found");
    return { authorId: post.authorId?.toString() ?? null, model: Post };
  }
  const comment = await Comment.findById(targetId);
  if (!comment || comment.status !== "active") throw new ApiError(404, "Comment not found");
  return { authorId: comment.authorId.toString(), model: Comment };
}

function counterField(value: 1 | -1): "upvoteCount" | "downvoteCount" {
  return value === 1 ? "upvoteCount" : "downvoteCount";
}

export async function setVote(
  userId: string,
  targetType: VoteTargetType,
  targetId: string,
  value: 1 | -1,
): Promise<void> {
  const target = await getTarget(targetType, targetId);
  const existing = await Vote.findOne({ userId, targetType, targetId });

  if (existing?.value === value) return;

  const Model = target.model as typeof Post & typeof Comment;
  const rep = REP_BY_TARGET[targetType];
  const isSelfVote = target.authorId === userId;

  if (existing) {
    // switching direction: undo old counter, apply new
    await Model.updateOne({ _id: targetId }, { $inc: { [counterField(existing.value)]: -1 } });
    existing.value = value;
    await existing.save();
  } else {
    await Vote.create({ userId, targetType, targetId, value });
  }
  await Model.updateOne({ _id: targetId }, { $inc: { [counterField(value)]: 1 } });

  // Reputation: only first-time upvotes on someone else's work award points
  if (value === 1 && !isSelfVote && target.authorId && !existing) {
    await reputationService.award(target.authorId, {
      type: rep.type,
      refType: targetType,
      refId: targetId,
      actorId: userId,
    });
  }
}

export async function removeVote(
  userId: string,
  targetType: VoteTargetType,
  targetId: string,
): Promise<void> {
  const vote = await Vote.findOneAndDelete({ userId, targetType, targetId });
  if (!vote) return;
  const target = await getTarget(targetType, targetId).catch(() => null);
  if (!target) return;
  const Model = target.model as typeof Post & typeof Comment;
  await Model.updateOne({ _id: targetId }, { $inc: { [counterField(vote.value)]: -1 } });

  if (vote.value === 1 && target.authorId && target.authorId !== userId) {
    await reputationService.award(target.authorId, {
      type: "vote_removed",
      refType: targetType,
      refId: targetId,
      actorId: userId,
      amount: -REP_BY_TARGET[targetType].amount,
    });
  }
}

// --- Bookmarks ---

export async function setBookmark(
  userId: string,
  postId: string,
  folderId?: string | null,
): Promise<void> {
  const post = await Post.findById(postId);
  if (!post || post.status !== "published") throw new ApiError(404, "Post not found");
  if (folderId) {
    const folder = await BookmarkFolder.findOne({ _id: folderId, userId });
    if (!folder) throw new ApiError(404, "Folder not found");
  }
  const existing = await Bookmark.findOneAndUpdate(
    { userId, postId },
    { $set: { folderId: folderId ?? null } },
    { upsert: false },
  );
  if (!existing) {
    await Bookmark.create({ userId, postId, folderId: folderId ?? null });
    await Post.updateOne({ _id: postId }, { $inc: { bookmarkCount: 1 } });
  }
}

export async function removeBookmark(userId: string, postId: string): Promise<void> {
  const deleted = await Bookmark.findOneAndDelete({ userId, postId });
  if (deleted) {
    await Post.updateOne({ _id: postId }, { $inc: { bookmarkCount: -1 } });
  }
}

export async function listBookmarkFolders(userId: string) {
  const folders = await BookmarkFolder.find({ userId }).sort({ name: 1 });
  const counts = await Bookmark.aggregate<{ _id: Types.ObjectId | null; count: number }>([
    { $match: { userId: new Types.ObjectId(userId) } },
    { $group: { _id: "$folderId", count: { $sum: 1 } } },
  ]);
  const countByFolder = new Map(counts.map((c) => [String(c._id), c.count]));
  return {
    folders: folders.map((f) => ({
      id: f._id.toString(),
      name: f.name,
      count: countByFolder.get(f._id.toString()) ?? 0,
    })),
    unfiledCount: countByFolder.get("null") ?? 0,
  };
}

export async function createBookmarkFolder(userId: string, name: string) {
  try {
    const folder = await BookmarkFolder.create({ userId, name });
    return { id: folder._id.toString(), name: folder.name, count: 0 };
  } catch (err: unknown) {
    if ((err as { code?: number }).code === 11000) {
      throw new ApiError(409, "You already have a folder with this name");
    }
    throw err;
  }
}

export async function deleteBookmarkFolder(userId: string, folderId: string): Promise<void> {
  const folder = await BookmarkFolder.findOneAndDelete({ _id: folderId, userId });
  if (!folder) throw new ApiError(404, "Folder not found");
  // bookmarks fall back to the default (unfiled) list
  await Bookmark.updateMany({ userId, folderId }, { $set: { folderId: null } });
}

export async function listBookmarkedPostIds(
  userId: string,
  folderId?: string,
): Promise<Types.ObjectId[]> {
  const filter: Record<string, unknown> = { userId };
  if (folderId) filter.folderId = folderId;
  const bookmarks = await Bookmark.find(filter).sort({ createdAt: -1 }).limit(100);
  return bookmarks.map((b) => b.postId);
}

// --- Comments ---

export async function createComment(
  userId: string,
  postId: string,
  content: string,
  parentId?: string,
): Promise<IComment> {
  const post = await Post.findById(postId);
  if (!post || post.status !== "published") throw new ApiError(404, "Post not found");

  let depth = 0;
  if (parentId) {
    const parent = await Comment.findById(parentId);
    if (!parent || parent.postId.toString() !== postId) {
      throw new ApiError(404, "Parent comment not found");
    }
    depth = Math.min(parent.depth + 1, 2);
  }

  const comment = await Comment.create({
    postId,
    authorId: userId,
    parentId: parentId ?? undefined,
    depth,
    content,
  });
  await Post.updateOne({ _id: postId }, { $inc: { commentCount: 1 } });
  if (parentId) {
    await Comment.updateOne({ _id: parentId }, { $inc: { replyCount: 1 } });
  }
  return comment.populate("authorId", "handle displayName avatarUrl reputation");
}

export async function updateComment(
  userId: string,
  commentId: string,
  content: string,
): Promise<IComment> {
  const comment = await Comment.findById(commentId);
  if (!comment || comment.status !== "active") throw new ApiError(404, "Comment not found");
  if (comment.authorId.toString() !== userId) {
    throw new ApiError(403, "You can only edit your own comments");
  }
  comment.content = content;
  await comment.save();
  return comment.populate("authorId", "handle displayName avatarUrl reputation");
}

export async function deleteComment(
  userId: string,
  role: string,
  commentId: string,
): Promise<void> {
  const comment = await Comment.findById(commentId);
  if (!comment || comment.status !== "active") throw new ApiError(404, "Comment not found");
  if (comment.authorId.toString() !== userId && role !== "admin") {
    throw new ApiError(403, "You cannot delete this comment");
  }
  comment.status = "deleted";
  comment.content = "";
  await comment.save();
  await Post.updateOne({ _id: comment.postId }, { $inc: { commentCount: -1 } });
}

export interface CommentNode {
  id: string;
  content: string;
  status: "active" | "deleted";
  depth: number;
  upvoteCount: number;
  replyCount: number;
  createdAt: string;
  author: {
    id: string;
    handle: string | null;
    displayName: string;
    avatarUrl: string | null;
    reputation: number;
  } | null;
  viewerVoted: boolean;
  replies: CommentNode[];
}

export async function listComments(postId: string, viewerId?: string): Promise<CommentNode[]> {
  const comments = await Comment.find({ postId })
    .sort({ createdAt: 1 })
    .populate("authorId", "handle displayName avatarUrl reputation");

  const viewerUpvotes = new Set<string>();
  if (viewerId && comments.length) {
    const votes = await Vote.find({
      userId: viewerId,
      targetType: "comment",
      targetId: { $in: comments.map((c) => c._id) },
      value: 1,
    });
    for (const vote of votes) viewerUpvotes.add(vote.targetId.toString());
  }

  const nodes = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];

  for (const comment of comments) {
    const author = comment.authorId as unknown as {
      _id: unknown;
      handle?: string;
      displayName?: string;
      avatarUrl?: string;
      reputation?: number;
    } | null;
    const node: CommentNode = {
      id: comment._id.toString(),
      content: comment.status === "deleted" ? "" : comment.content,
      status: comment.status,
      depth: comment.depth,
      upvoteCount: comment.upvoteCount,
      replyCount: comment.replyCount,
      createdAt: comment.createdAt.toISOString(),
      author:
        comment.status === "deleted" || !author
          ? null
          : {
              id: String(author._id),
              handle: author.handle ?? null,
              displayName: author.displayName ?? "",
              avatarUrl: author.avatarUrl ?? null,
              reputation: author.reputation ?? 0,
            },
      viewerVoted: viewerUpvotes.has(comment._id.toString()),
      replies: [],
    };
    nodes.set(node.id, node);
    const parentNode = comment.parentId ? nodes.get(comment.parentId.toString()) : null;
    if (parentNode) parentNode.replies.push(node);
    else roots.push(node);
  }

  // hide deleted leaves (keep deleted nodes that still hold replies)
  function prune(list: CommentNode[]): CommentNode[] {
    return list
      .map((n) => ({ ...n, replies: prune(n.replies) }))
      .filter((n) => n.status === "active" || n.replies.length > 0);
  }
  return prune(roots);
}
