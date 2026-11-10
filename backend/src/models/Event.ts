import mongoose, { Document, Schema, Types } from "mongoose";

export type EventAction =
  | "impression"
  | "read"
  | "dwell"
  | "hide"
  | "report"
  | "suggestion_impression"
  | "suggestion_dismiss"
  | "upvote"
  | "save"
  | "comment"
  | "share"
  | "follow"
  | "circle_join";

export type EventTargetType = "post" | "creator" | "circle";

export interface IEvent extends Document {
  _id: Types.ObjectId;
  userId?: Types.ObjectId | null;
  sessionId?: string | null;
  action: EventAction;
  postId?: Types.ObjectId | null;
  targetType?: EventTargetType | null;
  targetId?: string | null;
  position?: number | null;
  source?: string | null;
  score?: number | null;
  dwellMs?: number | null;
  idempotencyKey?: string | null;
  metadata?: Record<string, unknown> | null;
  at: Date;
  createdAt: Date;
  updatedAt: Date;
}

const eventSchema = new Schema<IEvent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    sessionId: { type: String, default: null, trim: true },
    action: {
      type: String,
      required: true,
      enum: [
        "impression",
        "read",
        "dwell",
        "hide",
        "report",
        "suggestion_impression",
        "suggestion_dismiss",
        "upvote",
        "save",
        "comment",
        "share",
        "follow",
        "circle_join",
      ],
      index: true,
    },
    postId: { type: Schema.Types.ObjectId, ref: "Post", default: null },
    targetType: {
      type: String,
      enum: ["post", "creator", "circle"],
      default: null,
    },
    targetId: { type: String, default: null },
    position: { type: Number, default: null },
    source: { type: String, default: null, trim: true },
    score: { type: Number, default: null },
    dwellMs: { type: Number, default: null },
    idempotencyKey: { type: String, default: null, trim: true },
    metadata: { type: Schema.Types.Mixed, default: null },
    at: { type: Date, required: true, default: Date.now },
  },
  {
    timestamps: true,
    collection: "events",
  },
);

// Indexes
// 1. Primary retrieval index for user history & topic-mix updates: (userId, at)
eventSchema.index({ userId: 1, at: -1 });

// 2. Retrieval index for anonymous session-based topic mix / recommendations: (sessionId, at)
eventSchema.index({ sessionId: 1, at: -1 }, { sparse: true });

// 3. Unique sparse idempotency key index to silently discard duplicate client flushes
eventSchema.index({ idempotencyKey: 1 }, { unique: true, sparse: true });

// 4. Time index for window aggregations and 30-day retention TTL (2,592,000 seconds)
eventSchema.index({ at: -1 });
eventSchema.index({ at: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const Event = mongoose.model<IEvent>("Event", eventSchema);
