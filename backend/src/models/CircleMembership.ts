import mongoose, { Schema, type Document, type Types } from "mongoose";

export type CircleRole = "owner" | "moderator" | "member";

export interface ICircleMembership extends Document {
  _id: Types.ObjectId;
  circleId: Types.ObjectId;
  userId: Types.ObjectId;
  role: CircleRole;
  createdAt: Date;
  updatedAt: Date;
}

const circleMembershipSchema = new Schema<ICircleMembership>(
  {
    circleId: { type: Schema.Types.ObjectId, ref: "Circle", required: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    role: {
      type: String,
      enum: ["owner", "moderator", "member"],
      default: "member",
    },
  },
  { timestamps: true },
);

circleMembershipSchema.index({ circleId: 1, userId: 1 }, { unique: true });
circleMembershipSchema.index({ userId: 1 });

export const CircleMembership = mongoose.model<ICircleMembership>(
  "CircleMembership",
  circleMembershipSchema,
);
