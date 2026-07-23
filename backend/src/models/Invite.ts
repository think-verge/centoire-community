import mongoose, { Schema, type Document, type Types } from "mongoose";
import type { UserRole } from "./User.js";

export interface IInvite extends Document {
  _id: Types.ObjectId;
  email: string;
  role: UserRole;
  invitedBy: Types.ObjectId;
  token: string;
  status: "pending" | "accepted" | "revoked";
  expiresAt: Date;
  acceptedAt?: Date;
  acceptedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const inviteSchema = new Schema<IInvite>(
  {
    email: { type: String, required: true, lowercase: true, trim: true },
    role: {
      type: String,
      enum: ["member", "creator", "editor", "admin"],
      required: true,
    },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    token: { type: String, required: true, unique: true },
    status: { type: String, enum: ["pending", "accepted", "revoked"], default: "pending" },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date },
    acceptedBy: { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: true },
);

inviteSchema.index({ token: 1 }, { unique: true });
inviteSchema.index({ email: 1, status: 1 });

export const Invite = mongoose.model<IInvite>("Invite", inviteSchema);
