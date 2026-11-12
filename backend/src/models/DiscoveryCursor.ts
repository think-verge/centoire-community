import mongoose, { Schema, type Document } from "mongoose";

/** Where the backend stopped reading the discovery engine's queue. One doc, keyed "queue". */
export interface IDiscoveryCursor extends Document<string> {
  since: Date;
  updatedAt: Date;
}

const discoveryCursorSchema = new Schema<IDiscoveryCursor>(
  { _id: { type: String }, since: { type: Date, required: true } },
  { timestamps: true, collection: "discoverycursors" },
);

export const DiscoveryCursor =
  (mongoose.models["DiscoveryCursor"] as mongoose.Model<IDiscoveryCursor>) ||
  mongoose.model<IDiscoveryCursor>("DiscoveryCursor", discoveryCursorSchema);
