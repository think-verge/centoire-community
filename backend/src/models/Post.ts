import mongoose, { Schema, type Document, type Types } from "mongoose";
import { POST_CATEGORIES, isValidSubcategory, type PostCategory } from "../config/categoryTaxonomy.js";

export type PostOrigin = "native" | "aggregated";
export type PostStatus = "draft" | "pending_review" | "published" | "rejected" | "removed";

/** Evidence from the discovery engine for a story it put up for review: how widely the story
 *  spread, who published it first, and when the engine saw it. */
export interface IPostDiscovery {
  storyId: string;
  category?: string;
  websiteCount: number;
  articleCount: number;
  firstPublished?: { name: string; url?: string; at: Date };
  engineSawAt?: Date;
  spread: Array<{ name: string; url?: string; firstAt: Date }>;
  markets: string[];
  updatedAt: Date;
}

export interface IPost extends Document {
  _id: Types.ObjectId;
  origin: PostOrigin;
  status: PostStatus;
  curated?: boolean;
  authorId?: Types.ObjectId;
  sourceId?: Types.ObjectId;
  title: string;
  slug: string;
  content?: unknown;
  contentHtml?: string;
  contentText?: string;
  excerpt: string;
  coverImageUrl?: string;
  externalUrl?: string;
  canonicalUrlHash?: string;
  /** Normalized hashtag names (see utils/hashtag.ts), 1-5 once published. */
  hashtags: string[];
  circleId?: Types.ObjectId;
  category?: PostCategory;
  subcategory?: string;
  country?: string;
  upvoteCount: number;
  downvoteCount: number;
  commentCount: number;
  bookmarkCount: number;
  viewCount: number;
  /** "Read post" clicks out to the original article, counted by GET /r/:id. */
  clickCount: number;
  /** Subset of clickCount opened inside Centoire through the Reader extension (the rest opened a new tab). */
  readerOpenCount: number;
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
  // Embedding fields
  embedding?: number[];
  embeddingModel?: string;
  embeddingVersion?: string;
  embeddingStatus?: "pending" | "completed" | "failed";
  clusterId?: number;
  clusterVersion?: number;
  discovery?: IPostDiscovery;
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
    curated: { type: Boolean, default: false, index: true },
    authorId: { type: Schema.Types.ObjectId, ref: "User" },
    sourceId: { type: Schema.Types.ObjectId, ref: "Source" },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    slug: { type: String, required: true, unique: true },
    content: { type: Schema.Types.Mixed },
    contentHtml: { type: String },
    contentText: { type: String },
    excerpt: { type: String, default: "", maxlength: 300 },
    coverImageUrl: { type: String },
    externalUrl: { type: String },
    canonicalUrlHash: { type: String, unique: true, sparse: true },
    hashtags: { type: [String], default: [] },
    circleId: { type: Schema.Types.ObjectId, ref: "Circle" },
    category: { type: String, enum: POST_CATEGORIES },
    subcategory: { type: String },
    country: { type: String, uppercase: true, minlength: 2, maxlength: 2 },
    upvoteCount: { type: Number, default: 0 },
    downvoteCount: { type: Number, default: 0 },
    commentCount: { type: Number, default: 0 },
    bookmarkCount: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },
    clickCount: { type: Number, default: 0 },
    readerOpenCount: { type: Number, default: 0 },
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
    // Embedding fields
    embedding: { type: [Number] },
    embeddingModel: { type: String },
    embeddingVersion: { type: String },
    embeddingStatus: { type: String, enum: ["pending", "completed", "failed"] },
    clusterId: { type: Number },
    clusterVersion: { type: Number },
    discovery: {
      type: new Schema<IPostDiscovery>(
        {
          storyId: { type: String, required: true },
          category: { type: String },
          websiteCount: { type: Number, default: 0 },
          articleCount: { type: Number, default: 0 },
          firstPublished: { name: String, url: String, at: Date },
          engineSawAt: { type: Date },
          spread: { type: [{ name: String, url: String, firstAt: Date, _id: false }], default: [] },
          markets: { type: [String], default: [] },
          updatedAt: { type: Date },
        },
        { _id: false },
      ),
    },
  },
  { timestamps: true },
);

postSchema.index({ status: 1, publishedAt: -1 });
postSchema.index({ status: 1, curated: 1, publishedAt: -1 });
postSchema.index({ status: 1, createdAt: -1 }); // for moderation queue ordering
postSchema.index({ status: 1, hashtags: 1, publishedAt: -1 });
postSchema.index({ status: 1, circleId: 1, publishedAt: -1 });
postSchema.index({ authorId: 1, status: 1, updatedAt: -1 });
postSchema.index({ status: 1, category: 1, publishedAt: -1 });
postSchema.index({ status: 1, category: 1, subcategory: 1, publishedAt: -1 });
postSchema.index({ status: 1, country: 1, publishedAt: -1 });
postSchema.index({ title: "text", contentText: "text", excerpt: "text" });
postSchema.index({ embeddingStatus: 1, createdAt: -1 });
postSchema.index({ clusterId: 1, createdAt: -1 }, { sparse: true });
postSchema.index({ "discovery.storyId": 1 }, { unique: true, sparse: true });
postSchema.index({ "discovery.storyId": 1, reviewedAt: 1 }, { sparse: true });

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
