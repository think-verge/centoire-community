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
  /** Professional/fashion ecosystem role (e.g. Designer, Stylist, Student). */
  profileRole?: string;
  /** Geographic location (e.g. Paris, New York). */
  location?: string;
  /** Domains of work / interest (e.g. Streetwear, Runway, Luxury). */
  domains: string[];
  /** Creators/artists the user likes or endorsed during onboarding. */
  likedCreators: Types.ObjectId[];
  /** Hashtags the user follows; drive For You ranking. */
  followedHashtags: string[];
  onboardingCompletedAt?: Date;
  reputation: number;
  followerCount: number;
  followingCount: number;
  postCount: number;
  dismissedPosts: Types.ObjectId[];
  privacyConsent?: {
    behavioralTracking: boolean;
    personalizedRecommendations: boolean;
    consentedAt?: Date;
  };
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
    profileRole: { type: String, trim: true, maxlength: 60 },
    location: { type: String, trim: true, maxlength: 100 },
    domains: { type: [String], default: [] },
    likedCreators: [{ type: Schema.Types.ObjectId, ref: "User" }],
    followedHashtags: { type: [String], default: [] },
    onboardingCompletedAt: { type: Date },
    reputation: { type: Number, default: 0 },
    followerCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },
    postCount: { type: Number, default: 0 },
    dismissedPosts: [{ type: Schema.Types.ObjectId, ref: "Post" }],
    privacyConsent: {
      behavioralTracking: { type: Boolean, default: true },
      personalizedRecommendations: { type: Boolean, default: true },
      consentedAt: { type: Date, default: Date.now },
    },
  },
  { timestamps: true },
);

userSchema.index({ handle: "text", displayName: "text", bio: "text" });
userSchema.index({ role: 1 });
userSchema.index({ domains: 1 });
userSchema.index({ location: 1 });

export const User = mongoose.model<IUser>("User", userSchema);
