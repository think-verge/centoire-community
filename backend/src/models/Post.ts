import mongoose, { Schema, type Document, type Types } from "mongoose";

export type PostOrigin = "native" | "aggregated";
export type PostStatus = "draft" | "published" | "removed";

export interface IPost extends Document {
  _id: Types.ObjectId;
  origin: PostOrigin;
  status: PostStatus;
  authorId?: Types.ObjectId;
  sourceId?: Types.ObjectId;
  title: string;
  slug: string;
  content?: unknown;
  contentText?: string;
  excerpt: string;
  coverImageUrl?: string;
  externalUrl?: string;
  canonicalUrlHash?: string;
  tags: Types.ObjectId[];
  circleId?: Types.ObjectId;
  upvoteCount: number;
  downvoteCount: number;
  commentCount: number;
  bookmarkCount: number;
  viewCount: number;
  readTimeMinutes: number;
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const postSchema = new Schema<IPost>(
  {
    origin: { type: String, enum: ["native", "aggregated"], required: true },
    status: {
      type: String,
      enum: ["draft", "published", "removed"],
      default: "draft",
    },
    authorId: { type: Schema.Types.ObjectId, ref: "User" },
    sourceId: { type: Schema.Types.ObjectId, ref: "Source" },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, unique: true },
    content: { type: Schema.Types.Mixed },
    contentText: { type: String },
    excerpt: { type: String, default: "", maxlength: 300 },
    coverImageUrl: { type: String },
    externalUrl: { type: String },
    canonicalUrlHash: { type: String, unique: true, sparse: true },
    tags: [{ type: Schema.Types.ObjectId, ref: "Tag" }],
    circleId: { type: Schema.Types.ObjectId, ref: "Circle" },
    upvoteCount: { type: Number, default: 0 },
    downvoteCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    bookmarkCount: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },
    readTimeMinutes: { type: Number, default: 1 },
    publishedAt: { type: Date },
  },
  { timestamps: true },
);

postSchema.index({ status: 1, publishedAt: -1 });
postSchema.index({ status: 1, tags: 1, publishedAt: -1 });
postSchema.index({ status: 1, circleId: 1, publishedAt: -1 });
postSchema.index({ authorId: 1, status: 1, updatedAt: -1 });
postSchema.index({ title: "text", contentText: "text", excerpt: "text" });

export const Post = mongoose.model<IPost>("Post", postSchema);
