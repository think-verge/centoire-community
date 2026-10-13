import type { Request, Response } from "express";
import * as circleService from "../services/circleService.js";
import * as feedService from "../services/feedService.js";

export async function list(req: Request, res: Response): Promise<void> {
  const query = (req.validatedQuery ?? {}) as { q?: string; hashtag?: string; limit?: number };
  res.json(await circleService.listCircles(query, req.user?.userId));
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
  const { cursor } = (req.validatedQuery ?? {}) as { cursor?: string };
  const circle = await circleService.getBySlug(req.params.slug as string);
  res.json(await feedService.circleFeed(circle._id, cursor, req.user?.userId));
}

export async function members(req: Request, res: Response): Promise<void> {
  const circle = await circleService.getBySlug(req.params.slug as string);
  res.json(await circleService.listMembers(circle._id));
}
