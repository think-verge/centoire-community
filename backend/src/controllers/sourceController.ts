import type { Request, Response } from "express";
import { Source, type ISource } from "../models/Source.js";
import * as ingestionService from "../services/ingestionService.js";
import { ApiError } from "../utils/api-error.js";
import { MAX_SOURCE_HASHTAGS } from "../utils/hashtag.js";
import * as hashtagService from "../services/hashtagService.js";

function serializeSource(source: ISource) {
  return {
    id: source._id.toString(),
    name: source.name,
    siteUrl: source.siteUrl,
    feedUrl: source.feedUrl,
    faviconUrl: source.faviconUrl ?? null,
    hashtags: source.hashtags ?? [],
    category: source.category ?? null,
    subcategory: source.subcategory ?? null,
    active: source.active,
    lastFetchedAt: source.lastFetchedAt?.toISOString() ?? null,
    lastStatus: source.lastStatus ?? null,
    lastError: source.lastError ?? null,
  };
}

export async function list(_req: Request, res: Response): Promise<void> {
  const sources = await Source.find().sort({ name: 1 });
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
    hashtags: await hashtagService.ensureHashtags(req.body.hashtags ?? [], {
      createdBy: req.user!.userId,
      max: MAX_SOURCE_HASHTAGS,
    }),
    createdBy: req.user!.userId,
  });
  await source;
  res.status(201).json(serializeSource(source));
}

export async function update(req: Request, res: Response): Promise<void> {
  const source = await Source.findById(req.params.id);
  if (!source) throw new ApiError(404, "Source not found");
  const { name, siteUrl, feedUrl, active, hashtags, category, subcategory } = req.body;
  if (name !== undefined) source.name = name;
  if (siteUrl !== undefined) source.siteUrl = siteUrl;
  if (feedUrl !== undefined) source.feedUrl = feedUrl;
  if (active !== undefined) source.active = active;
  if (hashtags !== undefined) {
    source.hashtags = await hashtagService.ensureHashtags(hashtags, {
      createdBy: req.user!.userId,
      max: MAX_SOURCE_HASHTAGS,
    });
  }
  if (category !== undefined) source.category = category ?? undefined;
  if (subcategory !== undefined) source.subcategory = subcategory ?? undefined;
  await source.save();
  await source;
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
