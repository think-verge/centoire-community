import { registry, z, jsonBody, jsonResponse, errorResponse } from "./registry.js";

export const SourceSchema = registry.register(
  "Source",
  z.object({
    id: z.string(),
    name: z.string(),
    siteUrl: z.string(),
    feedUrl: z.string(),
    faviconUrl: z.string().nullable(),
    tags: z.array(z.object({ id: z.string(), name: z.string(), slug: z.string() })),
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
    feedUrl: z.string().url(),
    faviconUrl: z.string().url().optional(),
    tagIds: z.array(z.string()).max(5).optional(),
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
    responses: { 200: jsonResponse("Import stats", FetchStatsSchema) },
  });
}
