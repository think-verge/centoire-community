import { hashtagNames } from "./hashtags.js";
import { registry, z, jsonBody, jsonResponse, errorResponse } from "./registry.js";
import { PostCategorySchema } from "./posts.js";

export const SourceSchema = registry.register(
  "Source",
  z.object({
    id: z.string(),
    name: z.string(),
    siteUrl: z.string(),
    feedUrl: z.string().nullable(),
    faviconUrl: z.string().nullable(),
    method: z.enum(["agent", "rss"]),
    requiresLogin: z.boolean(),
    credentialRef: z.string().nullable(),
    scrapeIntervalMin: z.number(),
    spec: z.object({
      status: z.enum(["none", "discovering", "ready", "needs_rediscovery", "needs_human"]),
      store: z.enum(["full", "excerpt"]),
      hash: z.string().nullable(),
      discoveredAt: z.string().nullable(),
    }),
    lastRun: z
      .object({
        status: z.enum(["ok", "error"]),
        errorCode: z.string().nullable(),
        errorMessage: z.string().nullable(),
        itemsSeen: z.number(),
        imported: z.number(),
        duplicates: z.number(),
        finishedAt: z.string(),
      })
      .nullable(),
    hashtags: z.array(z.string()),
    category: PostCategorySchema.nullable(),
    subcategory: z.string().nullable(),
    active: z.boolean(),
    lastFetchedAt: z.string().nullable(),
    lastStatus: z.enum(["ok", "error"]).nullable(),
    lastError: z.string().nullable(),
  }),
);

export const CreateSourceInputSchema = registry.register(
  "CreateSourceInput",
  z.object({
    name: z.string().min(1).max(80),
    siteUrl: z.string().url(),
    feedUrl: z.string().url().nullable().optional(),
    faviconUrl: z.string().url().optional(),
    requiresLogin: z.boolean().optional(),
    credentialRef: z
      .string()
      .regex(/^[a-z0-9][a-z0-9_-]*$/, "lowercase letters, digits, - and _ only")
      .max(60)
      .nullable()
      .optional(),
    scrapeIntervalMin: z.number().int().min(5).max(10080).optional(),
    store: z.enum(["full", "excerpt"]).optional(),
    hashtags: hashtagNames(0, 5).optional(),
    category: PostCategorySchema.nullable().optional(),
    subcategory: z.string().nullable().optional(),
    active: z.boolean().optional(),
  }),
);

export const UpdateSourceInputSchema = registry.register(
  "UpdateSourceInput",
  CreateSourceInputSchema.partial(),
);

export const FetchStatsSchema = registry.register(
  "FetchStats",
  z.object({
    sourceId: z.string(),
    sourceName: z.string(),
    itemsSeen: z.number(),
    imported: z.number(),
    skippedDuplicates: z.number(),
    error: z.string().optional(),
  }),
);

export const ScrapeEnqueueResultSchema = registry.register(
  "ScrapeEnqueueResult",
  z.object({
    mode: z.enum(["agent", "rss"]),
    type: z.enum(["discover", "scrape"]),
    /** false when an identical job was already waiting or running. */
    created: z.boolean(),
    jobId: z.string().nullable(),
    stats: FetchStatsSchema.optional(),
  }),
);

export const ScrapeJobSchema = registry.register(
  "ScrapeJob",
  z.object({
    id: z.string(),
    type: z.enum(["discover", "scrape"]),
    status: z.enum(["queued", "leased", "done", "failed"]),
    attempts: z.number(),
    errorCode: z.string().nullable(),
    errorMessage: z.string().nullable(),
    createdAt: z.string(),
    finishedAt: z.string().nullable(),
  }),
);

export function registerSourcePaths(): void {
  registry.registerPath({
    method: "get",
    path: "/admin/sources",
    tags: ["admin"],
    operationId: "listSources",
    responses: { 200: jsonResponse("All sources", z.array(SourceSchema)) },
  });
  registry.registerPath({
    method: "post",
    path: "/admin/sources",
    tags: ["admin"],
    operationId: "createSource",
    request: { body: jsonBody(CreateSourceInputSchema) },
    responses: {
      201: jsonResponse("Source created", SourceSchema),
      409: errorResponse("Feed URL already exists"),
    },
  });
  registry.registerPath({
    method: "patch",
    path: "/admin/sources/{id}",
    tags: ["admin"],
    operationId: "updateSource",
    request: { params: z.object({ id: z.string() }), body: jsonBody(UpdateSourceInputSchema) },
    responses: { 200: jsonResponse("Updated source", SourceSchema) },
  });
  registry.registerPath({
    method: "delete",
    path: "/admin/sources/{id}",
    tags: ["admin"],
    operationId: "deleteSource",
    request: { params: z.object({ id: z.string() }) },
    responses: { 204: { description: "Source deleted" } },
  });
  registry.registerPath({
    method: "post",
    path: "/admin/sources/{id}/fetch",
    tags: ["admin"],
    operationId: "fetchSourceNow",
    request: { params: z.object({ id: z.string() }) },
    responses: { 200: jsonResponse("Queued job (or legacy import stats)", ScrapeEnqueueResultSchema) },
  });
  registry.registerPath({
    method: "post",
    path: "/admin/sources/{id}/discover",
    tags: ["admin"],
    operationId: "rediscoverSource",
    request: { params: z.object({ id: z.string() }) },
    responses: { 200: jsonResponse("Queued discovery job", ScrapeEnqueueResultSchema) },
  });
  registry.registerPath({
    method: "get",
    path: "/admin/sources/{id}/jobs",
    tags: ["admin"],
    operationId: "listSourceJobs",
    request: { params: z.object({ id: z.string() }) },
    responses: { 200: jsonResponse("Recent scrape jobs", z.array(ScrapeJobSchema)) },
  });
}
