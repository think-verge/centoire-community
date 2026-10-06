import mongoose, { Schema, type Document, type Types } from "mongoose";
import { APPLICATION_STATUSES, type ApplicationStatus } from "../taxonomy.js";

export interface IApplication extends Document {
  _id: Types.ObjectId;
  jobId: Types.ObjectId;
  companyId: Types.ObjectId;
  applicantId: string;
  coverNote?: string;
  answers: Array<{ questionId: string; answer: string }>;
  portfolioUrl?: string;
  profileSnapshot?: { headline?: string; location?: string; skills: string[] };
  status: ApplicationStatus;
  statusHistory: Array<{ status: ApplicationStatus; at: Date; by: string }>;
  /** Internal to the hiring team; never serialized to the applicant. */
  recruiterNotes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const applicationSchema = new Schema<IApplication>(
  {
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true },
    companyId: { type: Schema.Types.ObjectId, ref: "Company", required: true },
    applicantId: { type: String, required: true },
    coverNote: { type: String, maxlength: 4000 },
    answers: {
      type: [{ questionId: String, answer: { type: String, maxlength: 2000 }, _id: false }],
      default: [],
    },
    portfolioUrl: String,
    profileSnapshot: { headline: String, location: String, skills: { type: [String], default: [] } },
    status: { type: String, enum: APPLICATION_STATUSES, default: "submitted" },
    statusHistory: {
      type: [{ status: { type: String, enum: APPLICATION_STATUSES }, at: Date, by: String, _id: false }],
      default: [],
    },
    recruiterNotes: { type: String, maxlength: 4000 },
  },
  { timestamps: true },
);

applicationSchema.index({ jobId: 1, applicantId: 1 }, { unique: true });
applicationSchema.index({ applicantId: 1, createdAt: -1 });
applicationSchema.index({ jobId: 1, status: 1, createdAt: -1 });

export const Application = mongoose.model<IApplication>("Application", applicationSchema);
