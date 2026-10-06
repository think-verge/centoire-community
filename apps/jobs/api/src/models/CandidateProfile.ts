import mongoose, { Schema, type Document, type Types } from "mongoose";
import {
  JOB_FUNCTIONS,
  PROFILE_VISIBILITIES,
  WORKPLACES,
  type ProfileVisibility,
} from "../taxonomy.js";

export interface ICandidateProfile extends Document {
  _id: Types.ObjectId;
  /** Core user id. Name, handle and avatar are NOT copied here; they come from core. */
  userId: string;
  headline?: string;
  location?: string;
  openToWork: boolean;
  visibility: ProfileVisibility;
  desiredFunctions: string[];
  desiredLocations: string[];
  workplacePrefs: string[];
  experience: Array<{
    title: string;
    companyName: string;
    start?: string;
    end?: string;
    description?: string;
  }>;
  education: Array<{ school: string; degree?: string; start?: string; end?: string }>;
  skills: string[];
  portfolioUrl?: string;
  links: string[];
  updatedAt: Date;
}

const candidateProfileSchema = new Schema<ICandidateProfile>(
  {
    userId: { type: String, required: true, unique: true },
    headline: { type: String, maxlength: 120 },
    location: { type: String, maxlength: 80 },
    openToWork: { type: Boolean, default: false },
    visibility: { type: String, enum: PROFILE_VISIBILITIES, default: "recruiters" },
    desiredFunctions: { type: [{ type: String, enum: JOB_FUNCTIONS }], default: [] },
    desiredLocations: { type: [String], default: [] },
    workplacePrefs: { type: [{ type: String, enum: WORKPLACES }], default: [] },
    experience: {
      type: [
        {
          title: { type: String, maxlength: 120 },
          companyName: { type: String, maxlength: 120 },
          start: String,
          end: String,
          description: { type: String, maxlength: 2000 },
          _id: false,
        },
      ],
      default: [],
    },
    education: {
      type: [{ school: String, degree: String, start: String, end: String, _id: false }],
      default: [],
    },
    skills: { type: [String], default: [] },
    portfolioUrl: String,
    links: { type: [String], default: [] },
  },
  { timestamps: true },
);

candidateProfileSchema.index({ openToWork: 1, desiredFunctions: 1 });

export const CandidateProfile = mongoose.model<ICandidateProfile>("CandidateProfile", candidateProfileSchema);
