import mongoose, { Schema, type Document, type Types } from "mongoose";
import { POST_CATEGORIES, isValidSubcategory, type PostCategory } from "../config/categoryTaxonomy.js";

export type PostOrigin = "native" | "aggregated";
export type PostStatus = "draft" | "pending_review" | "published" | "rejected" | "removed";

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
  category?: PostCategory;
  subcategory?: string;
  country?: string;
  upvoteCount: number;
  downvoteCount: number;
  commentCount: number;
  bookmarkCount: number;
  viewCount: number;
  readTimeMinutes: number;
  publishedAt?: Date;
  reviewedBy?: Types.ObjectId;
  reviewedAt?: Date;
  rejectionReason?: string;
  aiProcessed?: boolean;
  aiReadTimeMinutes?: number;
  aiCategory?: string;
  aiTags?: string[];
  aiQualityScore?: number;
  aiIsSpam?: boolean;
  aiSummary?: string;
  clickbaitDetected?: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const postSchema = new Schema<IPost>(
  {
    origin: { type: String, enum: ["native", "aggregated"], required: true },
    status: {
      type: String,
      enum: ["draft", "pending_review", "published", "rejected", "removed"],
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
    category: { type: String, enum: POST_CATEGORIES },
    subcategory: { type: String },
    country: { type: String, uppercase: true, minlength: 2, maxlength: 2 },
    upvoteCount: { type: Number, default: 0 },
    downvoteCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    bookmarkCount: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },
    readTimeMinutes: { type: Number, default: 1 },
    publishedAt: { type: Date },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
    rejectionReason: { type: String, maxlength: 500 },
    aiProcessed: { type: Boolean, default: false },
    aiReadTimeMinutes: { type: Number },
    aiCategory: { type: String },
    aiTags: { type: [String], default: [] },
    aiQualityScore: { type: Number },
    aiIsSpam: { type: Boolean },
    aiSummary: { type: String },
    clickbaitDetected: { type: Boolean },
  },
  { timestamps: true },
);

postSchema.index({ status: 1, publishedAt: -1 });
postSchema.index({ status: 1, createdAt: -1 }); // for moderation queue ordering
postSchema.index({ status: 1, tags: 1, publishedAt: -1 });
postSchema.index({ status: 1, circleId: 1, publishedAt: -1 });
postSchema.index({ authorId: 1, status: 1, updatedAt: -1 });
postSchema.index({ status: 1, category: 1, publishedAt: -1 });
postSchema.index({ status: 1, category: 1, subcategory: 1, publishedAt: -1 });
postSchema.index({ status: 1, country: 1, publishedAt: -1 });
postSchema.index({ title: "text", contentText: "text", excerpt: "text" });

postSchema.pre("validate", function (next) {
  if (this.subcategory && !this.category) {
    next(new Error("subcategory requires category"));
    return;
  }
  if (this.category && this.subcategory && !isValidSubcategory(this.category, this.subcategory)) {
    next(new Error(`"${this.subcategory}" is not a valid subcategory of "${this.category}"`));
    return;
  }
  next();
});

export const Post = mongoose.model<IPost>("Post", postSchema);
