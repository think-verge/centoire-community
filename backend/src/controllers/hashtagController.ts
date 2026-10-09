import type { Request, Response } from "express";
import * as hashtagService from "../services/hashtagService.js";

export async function list(req: Request, res: Response): Promise<void> {
  const query = (req.validatedQuery ?? {}) as { q?: string; limit?: number; featured?: boolean };
  res.set("Cache-Control", "public, max-age=15");
  res.json(await hashtagService.search(query));
}

export async function trending(req: Request, res: Response): Promise<void> {
  const query = (req.validatedQuery ?? {}) as { category?: string; limit?: number };
  res.set("Cache-Control", "public, max-age=60");
  res.json(await hashtagService.trending(query));
}

export async function getByName(req: Request, res: Response): Promise<void> {
  res.json(await hashtagService.getByName(req.params.name as string, req.user?.userId));
}

export async function follow(req: Request, res: Response): Promise<void> {
  await hashtagService.follow(req.user!.userId, req.params.name as string);
  res.status(204).end();
}

export async function unfollow(req: Request, res: Response): Promise<void> {
  await hashtagService.unfollow(req.user!.userId, req.params.name as string);
  res.status(204).end();
}

export async function block(req: Request, res: Response): Promise<void> {
  await hashtagService.setStatus(req.params.name as string, "blocked");
  res.status(204).end();
}

export async function unblock(req: Request, res: Response): Promise<void> {
  await hashtagService.setStatus(req.params.name as string, "active");
  res.status(204).end();
}
