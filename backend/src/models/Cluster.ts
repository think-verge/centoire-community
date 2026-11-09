import mongoose, { Schema, type Document } from "mongoose";

export interface ICluster extends Document {
  clusterId: number;
  centre: number[];
  postCount: number;
  version: number;
  updatedAt: Date;
}

const clusterSchema = new Schema<ICluster>(
  {
    clusterId: { type: Number, required: true, unique: true },
    centre: { type: [Number], required: true },
    postCount: { type: Number, default: 0 },
    version: { type: Number, required: true, default: 1 },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

clusterSchema.index({ version: 1, clusterId: 1 });

export const Cluster = mongoose.model<ICluster>("Cluster", clusterSchema);
