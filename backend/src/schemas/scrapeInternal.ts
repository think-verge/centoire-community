import { z } from "zod";
import { SCRAPE_ERROR_CODES } from "../models/Source.js";

/** Request schemas for the machine-to-machine scrape API. Not part of the public OpenAPI spec. */
const workerId = z.string().min(3).max(80);

export const LeaseInputSchema = z.object({
  workerId,
  types: z.array(z.enum(["discover", "scrape"])).min(1).optional(),
});

export const WorkerInputSchema = z.object({ workerId });

export const CompleteInputSchema = z.object({
  workerId,
  ok: z.boolean(),
  stats: z
    .object({
      itemsSeen: z.number().int().min(0),
      imported: z.number().int().min(0),
      duplicates: z.number().int().min(0),
      updated: z.number().int().min(0),
    })
    .optional(),
  errorCode: z.enum(SCRAPE_ERROR_CODES as [string, ...string[]]).optional(),
  errorMessage: z.string().max(2000).optional(),
});

export const ExistsInputSchema = z.object({ urls: z.array(z.string().url().max(2000)).min(1).max(200) });

export const UpsertPostInputSchema = z.object({
  sourceId: z.string().regex(/^[a-f\d]{24}$/i),
  url: z.string().url().max(2000),
  title: z.string().trim().min(1).max(300),
  excerpt: z.string().max(2000).optional(),
  contentHtml: z.string().max(600_000).optional(),
  contentText: z.string().max(300_000).optional(),
  coverImageUrl: z.string().url().max(2000).optional(),
  publishedAt: z.coerce.date().optional(),
  country: z.string().length(2).toUpperCase().optional(),
  specHash: z.string().max(100).optional(),
});

export const SpecReportSchema = z.object({
  status: z.enum(["none", "discovering", "ready", "needs_rediscovery", "needs_human"]),
  hash: z.string().max(100).optional(),
  store: z.enum(["full", "excerpt"]).optional(),
});

export const IdParamsSchema = z.object({ id: z.string().regex(/^[a-f\d]{24}$/i) });
