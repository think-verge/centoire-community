import mongoose, { Schema, type Document, type Types } from "mongoose";

export type NotificationType =
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
      ],
      required: true,
    },
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
