import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface ISourceFollow extends Document {
  _id: Types.ObjectId;
  followerId: Types.ObjectId;
  sourceId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const sourceFollowSchema = new Schema<ISourceFollow>(
  {
    followerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    sourceId: { type: Schema.Types.ObjectId, ref: "Source", required: true },
  },
  { timestamps: true },
);

sourceFollowSchema.index({ followerId: 1, sourceId: 1 }, { unique: true });
sourceFollowSchema.index({ sourceId: 1 });

export const SourceFollow = mongoose.model<ISourceFollow>("SourceFollow", sourceFollowSchema);
