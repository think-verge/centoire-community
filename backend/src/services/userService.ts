import { recordServerEvent } from "./eventService.js";
import mongoose, { Types } from "mongoose";
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
import { UserTopicMix } from "../models/UserTopicMix.js";
import { Event } from "../models/Event.js";
import { diffHashtags } from "../utils/hashtag.js";
import * as hashtagService from "./hashtagService.js";
import { User, type IUser, type UserRole } from "../models/User.js";
import { ApiError } from "../utils/api-error.js";
import { emitDomainEvent } from "../events/eventBus.js";
import { env } from "../config/env.js";

const RESERVED_HANDLES = new Set([
  "admin", "centoire", "settings", "feed", "discover", "circles", "search",
  "onboarding", "login", "signup", "api", "me", "studio", "help", "about",
]);

export interface UpdateMeInput {
  displayName?: string;
  handle?: string;
  bio?: string;
  avatarUrl?: string;
  location?: string;
  profileRole?: string;
  role?: string;
  domains?: string[];
  likedCreators?: string[];
}

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
  input: UpdateMeInput,
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
  if (input.location !== undefined) user.location = input.location.trim();
  if (input.profileRole !== undefined) user.profileRole = input.profileRole.trim();
  if (input.role !== undefined && input.profileRole === undefined) {
    user.profileRole = input.role.trim();
  }
  if (input.domains !== undefined) {
    user.domains = [...new Set(input.domains.map((d) => d.trim()).filter(Boolean))];
  }
  if (input.likedCreators !== undefined) {
    user.likedCreators = input.likedCreators
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
  }

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
  user.domains = next;
  await user.save();

  if (added.length) await Hashtag.updateMany({ name: { $in: added } }, { $inc: { followerCount: 1 } });
  if (removed.length) {
    await Hashtag.updateMany({ name: { $in: removed }, followerCount: { $gt: 0 } }, { $inc: { followerCount: -1 } });
  }

  try {
    await seedTopicMix(userId, next);
  } catch {
    // Non-blocking
  }
  return user;
}

/** Seeds topic mix (10 points per chosen domain, normalized to 100%) and notifies recsys. */
export async function seedTopicMix(
  userId: string | Types.ObjectId,
  domains: string[],
): Promise<void> {
  const cleanDomains = [...new Set(domains.map((d) => d.trim().toLowerCase()).filter(Boolean))];
  if (cleanDomains.length === 0) return;

  const pointsPerDomain = 10.0;
  const rawPoints: Record<string, number> = {};
  const dailyEarned: Record<string, number> = {};
  const mix: Record<string, number> = {};

  const totalPoints = cleanDomains.length * pointsPerDomain;
  for (const d of cleanDomains) {
    rawPoints[d] = pointsPerDomain;
    dailyEarned[d] = pointsPerDomain;
    mix[d] = Math.round((pointsPerDomain / totalPoints) * 10000) / 100;
  }

  const sumMix = Object.values(mix).reduce((a, b) => a + b, 0);
  const diff = Math.round((100 - sumMix) * 100) / 100;
  if (Math.abs(diff) > 0.0001 && cleanDomains[0]) {
    mix[cleanDomains[0]] = Math.round((mix[cleanDomains[0]] + diff) * 100) / 100;
  }

  const today = new Date().toISOString().slice(0, 10);
  const uid = typeof userId === "string" ? new Types.ObjectId(userId) : userId;

  await UserTopicMix.findOneAndUpdate(
    { userId: uid },
    {
      $set: {
        mix,
        rawPoints,
        dailyEarned,
        activeDays: 1,
        lastActiveDate: today,
        hiddenPostIds: [],
        clusterVersion: 1,
      },
    },
    { upsert: true, new: true },
  );

  try {
    const url = `${env.RECSYS_SERVICE_URL}/internal/recsys/topic-mix/${uid}/seed`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 1000);
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": env.AI_INTERNAL_SECRET,
      },
      body: JSON.stringify({ domains: cleanDomains }),
      signal: controller.signal,
    }).catch(() => {}).finally(() => clearTimeout(timeout));
  } catch {
    // Non-blocking fallback if recsys is offline
  }
}

