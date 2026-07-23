import { Types } from "mongoose";
import { ModerationPolicy, type IModerationPolicy, type PolicyAction } from "../models/ModerationPolicy.js";
import { ApiError } from "../utils/api-error.js";

// Evaluation precedence:
// 1. type: "user" matching authorId (native posts)
// 2. type: "source" matching sourceId (aggregated posts)
// 3. type: "all"
// First active, non-expired match wins. No match → null (caller defaults to pending_review).
export async function evaluate({
  authorId,
  sourceId,
}: {
  authorId?: string | Types.ObjectId | undefined;
  sourceId?: string | Types.ObjectId | undefined;
}): Promise<PolicyAction | null> {
  const now = new Date();
  const baseFilter = {
    active: true,
    $or: [{ expiresAt: { $exists: false } }, { expiresAt: { $gt: now } }],
  };

  if (authorId) {
    const userPolicy = await ModerationPolicy.findOne({
      ...baseFilter,
      type: "user",
      targetId: new Types.ObjectId(authorId.toString()),
    });
    if (userPolicy) return userPolicy.action;
  }

  if (sourceId) {
    const sourcePolicy = await ModerationPolicy.findOne({
      ...baseFilter,
      type: "source",
      targetId: new Types.ObjectId(sourceId.toString()),
    });
    if (sourcePolicy) return sourcePolicy.action;
  }

  const allPolicy = await ModerationPolicy.findOne({ ...baseFilter, type: "all" });
  return allPolicy ? allPolicy.action : null;
}

export async function listPolicies(): Promise<IModerationPolicy[]> {
  return ModerationPolicy.find().sort({ createdAt: -1 }).populate("createdBy", "displayName handle");
}

export async function createPolicy(
  editorId: string,
  input: {
    type: "user" | "source" | "all";
    targetId?: string;
    action: PolicyAction;
    reason?: string;
    expiresAt?: string;
  },
): Promise<IModerationPolicy> {
  const policy = await ModerationPolicy.create({
    type: input.type,
    targetId: input.targetId ? new Types.ObjectId(input.targetId) : undefined,
    action: input.action,
    reason: input.reason,
    createdBy: editorId,
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
