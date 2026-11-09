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
    clusterId: { type: Number, required: true },
    centre: { type: [Number], required: true },
    postCount: { type: Number, default: 0 },
    version: { type: Number, required: true, default: 1 },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
);

// Compound unique index so clusterId 0..39 can exist in version 1, version 2, etc.
clusterSchema.index({ version: 1, clusterId: 1 }, { unique: true });

export const Cluster = mongoose.model<ICluster>("Cluster", clusterSchema);

export interface IClusterMetadata extends Document {
  key: string;
  activeVersion: number;
  totalClusters: number;
  updatedAt: Date;
}

const clusterMetadataSchema = new Schema<IClusterMetadata>(
  {
    key: { type: String, required: true, unique: true, default: "global" },
    activeVersion: { type: Number, required: true, default: 1 },
    totalClusters: { type: Number, default: 40 },
  },
  { timestamps: true },
);

export const ClusterMetadata = mongoose.model<IClusterMetadata>(
  "ClusterMetadata",
  clusterMetadataSchema,
);
