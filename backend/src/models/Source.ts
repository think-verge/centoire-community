import mongoose, { Schema, type Document, type Types } from "mongoose";
import { POST_CATEGORIES, isValidSubcategory, type PostCategory } from "../config/categoryTaxonomy.js";

/** What kind of address `feedUrl` holds. Only "rss" is fetched by the app's own importer;
 *  the other kinds are watched by the discovery engine (see `fetchedBy`). "discovery" is the
 *  single source that the engine's stories are attributed to. */
export const SOURCE_KINDS = ["rss", "sitemap", "page", "instagram", "discovery"] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];
/** Who polls the source: the app's RSS cron, or the discovery engine. */
export type SourceFetcher = "app" | "discovery";
/** Sources the discovery engine proposes wait for an admin: suggested → approved | rejected. */
export type SourceReview = "suggested" | "approved" | "rejected";

export interface ISourceSuggestion {
  reason: string;
  evidence: string[];
  score?: number;
  suggestedAt: Date;
}

export interface ISource extends Document {
  _id: Types.ObjectId;
  name: string;
  siteUrl: string;
  feedUrl: string;
  faviconUrl?: string;
  /** Default hashtags copied onto every post ingested from this source. */
  hashtags: string[];
  /** Ingestion default only — individual posts from this source can still be
   *  re-tagged into a more specific category/subcategory (e.g. via AI backfill). */
  category?: PostCategory;
  subcategory?: string;
  active: boolean;
  kind: SourceKind;
  fetchedBy: SourceFetcher;
  /** ISO-2 market the source covers, or GLOBAL. */
  region?: string;
  review?: SourceReview;
  suggestion?: ISourceSuggestion;
  followerCount: number;
  lastFetchedAt?: Date;
  lastStatus?: "ok" | "error";
  lastError?: string;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const sourceSchema = new Schema<ISource>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    siteUrl: { type: String, required: true },
    feedUrl: { type: String, required: true, unique: true },
    faviconUrl: { type: String },
    hashtags: { type: [String], default: [] },
    category: { type: String, enum: POST_CATEGORIES },
    subcategory: { type: String },
    active: { type: Boolean, default: true },
    kind: { type: String, enum: SOURCE_KINDS, default: "rss" },
    fetchedBy: { type: String, enum: ["app", "discovery"], default: "app" },
    region: { type: String, uppercase: true, maxlength: 6 },
    review: { type: String, enum: ["suggested", "approved", "rejected"] },
    suggestion: {
      type: new Schema<ISourceSuggestion>(
        {
          reason: { type: String, maxlength: 300 },
          evidence: { type: [String], default: [] },
          score: { type: Number },
          suggestedAt: { type: Date },
        },
        { _id: false },
      ),
    },
    followerCount: { type: Number, default: 0 },
    lastFetchedAt: { type: Date },
    lastStatus: { type: String, enum: ["ok", "error"] },
    lastError: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

sourceSchema.index({ fetchedBy: 1, active: 1 });
sourceSchema.index({ review: 1 });

sourceSchema.pre("validate", function (next) {
  if (this.kind !== "rss" && this.fetchedBy !== "discovery") {
    // The app's importer only reads RSS/Atom; anything else must be watched by the engine.
    this.fetchedBy = "discovery";
  }
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

export const Source = mongoose.model<ISource>("Source", sourceSchema);
