import mongoose, { Schema, type Document, type Types } from "mongoose";

export type SuggestionTargetType = "circle" | "creator";
export type SuggestionFeedbackAction = "dismiss" | "ignore" | "join" | "follow";

export interface ISuggestionFeedback extends Document {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  targetType: SuggestionTargetType;
  targetId: Types.ObjectId;
  dismissedUntil?: Date;
  ignoreCount: number;
  lastAction?: SuggestionFeedbackAction;
  createdAt: Date;
  updatedAt: Date;
}

const suggestionFeedbackSchema = new Schema<ISuggestionFeedback>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetType: { type: String, enum: ["circle", "creator"], required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    dismissedUntil: { type: Date },
    ignoreCount: { type: Number, default: 0 },
    lastAction: {
      type: String,
      enum: ["dismiss", "ignore", "join", "follow"],
    },
  },
  { timestamps: true }
);

suggestionFeedbackSchema.index(
  { userId: 1, targetType: 1, targetId: 1 },
  { unique: true }
);
suggestionFeedbackSchema.index({ userId: 1, targetType: 1, dismissedUntil: 1 });

export const SuggestionFeedback = mongoose.model<ISuggestionFeedback>(
  "SuggestionFeedback",
  suggestionFeedbackSchema
);
