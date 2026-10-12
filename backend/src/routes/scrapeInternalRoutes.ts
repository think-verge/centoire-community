import { Router, type Request, type Response } from "express";
import { Post } from "../models/Post.js";
import { Source, type ISource } from "../models/Source.js";
import { requireScraperSecret } from "../middleware/scraperAuth.js";
import { validate } from "../middleware/validate.js";
import {
  CompleteInputSchema,
  ExistsInputSchema,
  IdParamsSchema,
  LeaseInputSchema,
  SpecReportSchema,
  UpsertPostInputSchema,
  WorkerInputSchema,
} from "../schemas/scrapeInternal.js";
import { upsertAggregatedPost } from "../services/aggregatedPostService.js";
import * as scrapeJobService from "../services/scrapeJobService.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { canonicalUrlHash } from "../utils/url-hash.js";

/** Machine API used only by the external scraper-agent (x-scraper-secret). Mounted at /internal/scrape. */
export const scrapeInternalRouter = Router();
scrapeInternalRouter.use(requireScraperSecret);

function serializeSourceForAgent(source: ISource) {
  return {
    id: source._id.toString(),
    name: source.name,
    siteUrl: source.siteUrl,
    feedUrl: source.feedUrl ?? null,
    requiresLogin: source.requiresLogin,
    credentialRef: source.credentialRef ?? null,
    category: source.category ?? null,
    subcategory: source.subcategory ?? null,
    hashtags: source.hashtags ?? [],
    scrapeIntervalMin: source.scrapeIntervalMin,
    spec: { status: source.spec?.status ?? "none", hash: source.spec?.hash ?? null, store: source.spec?.store ?? "excerpt" },
  };
}

scrapeInternalRouter.post(
  "/jobs/lease",
  validate({ body: LeaseInputSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const leased = await scrapeJobService.lease(req.body.workerId, req.body.types);
    if (!leased) {
      res.status(204).end();
      return;
    }
    res.json({
      job: { id: leased.job._id.toString(), type: leased.job.type, attempts: leased.job.attempts },
      source: serializeSourceForAgent(leased.source),
    });
  }),
);

scrapeInternalRouter.post(
  "/jobs/:id/heartbeat",
  validate({ params: IdParamsSchema, body: WorkerInputSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    await scrapeJobService.heartbeat(req.params.id as string, req.body.workerId);
    res.status(204).end();
  }),
);

scrapeInternalRouter.post(
  "/jobs/:id/complete",
  validate({ params: IdParamsSchema, body: CompleteInputSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { workerId, ...result } = req.body;
    await scrapeJobService.complete(req.params.id as string, workerId, result);
    res.status(204).end();
  }),
);

/** Which of these article URLs do we already have? Lets the agent skip fetching known pages. */
scrapeInternalRouter.post(
  "/posts/exists",
  validate({ body: ExistsInputSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const urls: string[] = req.body.urls;
    const byHash = new Map(urls.map((u) => [canonicalUrlHash(u), u]));
    const found = await Post.find({ canonicalUrlHash: { $in: [...byHash.keys()] } }).select("canonicalUrlHash").lean();
    res.json({ existing: found.flatMap((p) => (p.canonicalUrlHash && byHash.has(p.canonicalUrlHash) ? [byHash.get(p.canonicalUrlHash) as string] : [])) });
  }),
);

/** Idempotent: the same URL twice is one post; a richer body for a known URL enriches it. */
scrapeInternalRouter.put(
  "/posts",
  validate({ body: UpsertPostInputSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const { sourceId, url, ...input } = req.body;
    const source = await Source.findById(sourceId);
    if (!source) throw new ApiError(404, "Source not found");
    const { outcome, post } = await upsertAggregatedPost(source, { ...input, url });
    res.status(outcome === "created" ? 201 : 200).json({ outcome, postId: post._id.toString(), status: post.status });
  }),
);

/** The agent reports the state of a source's YAML spec (the YAML itself lives in git, not here). */
scrapeInternalRouter.patch(
  "/sources/:id/spec",
  validate({ params: IdParamsSchema, body: SpecReportSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const set: Record<string, unknown> = { "spec.status": req.body.status };
    if (req.body.hash) set["spec.hash"] = req.body.hash;
    if (req.body.store) set["spec.store"] = req.body.store;
    if (req.body.status === "ready") set["spec.discoveredAt"] = new Date();
    const result = await Source.updateOne({ _id: req.params.id }, { $set: set });
    if (result.matchedCount === 0) throw new ApiError(404, "Source not found");
    res.status(204).end();
  }),
);
