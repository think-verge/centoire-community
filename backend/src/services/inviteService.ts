import { randomBytes } from "node:crypto";
import { Invite, type IInvite } from "../models/Invite.js";
import { User } from "../models/User.js";
import type { UserRole } from "../models/User.js";
import { ApiError } from "../utils/api-error.js";
import { mailer } from "./mailerService.js";
import { env } from "../config/env.js";

const INVITE_TTL_MS = 14 * 24 * 60 * 60 * 1000; // 14 days

export async function createInvite(
  adminId: string,
  input: { email: string; role: UserRole },
): Promise<IInvite> {
  const existing = await Invite.findOne({
    email: input.email.toLowerCase(),
    status: "pending",
    expiresAt: { $gt: new Date() },
  });
  if (existing) throw new ApiError(409, "A pending invite already exists for this email");

  const invite = await Invite.create({
    email: input.email.toLowerCase(),
    role: input.role,
    invitedBy: adminId,
    token: randomBytes(32).toString("hex"),
    expiresAt: new Date(Date.now() + INVITE_TTL_MS),
  });

  const link = `${env.CLIENT_ORIGIN}/signup?invite=${invite.token}`;
  await mailer.sendInvite(invite.email, link, invite.role);

  return invite;
}

export async function listInvites(): Promise<IInvite[]> {
  return Invite.find().sort({ createdAt: -1 }).populate("invitedBy", "displayName handle");
}

export async function revokeInvite(id: string): Promise<void> {
  const invite = await Invite.findById(id);
  if (!invite) throw new ApiError(404, "Invite not found");
  if (invite.status !== "pending") throw new ApiError(409, "Invite is no longer pending");
  invite.status = "revoked";
  await invite.save();
}

export async function previewInvite(
  token: string,
): Promise<{ email: string; role: UserRole; valid: boolean }> {
  const invite = await Invite.findOne({ token });
  if (!invite) return { email: "", role: "member", valid: false };
  const valid = invite.status === "pending" && invite.expiresAt > new Date();
  return { email: invite.email, role: invite.role, valid };
}

export async function consumeInvite(token: string, signupEmail: string): Promise<UserRole | null> {
  if (!token) return null;
  const invite = await Invite.findOne({ token });
  if (!invite) return null;
  if (invite.status !== "pending") throw new ApiError(409, "Invite has already been used or revoked");
  if (invite.expiresAt < new Date()) throw new ApiError(410, "Invite has expired");
  if (invite.email !== signupEmail.toLowerCase()) {
    throw new ApiError(422, "This invite was sent to a different email address");
  }

  const user = await User.findOne({ email: signupEmail.toLowerCase() });
  invite.status = "accepted";
  invite.acceptedAt = new Date();
  if (user) invite.acceptedBy = user._id;
  await invite.save();

  return invite.role;
}
