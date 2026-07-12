import mongoose, { Schema, type Document, type Types } from "mongoose";

export type ReputationEventType =
  | "post_published"
  | "post_upvoted"
  | "comment_upvoted"
  | "vote_removed";

export interface IReputationEvent extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  type: ReputationEventType;
  amount: number;
  actorId?: Types.ObjectId;
  refType: "post" | "comment";
  refId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const reputationEventSchema = new Schema<IReputationEvent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: {
      type: String,
      enum: ["post_published", "post_upvoted", "comment_upvoted", "vote_removed"],
      required: true,
    },
    amount: { type: Number, required: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    refType: { type: String, enum: ["post", "comment"], required: true },
    refId: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: true },
);

reputationEventSchema.index({ userId: 1, createdAt: -1 });

export const ReputationEvent = mongoose.model<IReputationEvent>(
  "ReputationEvent",
  reputationEventSchema,
);
