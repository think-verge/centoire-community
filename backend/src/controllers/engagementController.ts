import type { Request, Response } from "express";
import * as engagementService from "../services/engagementService.js";
import { Post } from "../models/Post.js";
import { serializePostCard } from "../services/postSerializer.js";
import { Vote } from "../models/Vote.js";

export async function votePost(req: Request, res: Response): Promise<void> {
  await engagementService.setVote(req.user!.userId, "post", req.params.id as string, req.body.value);
  res.status(204).end();
}

export async function unvotePost(req: Request, res: Response): Promise<void> {
  await engagementService.removeVote(req.user!.userId, "post", req.params.id as string);
  res.status(204).end();
}

export async function voteComment(req: Request, res: Response): Promise<void> {
  await engagementService.setVote(
    req.user!.userId,
    "comment",
    req.params.id as string,
    req.body.value,
  );
  res.status(204).end();
}

export async function unvoteComment(req: Request, res: Response): Promise<void> {
  await engagementService.removeVote(req.user!.userId, "comment", req.params.id as string);
  res.status(204).end();
}

export async function bookmarkPost(req: Request, res: Response): Promise<void> {
  await engagementService.setBookmark(
    req.user!.userId,
    req.params.id as string,
    req.body?.folderId ?? null,
  );
  res.status(204).end();
}

export async function unbookmarkPost(req: Request, res: Response): Promise<void> {
  await engagementService.removeBookmark(req.user!.userId, req.params.id as string);
  res.status(204).end();
}

export async function listBookmarks(req: Request, res: Response): Promise<void> {
  const { folderId } = (req.validatedQuery ?? {}) as { folderId?: string };
  const postIds = await engagementService.listBookmarkedPostIds(req.user!.userId, folderId);
  const posts = await Post.find({ _id: { $in: postIds }, status: "published" }).populate([
    { path: "authorId", select: "handle displayName avatarUrl" },
    { path: "sourceId", select: "name siteUrl faviconUrl" },
    { path: "tags", select: "name slug" },
    { path: "circleId", select: "name slug" },
  ]);
  const byId = new Map(posts.map((p) => [p._id.toString(), p]));
  const ordered = postIds
    .map((id) => byId.get(id.toString()))
    .filter((p): p is NonNullable<typeof p> => Boolean(p));

  const votes = await Vote.find({
    userId: req.user!.userId,
    targetType: "post",
    targetId: { $in: postIds },
  });
  const votedById = new Map(votes.map((v) => [v.targetId.toString(), v.value]));

  res.json(
    ordered.map((p) =>
      serializePostCard(p, {
        voted: votedById.get(p._id.toString()) ?? null,
        bookmarked: true,
      }),
    ),
  );
}

export async function listFolders(req: Request, res: Response): Promise<void> {
  res.json(await engagementService.listBookmarkFolders(req.user!.userId));
}

export async function createFolder(req: Request, res: Response): Promise<void> {
  const folder = await engagementService.createBookmarkFolder(req.user!.userId, req.body.name);
  res.status(201).json(folder);
}

export async function deleteFolder(req: Request, res: Response): Promise<void> {
  await engagementService.deleteBookmarkFolder(req.user!.userId, req.params.id as string);
  res.status(204).end();
}

export async function listComments(req: Request, res: Response): Promise<void> {
  const comments = await engagementService.listComments(
    req.params.id as string,
    req.user?.userId,
  );
  res.json(comments);
}

export async function createComment(req: Request, res: Response): Promise<void> {
  const comment = await engagementService.createComment(
    req.user!.userId,
    req.params.id as string,
    req.body.content,
    req.body.parentId,
  );
  res.status(201).json({ id: comment._id.toString() });
}

export async function updateComment(req: Request, res: Response): Promise<void> {
  await engagementService.updateComment(req.user!.userId, req.params.id as string, req.body.content);
  res.status(204).end();
}

export async function deleteComment(req: Request, res: Response): Promise<void> {
  await engagementService.deleteComment(
    req.user!.userId,
    req.user!.role,
    req.params.id as string,
  );
  res.status(204).end();
}

export async function reportPost(req: Request, res: Response): Promise<void> {
  const { PostReport } = await import("../models/PostReport.js");
  const reporterId = req.user?.userId;
  if (reporterId) {
    const existing = await PostReport.findOne({ postId: req.params.id, reporterId });
    if (existing) {
      res.json({ alreadyReported: true, message: "Post already reported" });
      return;
    }
  }
  await PostReport.create({
    postId: req.params.id,
    reporterId,
    reason: req.body?.reason ?? "Reported by user",
  });
  res.status(201).json({ reported: true });
}

export async function notInterested(req: Request, res: Response): Promise<void> {
  const { User } = await import("../models/User.js");
  const { Types } = await import("mongoose");
  if (req.user?.userId && Types.ObjectId.isValid(req.params.id as string)) {
    await User.updateOne(
      { _id: req.user.userId },
      { $addToSet: { dismissedPosts: new Types.ObjectId(req.params.id as string) } },
    );
  }
  res.status(204).end();
}

export async function followPostSource(req: Request, res: Response): Promise<void> {
  const { Post } = await import("../models/Post.js");
  const { Source } = await import("../models/Source.js");
  const { followSource } = await import("../services/userService.js");
  const post = await Post.findById(req.params.id);
  if (!post) {
    res.status(404).json({ message: "Post not found" });
    return;
  }
  let sId = post.sourceId?.toString();
  if (!sId && post.externalUrl) {
    try {
      const u = new URL(post.externalUrl);
      const hostname = u.hostname.replace(/^www\./, "");
      let existing = await Source.findOne({ siteUrl: new RegExp(hostname, "i") });
      if (!existing) {
        existing = await Source.create({
          name: hostname.split(".")[0].toUpperCase(),
          siteUrl: `${u.protocol}//${u.host}`,
          feedUrl: `${u.protocol}//${u.host}/rss`,
          createdBy: req.user!.userId,
        });
      }
      sId = existing._id.toString();
      await Post.updateOne({ _id: post._id }, { sourceId: existing._id });
    } catch {
      // ignore
    }
  }
  if (!sId) {
    res.status(404).json({ message: "Post or source not found" });
    return;
  }
  await followSource(req.user!.userId, sId);
  res.status(204).end();
}

export async function unfollowPostSource(req: Request, res: Response): Promise<void> {
  const { Post } = await import("../models/Post.js");
  const { Source } = await import("../models/Source.js");
  const { unfollowSource } = await import("../services/userService.js");
  const post = await Post.findById(req.params.id);
  if (!post) {
    res.status(404).json({ message: "Post not found" });
    return;
  }
  let sId = post.sourceId?.toString();
  if (!sId && post.externalUrl) {
    try {
      const hostname = new URL(post.externalUrl).hostname.replace(/^www\./, "");
      const existing = await Source.findOne({ siteUrl: new RegExp(hostname, "i") });
      if (existing) {
        sId = existing._id.toString();
      }
    } catch {
      // ignore
    }
  }
  if (!sId) {
    res.status(404).json({ message: "Post or source not found" });
    return;
  }
  await unfollowSource(req.user!.userId, sId);
  res.status(204).end();
}

