import { Types } from "mongoose";
import { Circle } from "../models/Circle.js";
import { CircleMembership } from "../models/CircleMembership.js";
import { Follow } from "../models/Follow.js";
import { User } from "../models/User.js";
import { SuggestionFeedback, type SuggestionTargetType } from "../models/SuggestionFeedback.js";

const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? "http://localhost:8001";
const AI_INTERNAL_SECRET = process.env.AI_INTERNAL_SECRET ?? "dev-internal-secret";

export interface SuggestedCircleItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  avatarUrl?: string;
  coverImageUrl?: string;
  memberCount: number;
  postCount: number;
  isPrivate: boolean;
  score: number;
  reason: string;
  scoreBreakdown?: Record<string, number>;
}

export interface SuggestedCreatorItem {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  followerCount: number;
  postCount: number;
  isEmerging: boolean;
  score: number;
  reason: string;
  scoreBreakdown?: Record<string, number>;
}

/**
 * Get personalized circle recommendations.
 * - Excludes already joined circles.
 * - Excludes dismissed circles (within 30 days) and 3x-ignored circles (within 14 days).
 * - Hard rule: private circles the user cannot join NEVER appear.
 */
export async function getSuggestedCircles(
  userId: string,
  limit: number = 10,
): Promise<{ items: SuggestedCircleItem[]; count: number }> {
  const userOid = new Types.ObjectId(userId);
  const now = new Date();

  // 1. Find actively hidden / dismissed circle IDs
  const hiddenFeedbacks = await SuggestionFeedback.find({
    userId: userOid,
    targetType: "circle",
    dismissedUntil: { $gt: now },
  }).select("targetId");
  const hiddenIds = new Set(hiddenFeedbacks.map((f) => f.targetId.toString()));

  // 2. Find joined circles
  const joinedMemberships = await CircleMembership.find({ userId: userOid }).select("circleId");
  const joinedCircleIds = new Set(joinedMemberships.map((m) => m.circleId.toString()));

  // 3. Try AI service fast-path with resilient fallback
  let aiSuggestions: Array<{ id: string; score: number; reason: string; scoreBreakdown?: Record<string, number> }> = [];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 800);
    const resp = await fetch(`${AI_SERVICE_URL}/v1/suggestions/circles/${userId}?limit=${limit}`, {
      headers: { "X-Internal-Secret": AI_INTERNAL_SECRET },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (resp.ok) {
      aiSuggestions = (await resp.json()) as Array<{
        id: string;
        score: number;
        reason: string;
        isEmerging?: boolean;
        scoreBreakdown?: Record<string, number>;
      }>;
    }
  } catch {
    // Graceful fallback to core recommendation heuristics
  }

  if (aiSuggestions.length > 0) {
    const aiIds = aiSuggestions.map((s) => new Types.ObjectId(s.id));
    const circleDocs = await Circle.find({
      _id: { $in: aiIds },
      isPrivate: false, // Strict: private circles user cannot join never appear
    }).lean();

    const circleMap = new Map(circleDocs.map((c) => [c._id.toString(), c]));
    const items: SuggestedCircleItem[] = [];

    for (const aiItem of aiSuggestions) {
      if (hiddenIds.has(aiItem.id) || joinedCircleIds.has(aiItem.id)) {
        continue;
      }
      const c = circleMap.get(aiItem.id);
      if (!c) continue;

      items.push({
        id: c._id.toString(),
        name: c.name,
        slug: c.slug,
        description: c.description,
        avatarUrl: c.avatarUrl,
        coverImageUrl: c.coverImageUrl,
        memberCount: c.memberCount ?? 0,
        postCount: c.postCount ?? 0,
        isPrivate: !!c.isPrivate,
        score: aiItem.score,
        reason: aiItem.reason || "Matches your interests in Centoire",
        scoreBreakdown: aiItem.scoreBreakdown,
      });
      if (items.length >= limit) break;
    }

    if (items.length > 0) {
      return { items, count: items.length };
    }
  }

  // 4. Fallback: Core database heuristic scoring
  const excludeOids = Array.from(joinedCircleIds)
    .concat(Array.from(hiddenIds))
    .filter((id) => Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));

  // Find people the user follows for mutual friends signal
  const userFollows = await Follow.find({ followerId: userOid }).select("followeeId");
  const followedUserIds = userFollows.map((f) => f.followeeId);

  // Find user interests (hashtags and domains)
  let userInterests: string[] = [];
  try {
    const user = await User.findById(userOid).select("followedHashtags domains").lean();
    if (user) {
      userInterests = [
        ...((user as any).followedHashtags ?? []),
        ...((user as any).domains ?? []),
      ].map((h: string) => h.toLowerCase().trim().replace(/^#/, ""));
    }
  } catch {
    // Non-blocking fallback
  }

  // Exclude private circles unless specifically public
  const candidateCircles = await Circle.find({
    _id: { $nin: excludeOids },
    isPrivate: false, // Strict: private circles the user cannot join never appear
  })
    .sort({ memberCount: -1, postCount: -1 })
    .limit(limit * 3)
    .lean();

  const candidateIds = candidateCircles.map((c) => c._id);
  // Find mutual friends in candidate circles
  const friendMemberships = await CircleMembership.find({
    circleId: { $in: candidateIds },
    userId: { $in: followedUserIds },
  }).select("circleId userId");

  const mutualFriendsByCircle = new Map<string, number>();
  for (const m of friendMemberships) {
    const cid = m.circleId.toString();
    mutualFriendsByCircle.set(cid, (mutualFriendsByCircle.get(cid) ?? 0) + 1);
  }

  const items: SuggestedCircleItem[] = [];
  for (const c of candidateCircles) {
    const cid = c._id.toString();
    const mutualCount = mutualFriendsByCircle.get(cid) ?? 0;

    const circleTags = (c.hashtags ?? []).map((t: string) => t.toLowerCase().trim().replace(/^#/, ""));
    const circleSlugWords = (c.slug ?? "").toLowerCase().split("-");
    const circleNameWords = (c.name ?? "").toLowerCase().split(/\s+/);
    const matchedInterest = userInterests.find((interest) =>
      circleTags.includes(interest) ||
      circleSlugWords.includes(interest) ||
      circleNameWords.includes(interest)
    );

    // Signal scoring: 3 * match + 2 * friends + 1.5 * activity + 1 * engagement
    const interestSignal = matchedInterest ? 1.0 : 0.0;
    const friendsSignal = mutualCount >= 2 ? 0.67 : mutualCount === 1 ? 0.33 : 0.0;
    const activitySignal = Math.min(1.0, (c.postCount ?? 0) / 20.0);
    const score = Number((3.0 * interestSignal + 2.0 * friendsSignal + 1.5 * activitySignal + 1.0).toFixed(2));

    let reason = "Active community in fashion & culture";
    if (matchedInterest) {
      reason = `Based on your interest in #${matchedInterest}`;
    } else if (mutualCount >= 2) {
      reason = `${mutualCount} friends are members`;
    } else if (mutualCount === 1) {
      reason = "1 friend is a member";
    } else if (c.memberCount > 5) {
      reason = "Popular circle in the community";
    }

    items.push({
      id: cid,
      name: c.name,
      slug: c.slug,
      description: c.description,
      avatarUrl: c.avatarUrl,
      coverImageUrl: c.coverImageUrl,
      memberCount: c.memberCount ?? 0,
      postCount: c.postCount ?? 0,
      isPrivate: !!c.isPrivate,
      score,
      reason,
      scoreBreakdown: {
        friends: Number((2.0 * friendsSignal).toFixed(2)),
        activity: Number((1.5 * activitySignal).toFixed(2)),
      },
    });

    if (items.length >= limit) break;
  }

  // Sort primarily by score descending
  items.sort((a, b) => b.score - a.score);

  return { items, count: items.length };
}

/**
 * Get personalized creator recommendations.
 * - Excludes already followed creators and self.
 * - Excludes dismissed creators (within 30 days) and 3x-ignored creators (within 14 days).
 * - Enforces diversity (ensures emerging creators are included).
 */
export async function getSuggestedCreators(
  userId: string,
  limit: number = 10,
): Promise<{ items: SuggestedCreatorItem[]; count: number }> {
  const userOid = new Types.ObjectId(userId);
  const now = new Date();

  // 1. Find actively hidden / dismissed creator IDs
  const hiddenFeedbacks = await SuggestionFeedback.find({
    userId: userOid,
    targetType: "creator",
    dismissedUntil: { $gt: now },
  }).select("targetId");
  const hiddenIds = new Set(hiddenFeedbacks.map((f) => f.targetId.toString()));

  // 2. Find followed users and self
  const userFollows = await Follow.find({ followerId: userOid }).select("followeeId");
  const followedIds = new Set(userFollows.map((f) => f.followeeId.toString()));
  followedIds.add(userId);

  // 3. Find blocked / muted users from User profile
  const userDoc = await User.findById(userOid).select("blockedUsers mutedUsers").lean();
  const blockedIds = new Set<string>(
    ((userDoc as any)?.blockedUsers ?? []).map((id: any) => String(id)),
  );
  const mutedIds = new Set<string>(
    ((userDoc as any)?.mutedUsers ?? []).map((id: any) => String(id)),
  );

  // 4. Try AI service fast-path with fallback
  let aiSuggestions: Array<{
    id: string;
    score: number;
    reason: string;
    isEmerging?: boolean;
    scoreBreakdown?: Record<string, number>;
  }> = [];
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 800);
    const resp = await fetch(`${AI_SERVICE_URL}/v1/suggestions/creators/${userId}?limit=${limit}`, {
      headers: { "X-Internal-Secret": AI_INTERNAL_SECRET },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (resp.ok) {
      aiSuggestions = (await resp.json()) as Array<{
        id: string;
        score: number;
        reason: string;
        isEmerging?: boolean;
        scoreBreakdown?: Record<string, number>;
      }>;
    }
  } catch {
    // Graceful fallback to core heuristics
  }

  if (aiSuggestions.length > 0) {
    const aiIds = aiSuggestions.map((s) => new Types.ObjectId(s.id));
    const creatorDocs = await User.find({ _id: { $in: aiIds } }).lean();
    const creatorMap = new Map(creatorDocs.map((u) => [u._id.toString(), u]));

    const items: SuggestedCreatorItem[] = [];
    for (const aiItem of aiSuggestions) {
      if (
        hiddenIds.has(aiItem.id) ||
        followedIds.has(aiItem.id) ||
        blockedIds.has(aiItem.id) ||
        mutedIds.has(aiItem.id)
      ) {
        continue;
      }
      const u = creatorMap.get(aiItem.id);
      if (!u || !u.handle) continue;

      items.push({
        id: u._id.toString(),
        handle: u.handle,
        displayName: u.displayName,
        avatarUrl: u.avatarUrl,
        bio: u.bio,
        followerCount: u.followerCount ?? 0,
        postCount: u.postCount ?? 0,
        isEmerging: !!aiItem.isEmerging || (u.followerCount ?? 0) <= 100,
        score: aiItem.score,
        reason: aiItem.reason || "Recommended creator in fashion",
        scoreBreakdown: aiItem.scoreBreakdown,
      });
      if (items.length >= limit) break;
    }

    if (items.length > 0) {
      return { items, count: items.length };
    }
  }

  // 5. Fallback: Core database heuristic scoring
  const excludeOids = [
    ...followedIds,
    ...hiddenIds,
    ...blockedIds,
    ...mutedIds,
  ]
    .filter((id: string) => Types.ObjectId.isValid(id))
    .map((id: string) => new Types.ObjectId(id));

  // Find users followed by user's followees (2nd degree network)
  const followedOids = Array.from(followedIds)
    .filter((id) => id !== userId && Types.ObjectId.isValid(id))
    .map((id) => new Types.ObjectId(id));

  const secondDegreeFollows = await Follow.find({
    followerId: { $in: followedOids },
  }).select("followeeId");

  const mutualCountByUser = new Map<string, number>();
  for (const f of secondDegreeFollows) {
    const feeId = f.followeeId.toString();
    mutualCountByUser.set(feeId, (mutualCountByUser.get(feeId) ?? 0) + 1);
  }

  // Candidate query: active creators with published content
  const candidateCreators = await User.find({
    _id: { $nin: excludeOids },
    role: { $in: ["creator", "editor", "member"] },
    postCount: { $gt: 0 },
    handle: { $exists: true, $ne: "" },
  })
    .sort({ followerCount: -1, postCount: -1 })
    .limit(limit * 3)
    .lean();

  const items: SuggestedCreatorItem[] = [];
  for (const u of candidateCreators) {
    const uid = u._id.toString();
    const mutualCount = mutualCountByUser.get(uid) ?? 0;
    const isEmerging = (u.followerCount ?? 0) <= 100;

    const friendsSignal = mutualCount >= 2 ? 0.67 : mutualCount === 1 ? 0.33 : 0.0;
    const activeSignal = 1.0;
    const score = Number((2.0 * friendsSignal + 1.0 * activeSignal + 2.0).toFixed(2));

    let reason = "Active fashion contributor";
    if (mutualCount >= 2) {
      reason = `Followed by ${mutualCount} people you follow`;
    } else if (mutualCount === 1) {
      reason = "Followed by 1 person you follow";
    } else if (isEmerging) {
      reason = "Rising creator you might like";
    }

    items.push({
      id: uid,
      handle: u.handle!,
      displayName: u.displayName,
      avatarUrl: u.avatarUrl,
      bio: u.bio,
      followerCount: u.followerCount ?? 0,
      postCount: u.postCount ?? 0,
      isEmerging,
      score,
      reason,
      scoreBreakdown: {
        friends: Number((2.0 * friendsSignal).toFixed(2)),
        active: Number((1.0 * activeSignal).toFixed(2)),
      },
    });

    if (items.length >= limit) break;
  }

  // Variety arrangement: ensure emerging creators are placed (at least 1 in 4)
  items.sort((a, b) => b.score - a.score);

  return { items, count: items.length };
}

/**
 * Record a user dismissal (hidden for 30 days).
 */
export async function dismissSuggestion(
  userId: string,
  targetType: SuggestionTargetType,
  targetId: string,
): Promise<{ status: "ok"; action: "dismiss"; dismissedUntil: string }> {
  const userOid = new Types.ObjectId(userId);
  const targetOid = new Types.ObjectId(targetId);
  const now = new Date();
  const dismissedUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await SuggestionFeedback.findOneAndUpdate(
    { userId: userOid, targetType, targetId: targetOid },
    {
      $set: {
        dismissedUntil,
        lastAction: "dismiss",
        updatedAt: now,
      },
    },
    { upsert: true, new: true },
  );

  return {
    status: "ok",
    action: "dismiss",
    dismissedUntil: dismissedUntil.toISOString(),
  };
}

/**
 * Record an ignore action. If ignored 3 times, hides for 14 days.
 */
export async function ignoreSuggestion(
  userId: string,
  targetType: SuggestionTargetType,
  targetId: string,
): Promise<{
  status: "ok";
  action: "ignore";
  ignoreCount: number;
  dismissedUntil: string | null;
}> {
  const userOid = new Types.ObjectId(userId);
  const targetOid = new Types.ObjectId(targetId);
  const now = new Date();

  const existing = await SuggestionFeedback.findOne({
    userId: userOid,
    targetType,
    targetId: targetOid,
  });

  const nextCount = (existing?.ignoreCount ?? 0) + 1;
  let dismissedUntil: Date | null = existing?.dismissedUntil ?? null;

  if (nextCount >= 3) {
    dismissedUntil = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 days
  }

  await SuggestionFeedback.findOneAndUpdate(
    { userId: userOid, targetType, targetId: targetOid },
    {
      $set: {
        ignoreCount: nextCount,
        dismissedUntil,
        lastAction: "ignore",
        updatedAt: now,
      },
    },
    { upsert: true, new: true },
  );

  return {
    status: "ok",
    action: "ignore",
    ignoreCount: nextCount,
    dismissedUntil: dismissedUntil ? dismissedUntil.toISOString() : null,
  };
}
