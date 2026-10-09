import type { IUser } from "../models/User.js";

interface SerializeOptions {
  /** Include email, role, verification and onboarding state — only for the user themself. */
  private?: boolean;
}

export function serializeUser(user: IUser, opts: SerializeOptions = {}) {
  const base = {
    id: user._id.toString(),
    handle: user.handle ?? null,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl ?? null,
    bio: user.bio ?? null,
    reputation: user.reputation,
    followerCount: user.followerCount,
    followingCount: user.followingCount,
    postCount: user.postCount,
    createdAt: user.createdAt.toISOString(),
  };
  if (!opts.private) return base;
  return {
    ...base,
    email: user.email,
    role: user.role,
    emailVerified: user.emailVerified,
    onboardingCompleted: Boolean(user.onboardingCompletedAt),
    followedHashtags: user.followedHashtags ?? [],
  };
}
