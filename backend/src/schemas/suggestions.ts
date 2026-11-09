import { registry, z, jsonResponse } from "./registry.js";

export const SuggestedCircleSchema = registry.register(
  "SuggestedCircle",
  z.object({
    id: z.string(),
    name: z.string(),
    slug: z.string(),
    description: z.string(),
    avatarUrl: z.string().optional(),
    coverImageUrl: z.string().optional(),
    memberCount: z.number().int(),
    postCount: z.number().int(),
    isPrivate: z.boolean(),
    score: z.number(),
    reason: z.string(),
    scoreBreakdown: z.record(z.string(), z.number()).optional(),
  }),
);

export const SuggestedCirclesResponseSchema = registry.register(
  "SuggestedCirclesResponse",
  z.object({
    items: z.array(SuggestedCircleSchema),
    count: z.number().int(),
  }),
);

export const SuggestedCreatorSchema = registry.register(
  "SuggestedCreator",
  z.object({
    id: z.string(),
    handle: z.string(),
    displayName: z.string(),
    avatarUrl: z.string().optional(),
    bio: z.string().optional(),
    followerCount: z.number().int(),
    postCount: z.number().int(),
    isEmerging: z.boolean(),
    score: z.number(),
    reason: z.string(),
    scoreBreakdown: z.record(z.string(), z.number()).optional(),
  }),
);

export const SuggestedCreatorsResponseSchema = registry.register(
  "SuggestedCreatorsResponse",
  z.object({
    items: z.array(SuggestedCreatorSchema),
    count: z.number().int(),
  }),
);

export const SuggestionsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

export const SuggestionDismissBodySchema = registry.register(
  "SuggestionDismissBody",
  z.object({
    targetType: z.enum(["circle", "creator"]),
    targetId: z.string(),
  }),
);

export const SuggestionIgnoreBodySchema = registry.register(
  "SuggestionIgnoreBody",
  z.object({
    targetType: z.enum(["circle", "creator"]),
    targetId: z.string(),
  }),
);

export const SuggestionImpressionItemSchema = z.object({
  targetType: z.enum(["circle", "creator"]),
  targetId: z.string(),
  position: z.number().int().min(1),
  score: z.number().optional(),
  reason: z.string().optional(),
});

export const SuggestionImpressionsBodySchema = registry.register(
  "SuggestionImpressionsBody",
  z.object({
    impressions: z.array(SuggestionImpressionItemSchema).min(1).max(100),
  }),
);

export const SuggestionFeedbackResponseSchema = registry.register(
  "SuggestionFeedbackResponse",
  z.object({
    status: z.literal("ok"),
    action: z.string(),
    dismissedUntil: z.string().optional().nullable(),
    ignoreCount: z.number().int().optional(),
  }),
);

export function registerSuggestionPaths(): void {
  registry.registerPath({
    method: "get",
    path: "/suggestions/circles",
    tags: ["suggestions"],
    operationId: "getSuggestedCircles",
    request: { query: SuggestionsQuerySchema },
    responses: {
      200: jsonResponse("Personalized circle recommendations", SuggestedCirclesResponseSchema),
    },
  });

  registry.registerPath({
    method: "get",
    path: "/suggestions/creators",
    tags: ["suggestions"],
    operationId: "getSuggestedCreators",
    request: { query: SuggestionsQuerySchema },
    responses: {
      200: jsonResponse("Personalized creator recommendations", SuggestedCreatorsResponseSchema),
    },
  });

  registry.registerPath({
    method: "post",
    path: "/suggestions/dismiss",
    tags: ["suggestions"],
    operationId: "dismissSuggestion",
    request: {
      body: {
        content: {
          "application/json": { schema: SuggestionDismissBodySchema },
        },
      },
    },
    responses: {
      200: jsonResponse("Dismissal recorded (hidden for 30 days)", SuggestionFeedbackResponseSchema),
    },
  });

  registry.registerPath({
    method: "post",
    path: "/suggestions/ignore",
    tags: ["suggestions"],
    operationId: "ignoreSuggestion",
    request: {
      body: {
        content: {
          "application/json": { schema: SuggestionIgnoreBodySchema },
        },
      },
    },
    responses: {
      200: jsonResponse("Ignore recorded (hidden for 14 days after 3 ignores)", SuggestionFeedbackResponseSchema),
    },
  });

  registry.registerPath({
    method: "post",
    path: "/suggestions/impressions",
    tags: ["suggestions"],
    operationId: "recordSuggestionImpressions",
    request: {
      body: {
        content: {
          "application/json": { schema: SuggestionImpressionsBodySchema },
        },
      },
    },
    responses: {
      200: jsonResponse("Impressions logged successfully", z.object({ status: z.literal("ok"), loggedCount: z.number() })),
    },
  });
}
