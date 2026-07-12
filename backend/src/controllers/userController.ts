import type { Request, Response } from "express";
import { Post } from "../models/Post.js";
import { serializePostCard } from "../services/postSerializer.js";
import * as userService from "../services/userService.js";
import { serializeUser } from "../services/userSerializer.js";

export async function getByHandle(req: Request, res: Response): Promise<void> {
  const user = await userService.getByHandle(req.params.handle as string);
  const isFollowing = req.user
    ? await userService.isFollowing(req.user.userId, user._id.toString())
    : false;
  res.json({ ...serializeUser(user), isFollowing });
}

export async function getUserPosts(req: Request, res: Response): Promise<void> {
  const user = await userService.getByHandle(req.params.handle as string);
  const posts = await Post.find({ authorId: user._id, status: "published" })
    .sort({ publishedAt: -1 })
    .limit(50)
    .populate([
      { path: "authorId", select: "handle displayName avatarUrl" },
      { path: "tags", select: "name slug" },
      { path: "circleId", select: "name slug" },
    ]);
  res.json(posts.map((p) => serializePostCard(p)));
}

export async function updateMe(req: Request, res: Response): Promise<void> {
  const user = await userService.updateMe(req.user!.userId, req.body);
  res.json(serializeUser(user, { private: true }));
}

export async function setInterests(req: Request, res: Response): Promise<void> {
  const user = await userService.setInterests(req.user!.userId, req.body.tagIds);
  await user.populate("interests", "name slug");
  res.json(serializeUser(user, { private: true }));
}

export async function completeOnboarding(req: Request, res: Response): Promise<void> {
  const user = await userService.completeOnboarding(req.user!.userId);
  await user.populate("interests", "name slug");
  res.json(serializeUser(user, { private: true }));
}

export async function follow(req: Request, res: Response): Promise<void> {
  await userService.followUser(req.user!.userId, req.params.id as string);
  res.status(204).end();
}

export async function unfollow(req: Request, res: Response): Promise<void> {
  await userService.unfollowUser(req.user!.userId, req.params.id as string);
  res.status(204).end();
}
