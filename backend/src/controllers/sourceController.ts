import type { Request, Response } from "express";
import { Source, type ISource } from "../models/Source.js";
import * as ingestionService from "../services/ingestionService.js";
import { ApiError } from "../utils/api-error.js";

function serializeSource(source: ISource) {
  const tags = source.tags as unknown as Array<{ _id: unknown; name?: string; slug?: string }>;
  return {
    id: source._id.toString(),
    name: source.name,
    siteUrl: source.siteUrl,
    feedUrl: source.feedUrl,
    faviconUrl: source.faviconUrl ?? null,
    tags: tags.map((t) => ({
      id: String(t._id ?? t),
      name: t.name ?? "",
      slug: t.slug ?? "",
    })),
    active: source.active,
    lastFetchedAt: source.lastFetchedAt?.toISOString() ?? null,
    lastStatus: source.lastStatus ?? null,
    lastError: source.lastError ?? null,
  };
}

export async function list(_req: Request, res: Response): Promise<void> {
  const sources = await Source.find().sort({ name: 1 }).populate("tags", "name slug");
  res.json(sources.map(serializeSource));
}

export async function create(req: Request, res: Response): Promise<void> {
  const existing = await Source.findOne({ feedUrl: req.body.feedUrl });
  if (existing) throw new ApiError(409, "A source with this feed URL already exists");
  const faviconUrl =
    req.body.faviconUrl ??
    `https://www.google.com/s2/favicons?domain=${new URL(req.body.siteUrl).hostname}&sz=64`;
  const source = await Source.create({
    ...req.body,
    faviconUrl,
    tags: req.body.tagIds ?? [],
    createdBy: req.user!.userId,
  });
  await source.populate("tags", "name slug");
  res.status(201).json(serializeSource(source));
}

export async function update(req: Request, res: Response): Promise<void> {
  const source = await Source.findById(req.params.id);
  if (!source) throw new ApiError(404, "Source not found");
  const { name, siteUrl, feedUrl, active, tagIds } = req.body;
  if (name !== undefined) source.name = name;
  if (siteUrl !== undefined) source.siteUrl = siteUrl;
  if (feedUrl !== undefined) source.feedUrl = feedUrl;
  if (active !== undefined) source.active = active;
  if (tagIds !== undefined) source.tags = tagIds;
  await source.save();
  await source.populate("tags", "name slug");
  res.json(serializeSource(source));
}

export async function remove(req: Request, res: Response): Promise<void> {
  const source = await Source.findByIdAndDelete(req.params.id);
  if (!source) throw new ApiError(404, "Source not found");
  res.status(204).end();
}

export async function fetchNow(req: Request, res: Response): Promise<void> {
  const source = await Source.findById(req.params.id);
  if (!source) throw new ApiError(404, "Source not found");
  const stats = await ingestionService.fetchSource(source);
  res.json(stats);
}
