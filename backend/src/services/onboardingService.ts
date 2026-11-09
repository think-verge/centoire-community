import { Circle, type ICircle } from "../models/Circle.js";
import { Follow } from "../models/Follow.js";
import { CircleMembership } from "../models/CircleMembership.js";
import { User, type IUser } from "../models/User.js";

export interface OnboardingSuggestions {
  creators: IUser[];
  circles: ICircle[];
  followedCreatorIds: string[];
  joinedCircleIds: string[];
}

function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
}

export async function getSuggestions(userId: string): Promise<OnboardingSuggestions> {
  const user = await User.findById(userId);
  const interests = user?.followedHashtags ?? [];
  const domains = (user?.domains ?? []).map((d) => d.trim()).filter(Boolean);
  const userLocation = user?.location?.trim();

  // Normalized keywords from domains (lowercase, stripped of punctuation for hashtag matching)
  const domainKeywords = domains.map((d) => d.toLowerCase());
  const domainTagMatches = domains.map((d) => d.toLowerCase().replace(/[^a-z0-9]/g, ""));
  const allTagInterests = [...new Set([...interests, ...domainKeywords, ...domainTagMatches])];

  // 1. Matching Creators (role: "creator", invite-only privileged accounts)
  // Match criteria:
  // - matches user's chosen domains
  // - matches user's location
  // - matches user's followed hashtags
  const creatorOrConditions: Record<string, unknown>[] = [];
  if (domains.length > 0) {
    creatorOrConditions.push({ domains: { $in: domains } });
  }
  if (userLocation) {
    creatorOrConditions.push({ location: { $regex: new RegExp(escapeRegex(userLocation), "i") } });
  }
  if (allTagInterests.length > 0) {
    creatorOrConditions.push({ followedHashtags: { $in: allTagInterests } });
  }

  let creators: IUser[] = [];
  if (creatorOrConditions.length > 0) {
    const matching = await User.find({
      _id: { $ne: userId },
      role: "creator",
      handle: { $exists: true },
      $or: creatorOrConditions,
    })
      .sort({ reputation: -1, followerCount: -1 })
      .limit(12);

    // Sort to prioritize creators matching both domains & location or domains directly
    if (domains.length > 0 || userLocation) {
      matching.sort((a, b) => {
        let scoreA = 0;
        let scoreB = 0;

        if (domains.length > 0) {
          if (a.domains?.some((d) => domains.includes(d))) scoreA += 5;
          if (b.domains?.some((d) => domains.includes(d))) scoreB += 5;
        }

        if (userLocation) {
          const locRegex = new RegExp(escapeRegex(userLocation), "i");
          if (a.location && locRegex.test(a.location)) scoreA += 4;
          if (b.location && locRegex.test(b.location)) scoreB += 4;
        }

        if (allTagInterests.length > 0) {
          if (a.followedHashtags?.some((t) => allTagInterests.includes(t))) scoreA += 2;
          if (b.followedHashtags?.some((t) => allTagInterests.includes(t))) scoreB += 2;
        }

        if (scoreB !== scoreA) return scoreB - scoreA;
        return (b.reputation || 0) - (a.reputation || 0);
      });
    }

    creators = matching;
  }

  // Fallback: top creators overall if fewer than 6 suggestions
  if (creators.length < 6) {
    const fallback = await User.find({
      _id: { $ne: userId, $nin: creators.map((c) => c._id) },
      role: "creator",
      handle: { $exists: true },
    })
      .sort({ reputation: -1, followerCount: -1 })
      .limit(12 - creators.length);
    creators = [...creators, ...fallback];
  }

  // 2. Matching Circles (public circles)
  // Match criteria:
  // - hashtags matching user's interests or domains
  // - circle name/description matching domains or userLocation
  const circleOrConditions: Record<string, unknown>[] = [];
  if (allTagInterests.length > 0) {
    circleOrConditions.push({ hashtags: { $in: allTagInterests } });
  }
  for (const domain of domains) {
    const reg = new RegExp(escapeRegex(domain), "i");
    circleOrConditions.push({ name: { $regex: reg } });
    circleOrConditions.push({ description: { $regex: reg } });
  }
  if (userLocation) {
    const locRegex = new RegExp(escapeRegex(userLocation), "i");
    circleOrConditions.push({ name: { $regex: locRegex } });
    circleOrConditions.push({ description: { $regex: locRegex } });
  }

  let circles: ICircle[] = [];
  if (circleOrConditions.length > 0) {
    circles = await Circle.find({
      isPrivate: { $ne: true },
      $or: circleOrConditions,
    })
      .sort({ memberCount: -1 })
      .limit(12);
  }

  // Fallback: top circles overall if fewer than 6 suggestions
  if (circles.length < 6) {
    const fallback = await Circle.find({
      _id: { $nin: circles.map((c) => c._id) },
      isPrivate: { $ne: true },
    })
      .sort({ memberCount: -1 })
      .limit(12 - circles.length);
    circles = [...circles, ...fallback];
  }

  const [follows, memberships] = await Promise.all([
    Follow.find({ followerId: userId }).select("followeeId"),
    CircleMembership.find({ userId }).select("circleId"),
  ]);

  return {
    creators,
    circles,
    followedCreatorIds: follows.map((f) => String(f.followeeId)),
    joinedCircleIds: memberships.map((m) => String(m.circleId)),
  };
}
