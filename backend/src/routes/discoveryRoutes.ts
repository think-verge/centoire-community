import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { env } from "../config/env.js";
import { validate } from "../middleware/validate.js";
import * as discoveryService from "../services/discoveryService.js";
import { asyncHandler } from "../utils/async-handler.js";

/** Service-to-service API for the discovery engine. Mounted at /internal/discovery. */
export const discoveryRouter = Router();

discoveryRouter.use((req, res, next) => {
  if (req.headers["x-internal-secret"] !== env.DISCOVERY_INTERNAL_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
});

const isoDate = z.string().datetime({ offset: true });

export const StoryCandidateSchema = z.object({
  storyId: z.string().min(1).max(64),
  title: z.string().min(1).max(300),
  excerpt: z.string().max(2000).optional(),
  externalUrl: z.string().url(),
  coverImageUrl: z.string().url().optional(),
  country: z.string().max(6).optional(),
  publishedAt: isoDate,
  discovery: z.object({
    category: z.string().max(40).optional(),
    websiteCount: z.number().int().min(0),
    articleCount: z.number().int().min(0),
    firstPublished: z.object({ name: z.string().max(200), url: z.string().optional(), at: isoDate }).optional(),
    engineSawAt: isoDate.optional(),
    spread: z.array(z.object({ name: z.string().max(200), url: z.string().optional(), firstAt: isoDate })).max(200),
    markets: z.array(z.string().max(10)).max(50),
    momentum: z
      .object({
        tag: z.enum(["breaking", "rising", "early", "steady", "settled"]),
        reason: z.string().max(300),
        rank: z.number().int().min(0).max(9),
        computedAt: isoDate,
      })
      .optional(),
  }),
});

export const SourceSuggestionSchema = z.object({
  name: z.string().min(1).max(200),
  siteUrl: z.string().url(),
  feedUrl: z.string().url(),
  kind: z.enum(["rss", "sitemap", "page", "instagram"]),
  region: z.string().max(6).optional(),
  reason: z.string().min(1).max(1000),
  evidence: z.array(z.string().max(1000)).max(20).default([]),
  score: z.number().optional(),
});

/** Put a story up for review, or refresh the evidence on its existing post. */
discoveryRouter.post(
  "/stories",
  validate({ body: StoryCandidateSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const result = await discoveryService.upsertStory(req.body);
    res.status(result.created ? 201 : 200).json(result);
  }),
);

/** Editors' decisions on engine stories after `since` (ISO time), oldest first. */
discoveryRouter.get(
  "/decisions",
  asyncHandler(async (req: Request, res: Response) => {
    const since = new Date(String(req.query["since"] ?? 0));
    if (Number.isNaN(since.getTime())) {
      res.status(400).json({ error: "since must be an ISO date" });
      return;
    }
    const limit = Math.min(Number(req.query["limit"] ?? 200), 500);
    res.json(await discoveryService.listDecisions(since, limit));
  }),
);

/** Sources the engine watches (active ones) or has suggested (so it doesn't suggest them again). */
discoveryRouter.get(
  "/sources",
  asyncHandler(async (_req: Request, res: Response) => {
    const sources = await discoveryService.listEngineSources();
    res.json(sources.map(discoveryService.serializeEngineSource));
  }),
);

/** Propose a source for an admin to approve on the Sources page. */
discoveryRouter.post(
  "/sources/suggestions",
  validate({ body: SourceSuggestionSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { source, created } = await discoveryService.suggestSource(req.body);
    res.status(created ? 201 : 200).json({ ...discoveryService.serializeEngineSource(source), created });
  }),
);
