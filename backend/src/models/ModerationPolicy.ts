import mongoose, { Schema, type Document, type Types } from "mongoose";

export type PolicyAction = "auto_approve" | "auto_reject";

export type ConditionKey =
  | "author"
  | "author_role"
  | "source"
  | "origin"
  | "ai_category"
  | "ai_tags"
  | "ai_quality_score"
  | "ai_is_spam"
  | "clickbait";

export type ConditionOperator =
  | "equals"
  | "not_equals"
  | "any_of"
  | "not_any_of"
  | "greater_than"
  | "less_than";

export interface ICondition {
  key: ConditionKey;
  operator: ConditionOperator;
  values: (string | number | boolean)[];
}

export interface IModerationPolicy extends Document {
  _id: Types.ObjectId;
  name: string;
  conditions: ICondition[];
  logic: "and" | "or";
  action: PolicyAction;
  priority: number;
  reason?: string;
  createdBy: Types.ObjectId;
  active: boolean;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const conditionSchema = new Schema<ICondition>(
  {
    key: {
      type: String,
      enum: [
        "author",
        "author_role",
        "source",
        "origin",
        "ai_category",
        "ai_tags",
        "ai_quality_score",
        "ai_is_spam",
        "clickbait",
      ],
      required: true,
    },
    operator: {
      type: String,
      enum: ["equals", "not_equals", "any_of", "not_any_of", "greater_than", "less_than"],
      required: true,
    },
    values: { type: [Schema.Types.Mixed], default: [] },
  },
  { _id: false },
);

const moderationPolicySchema = new Schema<IModerationPolicy>(
  {
    name: { type: String, required: true, maxlength: 100 },
    conditions: { type: [conditionSchema], default: [] },
    logic: { type: String, enum: ["and", "or"], default: "and" },
    action: { type: String, enum: ["auto_approve", "auto_reject"], required: true },
    priority: { type: Number, default: 0 },
    reason: { type: String, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    active: { type: Boolean, default: true },
    expiresAt: { type: Date },
  },
  { timestamps: true },
);

moderationPolicySchema.index({ active: 1, priority: -1 });

export const ModerationPolicy = mongoose.model<IModerationPolicy>(
  "ModerationPolicy",
  moderationPolicySchema,
);
