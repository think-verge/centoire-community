import type { Request, Response } from "express";
import { Source, type ISource } from "../models/Source.js";
import { env } from "../config/env.js";
import * as scrapeJobService from "../services/scrapeJobService.js";
import type { IScrapeJob } from "../models/ScrapeJob.js";
import * as ingestionService from "../services/ingestionService.js";
import { ApiError } from "../utils/api-error.js";
import { MAX_SOURCE_HASHTAGS } from "../utils/hashtag.js";
import * as hashtagService from "../services/hashtagService.js";

function serializeSource(source: ISource) {
  return {
    id: source._id.toString(),
    name: source.name,
    siteUrl: source.siteUrl,
    feedUrl: source.feedUrl ?? null,
    method: source.method,
    requiresLogin: source.requiresLogin,
    credentialRef: source.credentialRef ?? null,
    scrapeIntervalMin: source.scrapeIntervalMin,
    spec: {
      status: source.spec?.status ?? "none",
      store: source.spec?.store ?? "excerpt",
      hash: source.spec?.hash ?? null,
      discoveredAt: source.spec?.discoveredAt?.toISOString() ?? null,
    },
    lastRun: source.lastRun?.finishedAt
      ? {
          status: source.lastRun.status,
          errorCode: source.lastRun.errorCode ?? null,
          errorMessage: source.lastRun.errorMessage ?? null,
          itemsSeen: source.lastRun.itemsSeen ?? 0,
          imported: source.lastRun.imported ?? 0,
          duplicates: source.lastRun.duplicates ?? 0,
          finishedAt: source.lastRun.finishedAt.toISOString(),
        }
      : null,
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

function serializeJob(job: IScrapeJob) {
  return {
    id: job._id.toString(),
    type: job.type,
    status: job.status,
    attempts: job.attempts,
    errorCode: job.errorCode ?? null,
    errorMessage: job.errorMessage ?? null,
    createdAt: job.createdAt.toISOString(),
    finishedAt: job.finishedAt?.toISOString() ?? null,
  };
}

function assertLoginConfig(requiresLogin: boolean | undefined, credentialRef: string | null | undefined): void {
  if (requiresLogin && !credentialRef) {
    throw new ApiError(422, "credentialRef: name the login stored on the scraper VM for this source");
  }
}

export async function create(req: Request, res: Response): Promise<void> {
  if (req.body.feedUrl) {
    const existing = await Source.findOne({ feedUrl: req.body.feedUrl });
    if (existing) throw new ApiError(409, "A source with this feed URL already exists");
  }
  assertLoginConfig(req.body.requiresLogin, req.body.credentialRef);
  const { store, ...fields } = req.body;
  const faviconUrl =
    req.body.faviconUrl ??
    `https://www.google.com/s2/favicons?domain=${new URL(req.body.siteUrl).hostname}&sz=64`;
  const source = await Source.create({
    ...fields,
    feedUrl: fields.feedUrl ?? undefined,
    credentialRef: fields.credentialRef ?? undefined,
    method: env.INGESTION_MODE === "rss" && fields.feedUrl ? "rss" : "agent",
    ...(store ? { spec: { status: "none", store } } : {}),
    faviconUrl,
    hashtags: await hashtagService.ensureHashtags(req.body.hashtags ?? [], {
      createdBy: req.user!.userId,
      max: MAX_SOURCE_HASHTAGS,
    }),
    createdBy: req.user!.userId,
  });
  if (source.method === "agent" && source.active) {
    await scrapeJobService.enqueue(source._id, "discover", req.user!.userId); // discovery starts on its own
  }
  const fresh = (await Source.findById(source._id)) ?? source;
  res.status(201).json(serializeSource(fresh));
}

export async function update(req: Request, res: Response): Promise<void> {
  const source = await Source.findById(req.params.id);
  if (!source) throw new ApiError(404, "Source not found");
  const { name, siteUrl, feedUrl, active, hashtags, category, subcategory } = req.body;
  const { requiresLogin, credentialRef, scrapeIntervalMin, store } = req.body;
  assertLoginConfig(requiresLogin ?? source.requiresLogin, credentialRef === undefined ? source.credentialRef : credentialRef);
  if (requiresLogin !== undefined) source.requiresLogin = requiresLogin;
  if (credentialRef !== undefined) source.credentialRef = credentialRef ?? undefined;
  if (scrapeIntervalMin !== undefined) source.scrapeIntervalMin = scrapeIntervalMin;
  if (store !== undefined) source.spec.store = store;
  if (name !== undefined) source.name = name;
  if (siteUrl !== undefined) source.siteUrl = siteUrl;
  if (feedUrl !== undefined) source.feedUrl = feedUrl ?? undefined;
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
  if (source.method === "rss") {
    const stats = await ingestionService.fetchSource(source); // legacy in-process path (INGESTION_MODE=rss)
    res.json({ mode: "rss", type: "scrape", created: true, jobId: null, stats });
    return;
  }
  // Without a working spec there is nothing to replay yet: discover first.
  const type = source.spec?.status === "ready" ? "scrape" : "discover";
  const { job, created } = await scrapeJobService.enqueue(source._id, type, req.user!.userId);
  res.json({ mode: "agent", type, created, jobId: job._id.toString() });
}

export async function rediscover(req: Request, res: Response): Promise<void> {
  const source = await Source.findById(req.params.id);
  if (!source) throw new ApiError(404, "Source not found");
  if (source.method !== "agent") throw new ApiError(422, "Only agent-scraped sources can be re-discovered");
  const { job, created } = await scrapeJobService.enqueue(source._id, "discover", req.user!.userId);
  res.json({ mode: "agent", type: "discover", created, jobId: job._id.toString() });
}

export async function jobs(req: Request, res: Response): Promise<void> {
  const source = await Source.findById(req.params.id);
  if (!source) throw new ApiError(404, "Source not found");
  res.json((await scrapeJobService.recentJobs(source._id.toString())).map(serializeJob));
}
