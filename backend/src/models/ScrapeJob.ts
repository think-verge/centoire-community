import mongoose, { Schema, type Document, type Types } from "mongoose";
import { SCRAPE_ERROR_CODES, type ScrapeErrorCode } from "./Source.js";

export type ScrapeJobType = "discover" | "scrape";
export type ScrapeJobStatus = "queued" | "leased" | "done" | "failed";

export interface IScrapeJob extends Document {
  _id: Types.ObjectId;
  sourceId: Types.ObjectId;
  type: ScrapeJobType;
  status: ScrapeJobStatus;
  /** Worker holding the lease, and when the lease lapses (worker must heartbeat). */
  leasedBy?: string;
  leaseUntil?: Date;
  attempts: number;
  requestedBy?: Types.ObjectId;
  stats?: { itemsSeen: number; imported: number; duplicates: number; updated: number };
  errorCode?: ScrapeErrorCode;
  errorMessage?: string;
  startedAt?: Date;
  finishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const scrapeJobSchema = new Schema<IScrapeJob>(
  {
    sourceId: { type: Schema.Types.ObjectId, ref: "Source", required: true },
    type: { type: String, enum: ["discover", "scrape"], required: true },
    status: { type: String, enum: ["queued", "leased", "done", "failed"], default: "queued" },
    leasedBy: String,
    leaseUntil: Date,
    attempts: { type: Number, default: 0 },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User" },
    stats: { itemsSeen: Number, imported: Number, duplicates: Number, updated: Number },
    errorCode: { type: String, enum: SCRAPE_ERROR_CODES },
    errorMessage: { type: String, maxlength: 500 },
    startedAt: Date,
    finishedAt: Date,
  },
  { timestamps: true },
);

scrapeJobSchema.index({ status: 1, createdAt: 1 });
scrapeJobSchema.index({ status: 1, leaseUntil: 1 });
scrapeJobSchema.index({ sourceId: 1, createdAt: -1 });
// Finished jobs are history only; keep two weeks.
scrapeJobSchema.index({ finishedAt: 1 }, { expireAfterSeconds: 14 * 24 * 60 * 60 });

export const ScrapeJob = mongoose.model<IScrapeJob>("ScrapeJob", scrapeJobSchema);