export async function completeOnboarding(
  userId: string,
  input?: Partial<UpdateMeInput>,
): Promise<IUser> {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  if (input) {
    if (input.handle && input.handle !== user.handle) {
      const handle = input.handle.toLowerCase();
      if (RESERVED_HANDLES.has(handle)) throw new ApiError(409, "This handle is reserved");
      const taken = await User.findOne({ handle, _id: { $ne: user._id } });
      if (taken) throw new ApiError(409, "This handle is already taken");
      user.handle = handle;
    }
    if (input.displayName !== undefined) user.displayName = input.displayName;
    if (input.bio !== undefined) user.bio = input.bio;
    if (input.avatarUrl !== undefined) user.avatarUrl = input.avatarUrl;
    if (input.location !== undefined) user.location = input.location.trim();
    if (input.profileRole !== undefined) user.profileRole = input.profileRole.trim();
    if (input.role !== undefined && input.profileRole === undefined) {
      user.profileRole = input.role.trim();
    }
    if (input.domains !== undefined) {
      user.domains = [...new Set(input.domains.map((d) => d.trim()).filter(Boolean))];
    }
    if (input.likedCreators !== undefined) {
      user.likedCreators = input.likedCreators
        .filter((id) => Types.ObjectId.isValid(id))
        .map((id) => new Types.ObjectId(id));
    }
  }

  if (!user.handle) throw new ApiError(422, "Set a handle before finishing onboarding");
  if ((user.followedHashtags ?? []).length < 3) {
    throw new ApiError(422, "Pick at least 3 hashtags before finishing onboarding");
  }

  if (!user.onboardingCompletedAt) {
    user.onboardingCompletedAt = new Date();
  }

  // Auto-follow liked creators chosen during onboarding
  if (user.likedCreators?.length) {
    for (const creatorId of user.likedCreators) {
      try {
        await followUser(user._id.toString(), creatorId.toString());
      } catch {
        // ignore already following or not found
      }
    }
  }

  // Seed topic mix with 10 points per chosen domain
  if (user.domains?.length) {
    await seedTopicMix(user._id, user.domains);
  }

  await user.save();
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
  void recordServerEvent({ userId: followerId, action: "follow", targetType: "creator", targetId: followeeId });
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

export async function blockUser(userId: string, targetUserId: string): Promise<void> {
  if (userId === targetUserId) throw new ApiError(422, "You cannot block yourself");
  if (!Types.ObjectId.isValid(targetUserId)) throw new ApiError(400, "Invalid target user ID");

  const target = await User.findById(targetUserId);
  if (!target) throw new ApiError(404, "User not found");

  await User.updateOne(
    { _id: userId },
    { $addToSet: { blockedUsers: new Types.ObjectId(targetUserId) } },
  );

  // When blocking, automatically sever follow relations in both directions
  await Promise.all([
    unfollowUser(userId, targetUserId),
    unfollowUser(targetUserId, userId),
  ]);

  emitDomainEvent("social.user_blocked", { userId, targetUserId });
}

export async function unblockUser(userId: string, targetUserId: string): Promise<void> {
  if (!Types.ObjectId.isValid(targetUserId)) throw new ApiError(400, "Invalid target user ID");
  await User.updateOne(
    { _id: userId },
    { $pull: { blockedUsers: new Types.ObjectId(targetUserId) } },
  );
  emitDomainEvent("social.user_unblocked", { userId, targetUserId });
}

export async function muteUser(userId: string, targetUserId: string): Promise<void> {
  if (userId === targetUserId) throw new ApiError(422, "You cannot mute yourself");
  if (!Types.ObjectId.isValid(targetUserId)) throw new ApiError(400, "Invalid target user ID");

  const target = await User.findById(targetUserId);
  if (!target) throw new ApiError(404, "User not found");

  await User.updateOne(
    { _id: userId },
    { $addToSet: { mutedUsers: new Types.ObjectId(targetUserId) } },
  );

  emitDomainEvent("social.user_muted", { userId, targetUserId });
}

export async function unmuteUser(userId: string, targetUserId: string): Promise<void> {
  if (!Types.ObjectId.isValid(targetUserId)) throw new ApiError(400, "Invalid target user ID");
  await User.updateOne(
    { _id: userId },
    { $pull: { mutedUsers: new Types.ObjectId(targetUserId) } },
  );
  emitDomainEvent("social.user_unmuted", { userId, targetUserId });
}

export async function getBlockedUserIds(userId?: string): Promise<Types.ObjectId[]> {
  if (!userId || !Types.ObjectId.isValid(userId)) return [];
  const user = await User.findById(userId).select("blockedUsers").lean();
  return ((user as any)?.blockedUsers ?? []) as Types.ObjectId[];
}

export async function getMutedUserIds(userId?: string): Promise<Types.ObjectId[]> {
  if (!userId || !Types.ObjectId.isValid(userId)) return [];
  const user = await User.findById(userId).select("mutedUsers").lean();
  return ((user as any)?.mutedUsers ?? []) as Types.ObjectId[];
}

export async function getBlockedAndMutedUserIds(userId?: string): Promise<Types.ObjectId[]> {
  if (!userId || !Types.ObjectId.isValid(userId)) return [];
  const query = User.findById(userId);
  const user = typeof (query as any)?.select === "function" ? await (query as any).select("blockedUsers mutedUsers").lean() : await query;
  const blocked = ((user as any)?.blockedUsers ?? []) as Types.ObjectId[];
  const muted = ((user as any)?.mutedUsers ?? []) as Types.ObjectId[];
  const set = new Set([...blocked.map((id) => id.toString()), ...muted.map((id) => id.toString())]);
  return Array.from(set).map((id) => new Types.ObjectId(id));
}

export async function getBlockedUsers(userId: string): Promise<IUser[]> {
  const ids = await getBlockedUserIds(userId);
  if (ids.length === 0) return [];
  return User.find({ _id: { $in: ids } });
}

export async function getMutedUsers(userId: string): Promise<IUser[]> {
  const ids = await getMutedUserIds(userId);
  if (ids.length === 0) return [];
  return User.find({ _id: { $in: ids } });
}

export interface SocialGraphContext {
  userId: string;
  followedUserIds: string[];
  membershipCircleIds: string[];
  dismissedPostIds: string[];
  blockedUserIds: string[];
  mutedUserIds: string[];
  allExcludedAuthorIds: string[];
}

export async function getSocialGraph(userId: string): Promise<SocialGraphContext> {
  if (!userId || !Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, "Invalid user ID");
  }

  const [user, follows, memberships] = await Promise.all([
    User.findById(userId).select("dismissedPosts blockedUsers mutedUsers").lean(),
    Follow.find({ followerId: userId }).select("followeeId").lean(),
    CircleMembership.find({ userId }).select("circleId").lean(),
  ]);

  if (!user) throw new ApiError(404, "User not found");

  const followedUserIds = follows.map((f) => String(f.followeeId));
  const membershipCircleIds = memberships.map((m) => String(m.circleId));
  const dismissedPostIds = ((user as any).dismissedPosts ?? []).map((id: unknown) => String(id));
  const blockedUserIds = ((user as any).blockedUsers ?? []).map((id: unknown) => String(id));
  const mutedUserIds = ((user as any).mutedUsers ?? []).map((id: unknown) => String(id));

  const excludedSet = new Set([...blockedUserIds, ...mutedUserIds]);

  return {
    userId,
    followedUserIds,
    membershipCircleIds,
    dismissedPostIds,
    blockedUserIds,
    mutedUserIds,
    allExcludedAuthorIds: Array.from(excludedSet),
  };
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
  if (!env.NOTIFICATIONS_EXTERNAL) {
    await Notification.deleteMany({
      $or: [{ recipientId: userId }, { actorId: userId }, { targetUserId: userId }],
    });
  }

  // Delete circle invites sent to or created by this user
  await CircleInvite.deleteMany({ $or: [{ email: user.email }, { invitedBy: userId }] });

  // Clean up user from other users' blocked and muted lists
  await User.updateMany(
    { $or: [{ blockedUsers: userId }, { mutedUsers: userId }] },
    { $pull: { blockedUsers: userId, mutedUsers: userId } },
  );

  // Clean up recommendation engine / behavioral data (Ticket #117)
  await Event.deleteMany({ userId });
  await UserTopicMix.deleteMany({ userId });
  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    try {
      await mongoose.connection.db.collection("suggestionfeedbacks").deleteMany({
        $or: [
          { userId },
          ...(Types.ObjectId.isValid(userId) ? [{ userId: new Types.ObjectId(userId) }] : []),
        ],
      });
    } catch {
      // ignore
    }
  }

  // Finally delete the user document from the DB
  await User.findByIdAndDelete(userId);
  // Other services own their own data about this user and clean it up on this event.
  emitDomainEvent("user.deleted", { userId });
}

