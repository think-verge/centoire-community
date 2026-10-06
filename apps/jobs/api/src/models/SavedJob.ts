import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface ISavedJob extends Document {
  _id: Types.ObjectId;
  userId: string;
  jobId: Types.ObjectId;
  createdAt: Date;
}

const savedJobSchema = new Schema<ISavedJob>(
  {
    userId: { type: String, required: true },
    jobId: { type: Schema.Types.ObjectId, ref: "Job", required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

savedJobSchema.index({ userId: 1, jobId: 1 }, { unique: true });
savedJobSchema.index({ userId: 1, createdAt: -1 });

export const SavedJob = mongoose.model<ISavedJob>("SavedJob", savedJobSchema);
