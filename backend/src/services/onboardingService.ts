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

export async function getSuggestions(userId: string): Promise<OnboardingSuggestions> {
  const user = await User.findById(userId);
  const interestIds = user?.interests ?? [];

  // Creators: only role:"creator" users — invite-only privileged accounts.
  // Primary: creators who share the user's interests.
  // Fallback: top creators overall (still role-filtered).
  const matching = await User.find({
    _id: { $ne: userId },
    role: "creator",
    handle: { $exists: true },
    interests: { $in: interestIds },
  })
    .sort({ reputation: -1, followerCount: -1 })
    .limit(12);

  let creators = matching;
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

  const matchingCircles = await Circle.find({ tags: { $in: interestIds } })
    .sort({ memberCount: -1 })
    .limit(12);
  let circles = matchingCircles;
  if (circles.length < 6) {
    const fallback = await Circle.find({ _id: { $nin: circles.map((c) => c._id) } })
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
