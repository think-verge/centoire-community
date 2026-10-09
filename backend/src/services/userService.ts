import { Types } from "mongoose";
import { CircleMembership } from "../models/CircleMembership.js";
import { Follow } from "../models/Follow.js";
import { Hashtag } from "../models/Hashtag.js";
import { diffHashtags } from "../utils/hashtag.js";
import * as hashtagService from "./hashtagService.js";
import { User, type IUser, type UserRole } from "../models/User.js";
import { ApiError } from "../utils/api-error.js";
import { emitDomainEvent } from "../events/eventBus.js";

const RESERVED_HANDLES = new Set([
  "admin", "centoire", "settings", "feed", "discover", "circles", "search",
  "onboarding", "login", "signup", "api", "me", "studio", "help", "about",
]);

export async function getByHandle(handle: string): Promise<IUser> {
  const user = await User.findOne({ handle: handle.toLowerCase() });
  if (!user) throw new ApiError(404, "User not found");
  return user;
}

export async function updateMe(
  userId: string,
  input: { displayName?: string; handle?: string; bio?: string; avatarUrl?: string },
): Promise<IUser> {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  if (input.handle !== undefined && input.handle !== user.handle) {
    const handle = input.handle.toLowerCase();
    if (RESERVED_HANDLES.has(handle)) throw new ApiError(409, "This handle is reserved");
    const taken = await User.findOne({ handle, _id: { $ne: user._id } });
    if (taken) throw new ApiError(409, "This handle is already taken");
    user.handle = handle;
  }
  if (input.displayName !== undefined) user.displayName = input.displayName;
  if (input.bio !== undefined) user.bio = input.bio;
  if (input.avatarUrl !== undefined) user.avatarUrl = input.avatarUrl;

  await user.save();
  return user;
}

export async function setInterests(userId: string, hashtags: string[]): Promise<IUser> {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  // Interests are followed hashtags, and following only works for ones that already exist.
  const next = await hashtagService.filterExisting(hashtags);
  if (next.length === 0) throw new ApiError(422, "Pick at least one existing hashtag");

  const { added, removed } = diffHashtags(user.followedHashtags ?? [], next);
  user.followedHashtags = next;
  await user.save();

  if (added.length) await Hashtag.updateMany({ name: { $in: added } }, { $inc: { followerCount: 1 } });
  if (removed.length) {
    await Hashtag.updateMany({ name: { $in: removed }, followerCount: { $gt: 0 } }, { $inc: { followerCount: -1 } });
  }
  return user;
}

export async function completeOnboarding(userId: string): Promise<IUser> {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");
  if (!user.handle) throw new ApiError(422, "Set a handle before finishing onboarding");
  if ((user.followedHashtags ?? []).length < 3) {
    throw new ApiError(422, "Pick at least 3 hashtags before finishing onboarding");
  }
  if (!user.onboardingCompletedAt) {
    user.onboardingCompletedAt = new Date();
    await user.save();
  }
  return user;
}

export async function followUser(followerId: string, followeeId: string): Promise<void> {
  if (followerId === followeeId) throw new ApiError(422, "You cannot follow yourself");
  const followee = await User.findById(followeeId);
  if (!followee) throw new ApiError(404, "User not found");
  try {
    await Follow.create({ followerId, followeeId });
  } catch (err: unknown) {
    if ((err as { code?: number }).code === 11000) return; // already following
    throw err;
  }
  await User.updateOne({ _id: followerId }, { $inc: { followingCount: 1 } });
  await User.updateOne({ _id: followeeId }, { $inc: { followerCount: 1 } });
  emitDomainEvent("user.followed", { followerId, followeeId });
}

export async function unfollowUser(followerId: string, followeeId: string): Promise<void> {
  const deleted = await Follow.findOneAndDelete({ followerId, followeeId });
  if (!deleted) return;
  await User.updateOne({ _id: followerId }, { $inc: { followingCount: -1 } });
  await User.updateOne({ _id: followeeId }, { $inc: { followerCount: -1 } });
}

export async function getFollowedUserIds(userId: string): Promise<Types.ObjectId[]> {
  const follows = await Follow.find({ followerId: userId }).select("followeeId");
  return follows.map((f) => f.followeeId);
}

export async function getMembershipCircleIds(userId: string): Promise<Types.ObjectId[]> {
  const memberships = await CircleMembership.find({ userId }).select("circleId");
  return memberships.map((m) => m.circleId);
}

export async function isFollowing(followerId: string, followeeId: string): Promise<boolean> {
  const follow = await Follow.findOne({ followerId, followeeId });
  return Boolean(follow);
}

export async function promoteUser(actorId: string, targetUserId: string, newRole: UserRole): Promise<IUser> {
  if (actorId === targetUserId) throw new ApiError(422, "You cannot change your own role");
  const user = await User.findById(targetUserId);
  if (!user) throw new ApiError(404, "User not found");
  user.role = newRole;
  await user.save();
  return user;
}
