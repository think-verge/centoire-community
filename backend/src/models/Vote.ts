import mongoose, { Schema, type Document, type Types } from "mongoose";

export type VoteTargetType = "post" | "comment";

export interface IVote extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  targetType: VoteTargetType;
  targetId: Types.ObjectId;
  value: 1 | -1;
  createdAt: Date;
  updatedAt: Date;
}

const voteSchema = new Schema<IVote>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetType: { type: String, enum: ["post", "comment"], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    value: { type: Number, enum: [1, -1], required: true },
  },
  { timestamps: true },
);

voteSchema.index({ userId: 1, targetType: 1, targetId: 1 }, { unique: true });
voteSchema.index({ targetType: 1, targetId: 1 });

export const Vote = mongoose.model<IVote>("Vote", voteSchema);
