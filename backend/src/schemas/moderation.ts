import { registry, z, jsonBody, jsonResponse, errorResponse } from "./registry.js";
import { PostCardSchema } from "./posts.js";

const PolicyActionEnum = z.enum(["auto_approve", "auto_reject"]);

const PolicyConditionSchema = z.object({
  key: z.enum([
    "author",
    "author_role",
    "source",
    "origin",
    "ai_category",
    "ai_tags",
    "ai_quality_score",
    "ai_is_spam",
    "clickbait",
  ]),
  operator: z.enum([
    "equals",
    "not_equals",
    "any_of",
    "not_any_of",
    "greater_than",
    "less_than",
  ]),
  values: z.array(z.union([z.string(), z.number(), z.boolean()])),
});

export const ModerationPolicySchema = registry.register(
  "ModerationPolicy",
  z.object({
    id: z.string(),
    name: z.string(),
    conditions: z.array(PolicyConditionSchema),
    logic: z.enum(["and", "or"]),
    action: PolicyActionEnum,
    priority: z.number(),
    reason: z.string().nullable(),
    active: z.boolean(),
    expiresAt: z.string().nullable(),
    createdAt: z.string(),
  }),
);

export const CreatePolicyInputSchema = registry.register(
  "CreatePolicyInput",
  z.object({
    name: z.string().min(1).max(100),
    conditions: z.array(PolicyConditionSchema).default([]),
    logic: z.enum(["and", "or"]).default("and"),
    action: PolicyActionEnum,
    priority: z.number().int().default(0),
    reason: z.string().max(500).optional(),
    expiresAt: z.string().datetime().optional(),
  }),
);

export const UpdatePolicyInputSchema = registry.register(
  "UpdatePolicyInput",
  z.object({
    active: z.boolean().optional(),
    reason: z.string().max(500).optional(),
    expiresAt: z.string().datetime().nullable().optional(),
  }),
);

const RejectInputSchema = registry.register(
  "RejectInput",
  z.object({ reason: z.string().min(1).max(500) }),
);

const ModerationQueueSchema = registry.register(
  "ModerationQueue",
  z.object({
    items: z.array(PostCardSchema),
    nextCursor: z.string().nullable(),
  }),
);

const PolicyListSchema = registry.register(
  "PolicyList",
  z.object({ policies: z.array(ModerationPolicySchema) }),
);

export const ModerationQueueQuerySchema = z.object({
  cursor: z.string().optional(),
  status: z.enum(["pending_review", "rejected", "all"]).default("pending_review"),
  origin: z.enum(["native", "aggregated"]).optional(),
  source: z.string().optional(),
  tag: z.string().optional(),
  author: z.string().optional(),
});

export function registerModerationPaths(): void {
  registry.registerPath({
    method: "get",
    path: "/moderation/queue",
    tags: ["moderation"],
    operationId: "getModerationQueue",
    request: { query: ModerationQueueQuerySchema },
    responses: {
      200: jsonResponse("Pending posts awaiting review", ModerationQueueSchema),
      403: errorResponse("Insufficient permissions"),
    },
  });
  registry.registerPath({
    method: "post",
    path: "/moderation/{id}/approve",
    tags: ["moderation"],
    operationId: "approvePost",
    request: { params: z.object({ id: z.string() }) },
    responses: {
      200: jsonResponse("Post approved and published", PostCardSchema),
      404: errorResponse("Post not found or not pending review"),
    },
  });
  registry.registerPath({
    method: "post",
    path: "/moderation/{id}/reject",
    tags: ["moderation"],
    operationId: "rejectPost",
    request: {
      params: z.object({ id: z.string() }),
      body: jsonBody(RejectInputSchema),
    },
    responses: {
      200: jsonResponse("Post rejected", PostCardSchema),
      404: errorResponse("Post not found or not pending review"),
    },
  });
  registry.registerPath({
    method: "get",
    path: "/moderation/policies",
    tags: ["moderation"],
    operationId: "listPolicies",
    responses: { 200: jsonResponse("Active policies", PolicyListSchema) },
  });
  registry.registerPath({
    method: "post",
    path: "/moderation/policies",
    tags: ["moderation"],
    operationId: "createPolicy",
    request: { body: jsonBody(CreatePolicyInputSchema) },
    responses: {
      201: jsonResponse("Policy created", ModerationPolicySchema),
    },
  });
  registry.registerPath({
    method: "patch",
    path: "/moderation/policies/{id}",
    tags: ["moderation"],
    operationId: "updatePolicy",
    request: {
      params: z.object({ id: z.string() }),
      body: jsonBody(UpdatePolicyInputSchema),
    },
    responses: {
      200: jsonResponse("Policy updated", ModerationPolicySchema),
      404: errorResponse("Policy not found"),
    },
  });
  registry.registerPath({
    method: "delete",
    path: "/moderation/policies/{id}",
    tags: ["moderation"],
    operationId: "deletePolicy",
    request: { params: z.object({ id: z.string() }) },
    responses: {
      204: { description: "Policy deleted" },
      404: errorResponse("Policy not found"),
    },
  });
}
