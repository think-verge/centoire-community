import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IFollow extends Document {
  _id: Types.ObjectId;
  followerId: Types.ObjectId;
  followeeId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const followSchema = new Schema<IFollow>(
  {
    followerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    followeeId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  },
  { timestamps: true },
);

followSchema.index({ followerId: 1, followeeId: 1 }, { unique: true });
followSchema.index({ followeeId: 1 });

export const Follow = mongoose.model<IFollow>("Follow", followSchema);
