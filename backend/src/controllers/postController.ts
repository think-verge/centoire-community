import type { Request, Response } from "express";
import * as postService from "../services/postService.js";
import { serializePostCard, serializePostDetail } from "../services/postSerializer.js";
import { getViewerState } from "../services/voteService.js";

export async function create(req: Request, res: Response): Promise<void> {
  const post = await postService.createPost(req.user!.userId, req.body);
  await post.populate([
    { path: "authorId", select: "handle displayName avatarUrl" },
    { path: "tags", select: "name slug" },
    { path: "circleId", select: "name slug" },
  ]);
  res.status(201).json(serializePostCard(post));
}

export async function update(req: Request, res: Response): Promise<void> {
  const post = await postService.updatePost(req.user!.userId, req.params.id as string, req.body);
  await post.populate([
    { path: "authorId", select: "handle displayName avatarUrl" },
    { path: "tags", select: "name slug" },
    { path: "circleId", select: "name slug" },
  ]);
  res.json(serializePostDetail(post));
}

export async function publish(req: Request, res: Response): Promise<void> {
  const post = await postService.publishPost(req.user!.userId, req.params.id as string);
  await post.populate([
    { path: "authorId", select: "handle displayName avatarUrl" },
    { path: "tags", select: "name slug" },
    { path: "circleId", select: "name slug" },
  ]);
  res.json(serializePostCard(post));
}

export async function remove(req: Request, res: Response): Promise<void> {
  await postService.deletePost(req.user!.userId, req.user!.role, req.params.id as string);
  res.status(204).end();
}

export async function getBySlug(req: Request, res: Response): Promise<void> {
  const post = await postService.getBySlug(req.params.slug as string, req.user?.userId);
  if (post.status === "published") {
    void postService.incrementViews(post._id);
  }
  const viewer = await getViewerState(post._id.toString(), req.user?.userId);
  res.json(serializePostDetail(post, viewer));
}

export async function myDrafts(req: Request, res: Response): Promise<void> {
  const drafts = await postService.listDrafts(req.user!.userId);
  res.json(drafts.map((d) => serializePostCard(d)));
}
