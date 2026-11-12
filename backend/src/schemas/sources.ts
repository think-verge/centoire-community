import { hashtagNames } from "./hashtags.js";
import { registry, z, jsonBody, jsonResponse, errorResponse } from "./registry.js";
import { PostCategorySchema } from "./posts.js";

/** rss: watched by the discovery engine. sitemap / page / instagram: the discovery
 *  engine only. discovery: the source the engine's stories are attributed to. */
export const SourceKindSchema = z.enum(["rss", "sitemap", "page", "instagram", "discovery"]);

export const SourceSchema = registry.register(
  "Source",
  z.object({
    id: z.string(),
    name: z.string(),
    siteUrl: z.string(),
    feedUrl: z.string(),
    faviconUrl: z.string().nullable(),
    hashtags: z.array(z.string()),
    category: PostCategorySchema.nullable(),
    subcategory: z.string().nullable(),
    active: z.boolean(),
    kind: SourceKindSchema,
    fetchedBy: z.enum(["app", "discovery"]),
    region: z.string().nullable(),
    review: z.enum(["suggested", "approved", "rejected"]).nullable(),
    suggestion: z
      .object({
        reason: z.string(),
        evidence: z.array(z.string()),
        score: z.number().nullable(),
        suggestedAt: z.string().nullable(),
      })
      .nullable(),
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
    feedUrl: z.string().url(),
    faviconUrl: z.string().url().optional(),
    hashtags: hashtagNames(0, 5).optional(),
    category: PostCategorySchema.nullable().optional(),
    subcategory: z.string().nullable().optional(),
    active: z.boolean().optional(),
    kind: z.enum(["rss", "sitemap", "page", "instagram"]).optional(),
    fetchedBy: z.enum(["app", "discovery"]).optional(),
    region: z.string().max(6).nullable().optional(),
  }),
);

export const UpdateSourceInputSchema = registry.register(
  "UpdateSourceInput",
  CreateSourceInputSchema.partial().extend({
    /** Decide on a source the discovery engine suggested: approving starts watching it. */
    review: z.enum(["approved", "rejected"]).optional(),
  }),
);

export const FetchStatsSchema = registry.register(
  "FetchStats",
  z.object({
    sourceId: z.string(),
    sourceName: z.string(),
    itemsSeen: z.number(),
    imported: z.number(),
    skippedDuplicates: z.number(),
    /** Stories the discovery engine queued for review from this fetch. */
    queued: z.number().optional(),
    /** Stories saved to the review queue after pulling from the engine. */
    pulled: z.number().optional(),
    error: z.string().optional(),
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
    responses: { 200: jsonResponse("Fetch stats (the discovery engine polls the source; new stories go to review)", FetchStatsSchema) },
  });
}
