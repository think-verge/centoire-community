import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface ISource extends Document {
  _id: Types.ObjectId;
  name: string;
  siteUrl: string;
  feedUrl: string;
  faviconUrl?: string;
  tags: Types.ObjectId[];
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
    active: { type: Boolean, default: true },
    lastFetchedAt: { type: Date },
    lastStatus: { type: String, enum: ["ok", "error"] },
    lastError: { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

export const Source = mongoose.model<ISource>("Source", sourceSchema);
