import mongoose, { Schema, type Document, type Types } from "mongoose";

export type UserRole = "member" | "creator" | "editor" | "admin";

export interface IUser extends Document {
  _id: Types.ObjectId;
  email: string;
  passwordHash?: string;
  googleId?: string;
  emailVerified: boolean;
  verifyToken?: string;
  verifyTokenExpires?: Date;
  resetToken?: string;
  resetTokenExpires?: Date;
  handle?: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  role: UserRole;
  interests: Types.ObjectId[];
  onboardingCompletedAt?: Date;
  reputation: number;
  followerCount: number;
  followingCount: number;
  postCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String },
    googleId: { type: String, unique: true, sparse: true },
    emailVerified: { type: Boolean, default: false },
    verifyToken: { type: String },
    verifyTokenExpires: { type: Date },
    resetToken: { type: String },
    resetTokenExpires: { type: Date },
    handle: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      match: /^[a-z0-9_]{3,24}$/,
    },
    displayName: { type: String, required: true, trim: true, maxlength: 60 },
    avatarUrl: { type: String },
    bio: { type: String, maxlength: 160 },
    role: { type: String, enum: ["member", "creator", "editor", "admin"], default: "member" },
    interests: [{ type: Schema.Types.ObjectId, ref: "Tag" }],
    onboardingCompletedAt: { type: Date },
    reputation: { type: Number, default: 0 },
    followerCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },
    postCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

userSchema.index({ handle: "text", displayName: "text", bio: "text" });
userSchema.index({ role: 1 });

export const User = mongoose.model<IUser>("User", userSchema);
