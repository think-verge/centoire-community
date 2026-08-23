import { registry, z, jsonBody, jsonResponse } from "./registry.js";
import { PostCategorySchema } from "./posts.js";

export const AgentSearchQueryInputSchema = z.object({
  query: z.string().min(1).max(300),
});

export const AgentSearchFiltersSchema = registry.register(
  "AgentSearchFilters",
  z.object({
    category: PostCategorySchema.nullable(),
    subcategory: z.string().nullable(),
    tag: z.object({ slug: z.string(), name: z.string() }).nullable(),
    country: z.string().nullable(),
    q: z.string().nullable(),
    sort: z.enum(["trending", "new"]).nullable(),
  }),
);

export function registerAgentPaths(): void {
  registry.registerPath({
    method: "post",
    path: "/agent/search-query",
    tags: ["agent"],
    operationId: "agentSearchQuery",
    request: { body: jsonBody(AgentSearchQueryInputSchema) },
    responses: { 200: jsonResponse("Resolved search filters", AgentSearchFiltersSchema) },
  });
}
