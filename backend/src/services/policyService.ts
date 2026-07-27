import { Types } from "mongoose";
import {
  ModerationPolicy,
  type ICondition,
  type IModerationPolicy,
  type PolicyAction,
} from "../models/ModerationPolicy.js";
import { ApiError } from "../utils/api-error.js";

export interface PolicyContext {
  // Identity — available at ingestion / post creation
  authorId?: string;
  authorEmail?: string;
  authorRole?: string;
  sourceId?: string;
  origin?: string;
  // Content — available only after AI agent callback
  aiCategory?: string;
  aiTags?: string[];
  aiQualityScore?: number;
  aiIsSpam?: boolean;
  clickbaitDetected?: boolean;
}

// Maps a condition key to the corresponding PolicyContext field value.
function resolveField(key: ICondition["key"], ctx: PolicyContext): unknown {
  switch (key) {
    case "author":
      return ctx.authorEmail;
    case "author_role":
      return ctx.authorRole;
    case "source":
      return ctx.sourceId;
    case "origin":
      return ctx.origin;
    case "ai_category":
      return ctx.aiCategory;
    case "ai_tags":
      return ctx.aiTags;
    case "ai_quality_score":
      return ctx.aiQualityScore;
    case "ai_is_spam":
      return ctx.aiIsSpam;
    case "clickbait":
      return ctx.clickbaitDetected;
  }
}

function matchCondition(condition: ICondition, ctx: PolicyContext): boolean {
  const field = resolveField(condition.key, ctx);

  // If the field is undefined in the current context, the condition cannot match.
  // This makes content conditions silently skip during Phase 1 (identity-only context).
  if (field === undefined) return false;

  const { operator, values } = condition;

  switch (operator) {
    case "equals":
      return field === values[0];
    case "not_equals":
      return field !== values[0];
    case "any_of":
      if (Array.isArray(field)) {
        return (field as unknown[]).some((v) => values.includes(v as string));
      }
      return values.includes(field as string | number | boolean);
    case "not_any_of":
      if (Array.isArray(field)) {
        return !(field as unknown[]).some((v) => values.includes(v as string));
      }
      return !values.includes(field as string | number | boolean);
    case "greater_than":
      return typeof field === "number" && field > (values[0] as number);
    case "less_than":
      return typeof field === "number" && field < (values[0] as number);
    default:
      return false;
  }
}

function matchesPolicy(policy: IModerationPolicy, ctx: PolicyContext): boolean {
  // Empty conditions = catch-all — matches everything.
  if (policy.conditions.length === 0) return true;

  const results = policy.conditions.map((c) => matchCondition(c, ctx));
  return policy.logic === "or" ? results.some(Boolean) : results.every(Boolean);
}

// Returns the action from the first matching active policy (sorted by priority descending),
// or null if no policy matches (caller defaults to pending_review).
export async function evaluate(ctx: PolicyContext): Promise<PolicyAction | null> {
  const now = new Date();
  const policies = await ModerationPolicy.find({
    active: true,
    $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }],
  }).sort({ priority: -1 });

  for (const policy of policies) {
    if (matchesPolicy(policy, ctx)) return policy.action;
  }
  return null;
}

export async function listPolicies(): Promise<IModerationPolicy[]> {
  return ModerationPolicy.find()
    .sort({ priority: -1, createdAt: -1 })
    .populate("createdBy", "displayName handle");
}

export async function createPolicy(
  editorId: string,
  input: {
    name: string;
    conditions?: ICondition[];
    logic?: "and" | "or";
    action: PolicyAction;
    priority?: number;
    reason?: string;
    expiresAt?: string;
  },
): Promise<IModerationPolicy> {
  const policy = await ModerationPolicy.create({
    name: input.name,
    conditions: input.conditions ?? [],
    logic: input.logic ?? "and",
    action: input.action,
    priority: input.priority ?? 0,
    reason: input.reason,
    createdBy: new Types.ObjectId(editorId),
    expiresAt: input.expiresAt ? new Date(input.expiresAt) : undefined,
  });
  return policy;
}

export async function updatePolicy(
  id: string,
  input: { active?: boolean; reason?: string; expiresAt?: string | null },
): Promise<IModerationPolicy> {
  const policy = await ModerationPolicy.findById(id);
  if (!policy) throw new ApiError(404, "Policy not found");
  if (input.active !== undefined) policy.active = input.active;
  if (input.reason !== undefined) policy.reason = input.reason;
  if (input.expiresAt !== undefined) {
    policy.expiresAt = input.expiresAt ? new Date(input.expiresAt) : undefined;
  }
  await policy.save();
  return policy;
}

export async function deletePolicy(id: string): Promise<void> {
  const policy = await ModerationPolicy.findById(id);
  if (!policy) throw new ApiError(404, "Policy not found");
  await policy.deleteOne();
}
