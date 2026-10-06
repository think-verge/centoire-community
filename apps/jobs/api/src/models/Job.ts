import mongoose, { Schema, type Document, type Types } from "mongoose";
import {
  EMPLOYMENT_TYPES,
  JOB_FUNCTIONS,
  JOB_STATUSES,
  SALARY_PERIODS,
  SENIORITIES,
  WORKPLACES,
  type JobStatus,
} from "../taxonomy.js";

export interface IJob extends Document {
  _id: Types.ObjectId;
  companyId: Types.ObjectId;
  postedBy: string;
  title: string;
  slug: string;
  /** Plain text with paragraph breaks; rendered with whitespace preserved (no HTML, so no XSS surface). */
  description: string;
  function: (typeof JOB_FUNCTIONS)[number];
  seniority: (typeof SENIORITIES)[number];
  employmentType: (typeof EMPLOYMENT_TYPES)[number];
  workplace: (typeof WORKPLACES)[number];
  location?: { city?: string; countryCode?: string };
  salary?: {
    min?: number;
    max?: number;
    currency?: string;
    period?: (typeof SALARY_PERIODS)[number];
    visible: boolean;
  };
  skills: string[];
  applyMode: "internal" | "external";
  externalApplyUrl?: string;
  screeningQuestions: Array<{ id: string; prompt: string; required: boolean }>;
  status: JobStatus;
  rejectionReason?: string;
  reviewedBy?: string;
  reviewedAt?: Date;
  publishedAt?: Date;
  expiresAt?: Date;
  applicationCount: number;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const jobSchema = new Schema<IJob>(
  {
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    postedBy: { type: String, required: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true },
    description: { type: String, required: true, maxlength: 12000 },
    function: { type: String, enum: JOB_FUNCTIONS, required: true },
    seniority: { type: String, enum: SENIORITIES, required: true },
    employmentType: { type: String, enum: EMPLOYMENT_TYPES, required: true },
    workplace: { type: String, enum: WORKPLACES, required: true },
    location: { city: String, countryCode: { type: String, uppercase: true, maxlength: 2 } },
    salary: {
      min: Number,
      max: Number,
      currency: { type: String, uppercase: true, maxlength: 3 },
      period: { type: String, enum: SALARY_PERIODS },
      visible: { type: Boolean, default: true },
    },
    skills: { type: [String], default: [] },
    applyMode: { type: String, enum: ["internal", "external"], default: "internal" },
    externalApplyUrl: String,
    screeningQuestions: {
      type: [{ id: String, prompt: { type: String, maxlength: 300 }, required: Boolean, _id: false }],
      default: [],
    },
    status: { type: String, enum: JOB_STATUSES, default: "draft" },
    rejectionReason: String,
    reviewedBy: String,
    reviewedAt: Date,
    publishedAt: Date,
    expiresAt: Date,
    applicationCount: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

jobSchema.index({ status: 1, publishedAt: -1, _id: -1 });
jobSchema.index({ status: 1, function: 1, publishedAt: -1 });
jobSchema.index({ status: 1, "location.countryCode": 1, publishedAt: -1 });
jobSchema.index({ companyId: 1, status: 1, updatedAt: -1 });
jobSchema.index({ status: 1, expiresAt: 1 });
jobSchema.index({ title: "text", skills: "text", description: "text" }, { weights: { title: 10, skills: 5, description: 1 } });

export const Job = mongoose.model<IJob>("Job", jobSchema);
