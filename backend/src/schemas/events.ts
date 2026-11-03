import { registry, z, jsonBody, jsonResponse, errorResponse } from "./registry.js";

export const EventActionSchema = z.enum([
  "impression",
  "read",
  "dwell",
  "hide",
  "report",
  "suggestion_impression",
  "suggestion_dismiss",
  "upvote",
  "save",
  "comment",
  "share",
  "follow",
  "circle_join",
]);

export const EventTargetTypeSchema = z.enum(["post", "creator", "circle"]);

export const EventItemInputSchema = registry.register(
  "EventItemInput",
  z.object({
    action: EventActionSchema,
    postId: z.string().optional(),
    targetType: EventTargetTypeSchema.optional(),
    targetId: z.string().optional(),
    position: z.number().int().min(0).optional(),
    source: z.string().max(100).optional(),
    score: z.number().optional(),
    dwellMs: z.number().min(0).optional(),
    idempotencyKey: z.string().min(1).max(128).optional(),
    sessionId: z.string().max(128).optional(),
    at: z.union([z.string(), z.number()]).optional(),
    metadata: z.record(z.unknown()).optional(),
  }),
);

export const EventBatchInputSchema = registry.register(
  "EventBatchInput",
  z.object({
    events: z.array(EventItemInputSchema).min(1).max(100),
  }),
);

export const EventBatchResponseSchema = registry.register(
  "EventBatchResponse",
  z.object({
    accepted: z.number(),
    duplicates: z.number(),
  }),
);

export function registerEventPaths(): void {
  registry.registerPath({
    method: "post",
    path: "/events",
    tags: ["events"],
    operationId: "ingestEvents",
    summary: "Ingest client behavioural events in batches",
    request: { body: jsonBody(EventBatchInputSchema) },
    responses: {
      202: jsonResponse("Batch accepted and queued", EventBatchResponseSchema),
      400: errorResponse("Invalid batch or empty events array"),
      422: errorResponse("Validation error"),
    },
  });
}
