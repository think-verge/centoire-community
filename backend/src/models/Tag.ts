import mongoose, { Schema, type Document, type Types } from "mongoose";

export type TagCategory = "style" | "craft" | "business" | "culture";

export interface ITag extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  category: TagCategory;
  description?: string;
  postCount: number;
  followerCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const tagSchema = new Schema<ITag>(
  {
    name: { type: String, required: true, trim: true, maxlength: 40 },
    slug: { type: String, required: true, unique: true, lowercase: true },
    category: {
      type: String,
      enum: ["style", "craft", "business", "culture"],
      required: true,
    },
    description: { type: String, maxlength: 200 },
    postCount: { type: Number, default: 0 },
    followerCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const Tag = mongoose.model<ITag>("Tag", tagSchema);
