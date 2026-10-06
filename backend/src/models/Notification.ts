import mongoose, { Schema, type Document, type Types } from "mongoose";
import { JOBS_EVENTS, type JobsEvent } from "@centoire/contracts";

export type NotificationType =
  | JobsEvent
  | "user.followed"
  | "post.upvoted"
  | "comment.upvoted"
  | "comment.created"
  | "comment.replied"
  | "comment.mentioned"
  | "post.approved"
  | "post.rejected";

export interface INotification extends Document {
  _id: Types.ObjectId;
  recipientId: Types.ObjectId;
  actorId?: Types.ObjectId;
  type: NotificationType;
  targetPostId?: Types.ObjectId;
  targetCommentId?: Types.ObjectId;
  targetUserId?: Types.ObjectId;
  /** Which app produced the notification; mini-app ones carry their own text and link. */
  app: "core" | "jobs";
  message?: string;
  link?: string;
  readAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const notificationSchema = new Schema<INotification>(
  {
    recipientId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    actorId: { type: Schema.Types.ObjectId, ref: "User" },
    type: {
      type: String,
      enum: [
        "user.followed",
        "post.upvoted",
        "comment.upvoted",
        "comment.created",
        "comment.replied",
        "comment.mentioned",
        "post.approved",
        "post.rejected",
        ...JOBS_EVENTS,
      ],
      required: true,
    },
    app: { type: String, enum: ["core", "jobs"], default: "core" },
    message: { type: String, maxlength: 300 },
    link: { type: String, maxlength: 500 },
    targetPostId: { type: Schema.Types.ObjectId, ref: "Post" },
    targetCommentId: { type: Schema.Types.ObjectId, ref: "Comment" },
    targetUserId: { type: Schema.Types.ObjectId, ref: "User" },
    readAt: { type: Date },
  },
  { timestamps: true },
);

notificationSchema.index({ recipientId: 1, createdAt: -1 });
notificationSchema.index({ recipientId: 1, readAt: 1 });

export const Notification = mongoose.model<INotification>("Notification", notificationSchema);
