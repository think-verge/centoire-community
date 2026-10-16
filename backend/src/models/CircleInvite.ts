import mongoose, { Schema, type Document, type Types } from "mongoose";

export type CircleInviteStatus = "pending" | "accepted" | "revoked" | "expired";

export interface ICircleInvite extends Document {
  _id: Types.ObjectId;
  circleId: Types.ObjectId;
  invitedBy: Types.ObjectId;
  email: string;
  token: string;
  status: CircleInviteStatus;
  expiresAt: Date;
  acceptedAt?: Date;
  acceptedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const circleInviteSchema = new Schema<ICircleInvite>(
  {
    circleId: { type: Schema.Types.ObjectId, ref: "Circle", required: true },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    token: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ["pending", "accepted", "revoked", "expired"],
      default: "pending",
    },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date },
    acceptedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

circleInviteSchema.index({ circleId: 1, email: 1 });

export const CircleInvite = mongoose.model<ICircleInvite>("CircleInvite", circleInviteSchema);
