import mongoose, { Schema, type Document, type Types } from "mongoose";
import { COMPANY_SEGMENTS, COMPANY_SIZES } from "../taxonomy.js";

export interface ICompany extends Document {
  _id: Types.ObjectId;
  slug: string;
  name: string;
  logoUrl?: string;
  coverUrl?: string;
  website?: string;
  about?: string;
  segment: (typeof COMPANY_SEGMENTS)[number];
  sizeRange?: (typeof COMPANY_SIZES)[number];
  hq?: { city?: string; countryCode?: string };
  verified: boolean;
  verifiedAt?: Date;
  verifiedBy?: string;
  status: "active" | "suspended";
  createdBy: string;
  openJobCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const companySchema = new Schema<ICompany>(
  {
    slug: { type: String, required: true, unique: true, lowercase: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    logoUrl: String,
    coverUrl: String,
    website: String,
    about: { type: String, maxlength: 4000 },
    segment: { type: String, enum: COMPANY_SEGMENTS, default: "other" },
    sizeRange: { type: String, enum: COMPANY_SIZES },
    hq: { city: String, countryCode: { type: String, uppercase: true, maxlength: 2 } },
    verified: { type: Boolean, default: false },
    verifiedAt: Date,
    verifiedBy: String,
    status: { type: String, enum: ["active", "suspended"], default: "active" },
    createdBy: { type: String, required: true },
    openJobCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

companySchema.index({ name: "text", about: "text" });
companySchema.index({ status: 1, verified: 1 });

export const Company = mongoose.model<ICompany>("Company", companySchema);
