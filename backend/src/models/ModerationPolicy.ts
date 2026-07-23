import mongoose, { Schema, type Document, type Types } from "mongoose";

export type PolicyType = "user" | "source" | "all";
export type PolicyAction = "auto_approve" | "auto_reject";

export interface IModerationPolicy extends Document {
  _id: Types.ObjectId;
  type: PolicyType;
  targetId?: Types.ObjectId;
  action: PolicyAction;
  reason?: string;
  createdBy: Types.ObjectId;
  active: boolean;
  expiresAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const moderationPolicySchema = new Schema<IModerationPolicy>(
  {
    type: { type: String, enum: ["user", "source", "all"], required: true },
    targetId: { type: Schema.Types.ObjectId },
    action: { type: String, enum: ["auto_approve", "auto_reject"], required: true },
    reason: { type: String, maxlength: 500 },
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    active: { type: Boolean, default: true },
    expiresAt: { type: Date },
  },
  { timestamps: true },
);

moderationPolicySchema.index({ type: 1, active: 1, expiresAt: 1 });

export const ModerationPolicy = mongoose.model<IModerationPolicy>(
  "ModerationPolicy",
  moderationPolicySchema,
);
