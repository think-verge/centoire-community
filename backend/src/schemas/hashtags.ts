import { registry, z, jsonResponse, errorResponse } from "./registry.js";

export const HashtagSuggestionSchema = registry.register(
  "HashtagSuggestion",
  z.object({ name: z.string(), postCount: z.number() }),
);

export const TrendingHashtagSchema = registry.register(
  "TrendingHashtag",
  z.object({ name: z.string(), postCount: z.number(), recentCount: z.number() }),
);

export const HashtagSchema = registry.register(
  "Hashtag",
  z.object({ name: z.string(), postCount: z.number(), followerCount: z.number(), following: z.boolean() }),
);

export const HashtagListQuerySchema = z.object({
  q: z.string().max(60).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
  featured: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
});

export const HashtagTrendingQuerySchema = z.object({
  category: z.string().max(40).optional(),
  limit: z.coerce.number().int().min(1).max(30).optional(),
});

export const HashtagNameParamsSchema = z.object({ name: z.string().min(1).max(60) });

/** Request-body shape for lists of hashtag names (posts, circles, sources, interests). */
export const hashtagNames = (min: number, max: number) =>
  z.array(z.string().min(1).max(60)).min(min).max(max);

export function registerHashtagPaths(): void {
  registry.registerPath({
    method: "get",
    path: "/hashtags",
    tags: ["hashtags"],
    operationId: "searchHashtags",
    summary: "Typeahead: hashtags starting with q, most used first (empty q = most popular)",
    request: { query: HashtagListQuerySchema },
    responses: { 200: jsonResponse("Matching hashtags with usage counts", z.array(HashtagSuggestionSchema)) },
  });
  registry.registerPath({
    method: "get",
    path: "/hashtags/trending",
    tags: ["hashtags"],
    operationId: "getTrendingHashtags",
    request: { query: HashtagTrendingQuerySchema },
    responses: { 200: jsonResponse("Hashtags trending this week", z.array(TrendingHashtagSchema)) },
  });
  registry.registerPath({
    method: "get",
    path: "/hashtags/{name}",
    tags: ["hashtags"],
    operationId: "getHashtag",
    request: { params: HashtagNameParamsSchema },
    responses: { 200: jsonResponse("Hashtag detail", HashtagSchema), 404: errorResponse("Hashtag not found") },
  });
  for (const [method, operationId, description] of [
    ["put", "followHashtag", "Followed"],
    ["delete", "unfollowHashtag", "Unfollowed"],
  ] as const) {
    registry.registerPath({
      method,
      path: "/hashtags/{name}/follow",
      tags: ["hashtags"],
      operationId,
      request: { params: HashtagNameParamsSchema },
      responses: {
        204: { description },
        401: errorResponse("Not signed in"),
        404: errorResponse("Hashtag not found"),
      },
    });
  }
}
