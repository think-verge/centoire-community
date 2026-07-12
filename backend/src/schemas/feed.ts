import { registry, z, jsonResponse } from "./registry.js";
import { PostCardSchema } from "./posts.js";

export const FeedPageSchema = registry.register(
  "FeedPage",
  z.object({
    items: z.array(PostCardSchema),
    nextCursor: z.string().nullable(),
  }),
);

export const FeedCursorQuerySchema = z.object({
  cursor: z.string().optional(),
});

export const DiscoverQuerySchema = z.object({
  sort: z.enum(["trending", "new"]).optional(),
  tag: z.string().optional(),
  cursor: z.string().optional(),
});

export function registerFeedPaths(): void {
  registry.registerPath({
    method: "get",
    path: "/feed/for-you",
    tags: ["feed"],
    operationId: "getFeedForYou",
    request: { query: FeedCursorQuerySchema },
    responses: { 200: jsonResponse("Personalized feed page", FeedPageSchema) },
  });
  registry.registerPath({
    method: "get",
    path: "/feed/following",
    tags: ["feed"],
    operationId: "getFeedFollowing",
    request: { query: FeedCursorQuerySchema },
    responses: { 200: jsonResponse("Followed people & circles feed page", FeedPageSchema) },
  });
  registry.registerPath({
    method: "get",
    path: "/feed/discover",
    tags: ["feed"],
    operationId: "getFeedDiscover",
    request: { query: DiscoverQuerySchema },
    responses: { 200: jsonResponse("Discover feed page", FeedPageSchema) },
  });
}
