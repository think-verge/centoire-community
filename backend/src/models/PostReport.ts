import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IPostReport extends Document {
  _id: Types.ObjectId;
  postId: Types.ObjectId;
  reporterId?: Types.ObjectId;
  reason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const postReportSchema = new Schema<IPostReport>(
  {
    postId: { type: Schema.Types.ObjectId, ref: "Post", required: true, index: true },
    reporterId: { type: Schema.Types.ObjectId, ref: "User" },
    reason: { type: String, maxlength: 500 },
  },
  { timestamps: true },
);

postReportSchema.index({ postId: 1, reporterId: 1 }, { unique: true, sparse: true });

export const PostReport = mongoose.model<IPostReport>("PostReport", postReportSchema);
