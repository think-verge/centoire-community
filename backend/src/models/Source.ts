import mongoose, { Schema, type Document, type Types } from "mongoose";
import { POST_CATEGORIES, isValidSubcategory, type PostCategory } from "../config/categoryTaxonomy.js";

export type SourceMethod = "agent" | "rss";
export type SpecStatus = "none" | "discovering" | "ready" | "needs_rediscovery" | "needs_human";
export type ScrapeErrorCode = "login_expired" | "layout_changed" | "needs_human" | "blocked" | "network" | "internal";
export const SCRAPE_ERROR_CODES: ScrapeErrorCode[] = [
  "login_expired",
  "layout_changed",
  "needs_human",
  "blocked",
  "network",
  "internal",
];

export interface ISource extends Document {
  _id: Types.ObjectId;
  name: string;
  siteUrl: string;
  /** Optional hint for the scraping agent (an RSS/Atom feed it can start from). */
  feedUrl?: string;
  faviconUrl?: string;
  /** "agent" = scraped by the external scraper-agent; "rss" = legacy in-process RSS fetch. */
  method: SourceMethod;
  /** The site needs a logged-in account to read articles (paid content). */
  requiresLogin: boolean;
  /** Name of the login in the scraper VM's secrets file. Never a password. */
  credentialRef?: string;
  /** How often to scrape, in minutes. */
  scrapeIntervalMin: number;
  /** State of the agent's per-source YAML spec (the YAML itself lives in git). */
  spec: {
    status: SpecStatus;
    hash?: string;
    discoveredAt?: Date;
    /** "full" keeps article bodies; "excerpt" keeps title/excerpt/link-out only. */
    store: "full" | "excerpt";
  };
  lastRun?: {
    status: "ok" | "error";
    errorCode?: ScrapeErrorCode;
    errorMessage?: string;
    itemsSeen: number;
    imported: number;
    duplicates: number;
    finishedAt: Date;
  };
  /** Default hashtags copied onto every post ingested from this source. */
  hashtags: string[];
  /** Ingestion default only — individual posts from this source can still be
   *  re-tagged into a more specific category/subcategory (e.g. via AI backfill). */
  category?: PostCategory;
  subcategory?: string;
  active: boolean;
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
    feedUrl: { type: String },
    method: { type: String, enum: ["agent", "rss"], default: "agent" },
    requiresLogin: { type: Boolean, default: false },
    credentialRef: { type: String, maxlength: 60, match: /^[a-z0-9][a-z0-9_-]*$/ },
    scrapeIntervalMin: { type: Number, default: 30, min: 5, max: 7 * 24 * 60 },
    spec: {
      status: { type: String, enum: ["none", "discovering", "ready", "needs_rediscovery", "needs_human"], default: "none" },
      hash: String,
      discoveredAt: Date,
      store: { type: String, enum: ["full", "excerpt"], default: "excerpt" },
    },
    lastRun: {
      status: { type: String, enum: ["ok", "error"] },
      errorCode: { type: String, enum: SCRAPE_ERROR_CODES },
      errorMessage: String,
      itemsSeen: Number,
      imported: Number,
      duplicates: Number,
      finishedAt: Date,
    },
    faviconUrl: { type: String },
    hashtags: { type: [String], default: [] },
    category: { type: String, enum: POST_CATEGORIES },
    subcategory: { type: String },
    active: { type: Boolean, default: true },
    lastFetchedAt: { type: Date },
    lastStatus: { type: String, enum: ["ok", "error"] },
    lastError: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

// Unique when present: agent-scraped sites need not have a feed. (An older non-sparse `feedUrl_1`
// index must be dropped first: scripts/migrate-sources-for-agent.ts does that.)
sourceSchema.index({ feedUrl: 1 }, { unique: true, sparse: true });
sourceSchema.index({ method: 1, active: 1 });

sourceSchema.pre("validate", function (next) {
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
