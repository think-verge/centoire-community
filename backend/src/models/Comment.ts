import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IComment extends Document {
  _id: Types.ObjectId;
  postId: Types.ObjectId;
  authorId: Types.ObjectId;
  parentId?: Types.ObjectId;
  depth: number;
  content: string;
  upvoteCount: number;
  replyCount: number;
  status: "active" | "deleted";
  createdAt: Date;
  updatedAt: Date;
}

const commentSchema = new Schema<IComment>(
  {
    postId: { type: Schema.Types.ObjectId, ref: "Post", required: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    parentId: { type: Schema.Types.ObjectId, ref: "Comment" },
    depth: { type: Number, default: 0, max: 2 },
    content: { type: String, required: true, maxlength: 2000 },
    upvoteCount: { type: Number, default: 0 },
    replyCount: { type: Number, default: 0 },
    status: { type: String, enum: ["active", "deleted"], default: "active" },
  },
  { timestamps: true },
);

commentSchema.index({ postId: 1, parentId: 1, createdAt: 1 });

export const Comment = mongoose.model<IComment>("Comment", commentSchema);
