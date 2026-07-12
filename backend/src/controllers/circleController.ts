import type { Request, Response } from "express";
import { Circle } from "../models/Circle.js";
import { CircleMembership } from "../models/CircleMembership.js";
import { Post } from "../models/Post.js";
import * as circleService from "../services/circleService.js";
import { serializePostCard } from "../services/postSerializer.js";
import { serializeUser } from "../services/userSerializer.js";
import type { IUser } from "../models/User.js";

export async function list(req: Request, res: Response): Promise<void> {
  const query = (req.validatedQuery ?? {}) as { q?: string; tag?: string };
  const filter: Record<string, unknown> = {};
  if (query.q) filter.$text = { $search: query.q };
  const circles = await Circle.find(filter)
    .sort({ memberCount: -1 })
    .limit(50)
    .populate("tags", "name slug");
  res.json(circles.map((c) => circleService.serializeCircle(c)));
}

export async function getBySlug(req: Request, res: Response): Promise<void> {
  const circle = await circleService.getBySlug(req.params.slug as string);
  const viewerRole = await circleService.getViewerRole(
    circle._id.toString(),
    req.user?.userId,
  );
  res.json(circleService.serializeCircle(circle, viewerRole));
}

export async function create(req: Request, res: Response): Promise<void> {
  const circle = await circleService.createCircle(req.user!.userId, req.body);
  res.status(201).json(circleService.serializeCircle(circle, "owner"));
}

export async function join(req: Request, res: Response): Promise<void> {
  const circle = await circleService.getBySlug(req.params.slug as string);
  await circleService.joinCircle(circle._id.toString(), req.user!.userId);
  res.status(204).end();
}

export async function leave(req: Request, res: Response): Promise<void> {
  const circle = await circleService.getBySlug(req.params.slug as string);
  await circleService.leaveCircle(circle._id.toString(), req.user!.userId);
  res.status(204).end();
}

export async function posts(req: Request, res: Response): Promise<void> {
  const circle = await circleService.getBySlug(req.params.slug as string);
  const circlePosts = await Post.find({ circleId: circle._id, status: "published" })
    .sort({ publishedAt: -1 })
    .limit(50)
    .populate([
      { path: "authorId", select: "handle displayName avatarUrl" },
      { path: "sourceId", select: "name siteUrl faviconUrl" },
      { path: "tags", select: "name slug" },
      { path: "circleId", select: "name slug" },
    ]);
  res.json(circlePosts.map((p) => serializePostCard(p)));
}

export async function members(req: Request, res: Response): Promise<void> {
  const circle = await circleService.getBySlug(req.params.slug as string);
  const memberships = await CircleMembership.find({ circleId: circle._id })
    .sort({ role: 1, createdAt: 1 })
    .limit(100)
    .populate("userId");
  res.json(
    memberships
      .filter((m) => m.userId)
      .map((m) => ({
        role: m.role,
        user: serializeUser(m.userId as unknown as IUser),
      })),
  );
}
