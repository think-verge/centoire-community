import mongoose, { Schema, type Document, type Types } from "mongoose";
import type { CircleSnapshot, DomainEvent, PostSnapshot, UserSnapshot } from "@centoire/contracts";

export type NotificationType = Exclude<DomainEvent, "user.deleted">;

export const NOTIFICATION_TYPES: NotificationType[] = [
  "user.followed",
  "post.upvoted",
  "comment.upvoted",
  "comment.created",
  "comment.replied",
  "comment.mentioned",
  "post.approved",
  "post.rejected",
  "circle.invite",
];

// Ids point at other services' data; the snapshots are what we render from, so
// no cross-database populate is ever needed.
export interface INotification extends Document {
  _id: Types.ObjectId;
  recipientId: string;
  actorId?: string;
  type: NotificationType;
  actor?: UserSnapshot;
  targetPostId?: string;
  targetPost?: PostSnapshot;
  targetCommentId?: string;
  targetCircleId?: string;
  targetCircle?: CircleSnapshot;
  targetInviteToken?: string;
  readAt?: Date;
  legacyId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    recipientId: { type: String, required: true },
    actorId: { type: String },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    actor: { type: Schema.Types.Mixed },
    targetPostId: { type: String },
    targetPost: { type: Schema.Types.Mixed },
    targetCommentId: { type: String },
    targetCircleId: { type: String },
    targetCircle: { type: Schema.Types.Mixed },
    targetInviteToken: { type: String },
    readAt: { type: Date },
    // Set on migrated rows to keep the original id for idempotent re-runs.
    legacyId: { type: String, index: { unique: true, sparse: true } },
  },
  { timestamps: true },
);

notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, readAt: 1 });
notificationSchema.index({ actorId: 1 });

export const Notification = mongoose.model<INotification>("Notification", notificationSchema);
