import mongoose, { Schema, type Document, type Types } from "mongoose";
import { POST_CATEGORIES, isValidSubcategory, type PostCategory } from "../config/categoryTaxonomy.js";

export interface ISource extends Document {
  _id: Types.ObjectId;
  name: string;
  siteUrl: string;
  feedUrl: string;
  faviconUrl?: string;
  tags: Types.ObjectId[];
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
    feedUrl: { type: String, required: true, unique: true },
    faviconUrl: { type: String },
    tags: [{ type: Schema.Types.ObjectId, ref: "Tag" }],
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
