import mongoose, { Schema, type Document, type Types } from "mongoose";

export interface IUserTopicMix extends Document {
  userId: Types.ObjectId;
  mix: Map<string, number>;          // clusterId -> percentage (0-100)
  rawPoints: Map<string, number>;     // clusterId -> raw float points
  dailyEarned: Map<string, number>;   // clusterId -> positive points earned today (max 15/day)
  activeDays: number;                 // count of days user opened the app
  lastActiveDate: string;             // YYYY-MM-DD
  hiddenPostIds: string[];            // Last 50 hidden post IDs
  clusterVersion: number;             // matches active cluster version
  createdAt: Date;
  updatedAt: Date;
}

const userTopicMixSchema = new Schema<IUserTopicMix>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    mix: { type: Map, of: Number, default: {} },
    rawPoints: { type: Map, of: Number, default: {} },
    dailyEarned: { type: Map, of: Number, default: {} },
    activeDays: { type: Number, default: 1 },
    lastActiveDate: { type: String, default: () => new Date().toISOString().slice(0, 10) },
    hiddenPostIds: { type: [String], default: [] },
    clusterVersion: { type: Number, default: 1 },
  },
  { timestamps: true },
);

userTopicMixSchema.index({ userId: 1 }, { unique: true });

export const UserTopicMix = mongoose.model<IUserTopicMix>("UserTopicMix", userTopicMixSchema);

