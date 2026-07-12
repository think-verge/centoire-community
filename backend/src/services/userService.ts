import { Types } from "mongoose";
import { CircleMembership } from "../models/CircleMembership.js";
import { Follow } from "../models/Follow.js";
import { Tag } from "../models/Tag.js";
import { User, type IUser } from "../models/User.js";
import { ApiError } from "../utils/api-error.js";

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

export async function setInterests(userId: string, tagIds: string[]): Promise<IUser> {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  const objectIds = tagIds.map((id) => {
    if (!Types.ObjectId.isValid(id)) throw new ApiError(422, "Invalid tag id");
    return new Types.ObjectId(id);
  });
  const found = await Tag.countDocuments({ _id: { $in: objectIds } });
  if (found !== objectIds.length) throw new ApiError(422, "One or more tags do not exist");

  const previous = new Set(user.interests.map(String));
  user.interests = objectIds;
  await user.save();

  const next = new Set(tagIds);
  const added = tagIds.filter((id) => !previous.has(id));
  const removed = [...previous].filter((id) => !next.has(id));
  if (added.length) {
    await Tag.updateMany({ _id: { $in: added } }, { $inc: { followerCount: 1 } });
  }
  if (removed.length) {
    await Tag.updateMany({ _id: { $in: removed } }, { $inc: { followerCount: -1 } });
  }
  return user;
}

export async function completeOnboarding(userId: string): Promise<IUser> {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");
  if (!user.handle) throw new ApiError(422, "Set a handle before finishing onboarding");
  if (user.interests.length < 3) {
    throw new ApiError(422, "Pick at least 3 interests before finishing onboarding");
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
