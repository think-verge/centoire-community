import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface ICircle extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description: string;
  about?: string;
  rules: string[];
  avatarUrl?: string;
  coverImageUrl?: string;
  tags: Types.ObjectId[];
  createdBy: Types.ObjectId;
  memberCount: number;
  postCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const circleSchema = new Schema<ICircle>(
  {
    name: { type: String, required: true, trim: true, maxlength: 60 },
    slug: { type: String, required: true, unique: true, lowercase: true },
    description: { type: String, required: true, maxlength: 160 },
    about: { type: String, maxlength: 4000 },
    rules: { type: [String], default: [] },
    avatarUrl: { type: String },
    coverImageUrl: { type: String },
    tags: [{ type: Schema.Types.ObjectId, ref: "Tag" }],
    createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    memberCount: { type: Number, default: 0 },
    postCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

circleSchema.index({ name: "text", description: "text" });
circleSchema.index({ memberCount: -1 });

export const Circle = mongoose.model<ICircle>("Circle", circleSchema);
