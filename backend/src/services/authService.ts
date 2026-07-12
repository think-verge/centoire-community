import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import { OAuth2Client } from "google-auth-library";
import { env } from "../config/env.js";
import { User, type IUser } from "../models/User.js";
import { ApiError } from "../utils/api-error.js";
import { mailer } from "./mailerService.js";

const BCRYPT_ROUNDS = 12;
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 60 * 60 * 1000;

const googleClient = env.GOOGLE_CLIENT_ID ? new OAuth2Client(env.GOOGLE_CLIENT_ID) : null;

export function signSessionToken(user: IUser): string {
  return jwt.sign(
    { userId: user._id.toString(), email: user.email, role: user.role },
    env.JWT_SECRET,
    { expiresIn: "7d" },
  );
}

function newToken(): string {
  return randomBytes(32).toString("hex");
}

async function issueVerification(user: IUser): Promise<void> {
  user.verifyToken = newToken();
  user.verifyTokenExpires = new Date(Date.now() + VERIFY_TTL_MS);
  await user.save();
  const link = `${env.CLIENT_ORIGIN}/verify-email?token=${user.verifyToken}`;
  await mailer.sendVerification(user.email, link);
}

export async function signup(input: {
  email: string;
  password: string;
  displayName: string;
}): Promise<IUser> {
  const existing = await User.findOne({ email: input.email.toLowerCase() });
  if (existing) throw new ApiError(409, "An account with this email already exists");
  const user = new User({
    email: input.email,
    passwordHash: await bcrypt.hash(input.password, BCRYPT_ROUNDS),
    displayName: input.displayName,
  });
  await issueVerification(user);
  return user;
}

export async function login(email: string, password: string): Promise<IUser> {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user?.passwordHash) throw new ApiError(401, "Invalid email or password");
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) throw new ApiError(401, "Invalid email or password");
  return user;
}

export async function loginWithGoogle(idToken: string): Promise<IUser> {
  if (!googleClient) throw new ApiError(501, "Google sign-in is not configured");
  const ticket = await googleClient.verifyIdToken({
    idToken,
    audience: env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload?.email || !payload.sub) throw new ApiError(401, "Google token invalid");

  let user = await User.findOne({ googleId: payload.sub });
  if (!user) {
    user = await User.findOne({ email: payload.email.toLowerCase() });
    if (user) {
      user.googleId = payload.sub;
    } else {
      user = new User({
        email: payload.email,
        googleId: payload.sub,
        displayName: payload.name ?? payload.email.split("@")[0],
        avatarUrl: payload.picture,
      });
    }
  }
  if (payload.email_verified) user.emailVerified = true;
  await user.save();
  return user;
}

export async function verifyEmail(token: string): Promise<IUser> {
  const user = await User.findOne({
    verifyToken: token,
    verifyTokenExpires: { $gt: new Date() },
  });
  if (!user) throw new ApiError(400, "Verification link is invalid or expired");
  user.emailVerified = true;
  user.verifyToken = undefined;
  user.verifyTokenExpires = undefined;
  await user.save();
  return user;
}

export async function resendVerification(userId: string): Promise<void> {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");
  if (user.emailVerified) throw new ApiError(400, "Email is already verified");
  await issueVerification(user);
}

export async function forgotPassword(email: string): Promise<void> {
  const user = await User.findOne({ email: email.toLowerCase() });
  // Do not reveal whether the account exists
  if (!user) return;
  user.resetToken = newToken();
  user.resetTokenExpires = new Date(Date.now() + RESET_TTL_MS);
  await user.save();
  const link = `${env.CLIENT_ORIGIN}/reset-password?token=${user.resetToken}`;
  await mailer.sendPasswordReset(user.email, link);
}

export async function resetPassword(token: string, password: string): Promise<IUser> {
  const user = await User.findOne({
    resetToken: token,
    resetTokenExpires: { $gt: new Date() },
  });
  if (!user) throw new ApiError(400, "Reset link is invalid or expired");
  user.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  user.resetToken = undefined;
  user.resetTokenExpires = undefined;
  await user.save();
  return user;
}

export async function getMe(userId: string): Promise<IUser> {
  const user = await User.findById(userId).populate("interests", "name slug");
  if (!user) throw new ApiError(404, "User not found");
  return user;
}
