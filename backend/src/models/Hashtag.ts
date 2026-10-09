import mongoose, { Schema, type Document, type Types } from "mongoose";

export type HashtagStatus = "active" | "blocked";

export interface IHashtag extends Document {
  _id: Types.ObjectId;
  /** Normalized, unique, without the leading "#" (see utils/hashtag.ts). */
  name: string;
  /** Published posts that use it. Maintained on publish/edit/delete and reconciled nightly. */
  postCount: number;
  followerCount: number;
  /** Curated: shown to new users in onboarding. */
  featured: boolean;
  /** Blocked hashtags never appear in suggestions and are stripped from new posts. */
  status: HashtagStatus;
  createdBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const hashtagSchema = new Schema<IHashtag>(
  {
    name: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 30 },
    postCount: { type: Number, default: 0, min: 0 },
    followerCount: { type: Number, default: 0, min: 0 },
    featured: { type: Boolean, default: false },
    status: { type: String, enum: ["active", "blocked"], default: "active" },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true, collection: "hashtags" },
);

// `name` is unique (anchored prefix scans use that index); these serve the popularity sorts.
hashtagSchema.index({ postCount: -1 });
hashtagSchema.index({ featured: 1, postCount: -1 });

export const Hashtag = mongoose.model<IHashtag>("Hashtag", hashtagSchema);
