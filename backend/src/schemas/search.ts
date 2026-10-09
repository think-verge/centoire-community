import { registry, z, jsonResponse } from "./registry.js";
import { PublicUserSchema } from "./auth.js";
import { CircleSchema } from "./community.js";
import { HashtagSuggestionSchema } from "./hashtags.js";
import { PostCardSchema } from "./posts.js";

export const SearchQuerySchema = z.object({
  q: z.string().min(1).max(100),
  type: z.enum(["all", "posts", "people", "circles", "hashtags"]).optional(),
});

export const SearchResultsSchema = registry.register(
  "SearchResults",
  z.object({
    posts: z.array(PostCardSchema),
    people: z.array(PublicUserSchema),
    circles: z.array(CircleSchema),
    hashtags: z.array(HashtagSuggestionSchema),
  }),
);

export function registerSearchPaths(): void {
  registry.registerPath({
    method: "get",
    path: "/search",
    tags: ["search"],
    operationId: "search",
    request: { query: SearchQuerySchema },
    responses: { 200: jsonResponse("Grouped search results", SearchResultsSchema) },
  });
}
