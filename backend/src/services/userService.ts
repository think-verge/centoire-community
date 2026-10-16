import { Types } from "mongoose";
import { Circle } from "../models/Circle.js";
import { CircleMembership } from "../models/CircleMembership.js";
import { Follow } from "../models/Follow.js";
import { Source } from "../models/Source.js";
import { SourceFollow } from "../models/SourceFollow.js";
import { Hashtag } from "../models/Hashtag.js";
import { Bookmark, BookmarkFolder } from "../models/Bookmark.js";
import { Vote } from "../models/Vote.js";
import { Notification } from "../models/Notification.js";
import { CircleInvite } from "../models/CircleInvite.js";
import { diffHashtags } from "../utils/hashtag.js";
import * as hashtagService from "./hashtagService.js";
import { User, type IUser, type UserRole } from "../models/User.js";
import { ApiError } from "../utils/api-error.js";
import { emitDomainEvent } from "../events/eventBus.js";

const RESERVED_HANDLES = new Set([
  "admin", "centoire", "settings", "feed", "discover", "circles", "search",
  "onboarding", "login", "signup", "api", "me", "studio", "help", "about",
]);

export async function checkHandleAvailability(
  handle: string,
  excludeUserId?: string,
): Promise<{ available: boolean; message: string }> {
  const normalized = handle.trim().toLowerCase();
  if (!/^[a-z0-9_]{3,24}$/.test(normalized)) {
    return { available: false, message: "Handle is not available" };
  }
  if (RESERVED_HANDLES.has(normalized)) {
    return { available: false, message: "Handle is not available" };
  }
  const query: Record<string, any> = { handle: normalized };
  if (excludeUserId) {
    query._id = { $ne: excludeUserId };
  }
  const taken = await User.findOne(query);
  if (taken) {
    return { available: false, message: "Handle is not available" };
  }
  return { available: true, message: "Handle is available" };
}

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

export async function followSource(followerId: string, sourceId: string): Promise<void> {
  if (!Types.ObjectId.isValid(sourceId)) throw new ApiError(400, "Invalid source ID");
  const source = await Source.findById(sourceId);
  if (!source) throw new ApiError(404, "Source not found");
  try {
    await SourceFollow.create({ followerId, sourceId });
  } catch (err: unknown) {
    if ((err as { code?: number }).code === 11000) return; // already following
    throw err;
  }
  await User.updateOne({ _id: followerId }, { $inc: { followingCount: 1 } });
  await Source.updateOne({ _id: sourceId }, { $inc: { followerCount: 1 } });
}

export async function unfollowSource(followerId: string, sourceId: string): Promise<void> {
  if (!Types.ObjectId.isValid(sourceId)) throw new ApiError(400, "Invalid source ID");
  const deleted = await SourceFollow.findOneAndDelete({ followerId, sourceId });
  if (!deleted) return;
  await User.updateOne({ _id: followerId }, { $inc: { followingCount: -1 } });
  await Source.updateOne({ _id: sourceId }, { $inc: { followerCount: -1 } });
}

export async function getFollowedSourceIds(userId: string): Promise<Types.ObjectId[]> {
  const follows = await SourceFollow.find({ followerId: userId }).select("sourceId");
  return follows.map((f) => f.sourceId);
}

export async function isFollowingSource(followerId: string, sourceId: string): Promise<boolean> {
  if (!Types.ObjectId.isValid(sourceId)) return false;
  const follow = await SourceFollow.findOne({ followerId, sourceId });
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

export async function deleteAccount(userId: string): Promise<void> {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  // Clean up circle memberships and decrement counts
  const memberships = await CircleMembership.find({ userId });
  for (const m of memberships) {
    await Circle.updateOne({ _id: m.circleId }, { $inc: { memberCount: -1 } });
  }
  await CircleMembership.deleteMany({ userId });

  // Clean up follows (and update target follower/following counts)
  const following = await Follow.find({ followerId: userId });
  for (const f of following) {
    await User.updateOne({ _id: f.followeeId }, { $inc: { followerCount: -1 } });
  }
  const followers = await Follow.find({ followeeId: userId });
  for (const f of followers) {
    await User.updateOne({ _id: f.followerId }, { $inc: { followingCount: -1 } });
  }
  await Follow.deleteMany({ $or: [{ followerId: userId }, { followeeId: userId }] });

  // Clean up source follows and update source follower counts
  const sourceFollows = await SourceFollow.find({ followerId: userId });
  for (const sf of sourceFollows) {
    await Source.updateOne({ _id: sf.sourceId }, { $inc: { followerCount: -1 } });
  }
  await SourceFollow.deleteMany({ followerId: userId });

  // Clean up bookmarks, bookmark folders, votes, notifications
  await Bookmark.deleteMany({ userId });
  await BookmarkFolder.deleteMany({ userId });
  await Vote.deleteMany({ userId });
  await Notification.deleteMany({
    $or: [{ recipientId: userId }, { actorId: userId }, { targetUserId: userId }],
  });

  // Delete circle invites sent to or created by this user
  await CircleInvite.deleteMany({ $or: [{ email: user.email }, { invitedBy: userId }] });

  // Finally delete the user document from the DB
  await User.findByIdAndDelete(userId);
}