export async function getPrivacySettings(userId: string) {
  const user = await User.findById(userId).select("privacyConsent").lean();
  if (!user) throw new ApiError(404, "User not found");
  return (
    (user as any).privacyConsent ?? {
      behavioralTracking: true,
      personalizedRecommendations: true,
      consentedAt: new Date(),
    }
  );
}

export async function updatePrivacySettings(
  userId: string,
  input: { behavioralTracking?: boolean; personalizedRecommendations?: boolean },
) {
  const user = await User.findById(userId);
  if (!user) throw new ApiError(404, "User not found");

  const existing = (user as any).privacyConsent ?? {
    behavioralTracking: true,
    personalizedRecommendations: true,
  };

  user.set("privacyConsent", {
    behavioralTracking:
      typeof input.behavioralTracking === "boolean"
        ? input.behavioralTracking
        : existing.behavioralTracking,
    personalizedRecommendations:
      typeof input.personalizedRecommendations === "boolean"
        ? input.personalizedRecommendations
        : existing.personalizedRecommendations,
    consentedAt: new Date(),
  });

  await user.save();
  return (user as any).privacyConsent;
}

export async function exportUserData(userId: string) {
  const userOid = new Types.ObjectId(userId);
  const [user, topicMix, events] = await Promise.all([
    User.findById(userOid)
      .select("-passwordHash -verifyToken -resetToken -verifyTokenExpires -resetTokenExpires")
      .lean(),
    UserTopicMix.findOne({ userId: userOid }).lean(),
    Event.find({ userId: userOid }).sort({ at: -1 }).limit(1000).lean(),
  ]);

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  let feedback: Array<Record<string, any>> = [];
  if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
    try {
      feedback = (await mongoose.connection.db
        .collection("suggestionfeedbacks")
        .find({ $or: [{ userId: userOid }, { userId }] })
        .toArray()) as any[];
    } catch {
      // ignore
    }
  }

  return {
    exportedAt: new Date().toISOString(),
    complianceStandard: "India DPDP Act 2023 / GDPR",
    user: {
      id: user._id.toString(),
      email: user.email,
      handle: user.handle,
      displayName: user.displayName,
      profileRole: user.profileRole,
      location: user.location,
      domains: user.domains,
      followedHashtags: user.followedHashtags,
      privacyConsent: (user as any).privacyConsent ?? {
        behavioralTracking: true,
        personalizedRecommendations: true,
      },
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
    topicMix: topicMix
      ? {
          activeDays: topicMix.activeDays,
          lastActiveDate: topicMix.lastActiveDate,
          mix: topicMix.mix,
          rawPoints: topicMix.rawPoints,
          dailyEarned: topicMix.dailyEarned,
          hiddenPostIds: topicMix.hiddenPostIds,
          updatedAt: topicMix.updatedAt,
        }
      : null,
    suggestionFeedback: feedback.map((f) => ({
      targetType: f.targetType,
      targetId: f.targetId ? f.targetId.toString() : null,
      dismissedUntil: f.dismissedUntil,
      ignoreCount: f.ignoreCount,
      updatedAt: f.updatedAt,
    })),
    events: events.map((e) => ({
      id: e._id.toString(),
      action: e.action,
      postId: e.postId ? e.postId.toString() : null,
      targetType: e.targetType,
      targetId: e.targetId,
      dwellMs: e.dwellMs,
      source: e.source,
      at: e.at,
    })),
  };
}
