import type { AuthPayload } from "@centoire/contracts";
import { ApiError } from "@centoire/server-kit";
import { CandidateProfile } from "../models/index.js";
import { getUserByHandle, getUserSummaries } from "../platform.js";
import type { CandidateProfileInput } from "../schemas/jobs.js";
import { isPlatformAdmin, memberCompanyIds } from "./access.js";
import { serializeProfile } from "./serializers.js";

export async function getMine(user: AuthPayload) {
  const [profile, users] = await Promise.all([
    CandidateProfile.findOne({ userId: user.userId }),
    getUserSummaries([user.userId]),
  ]);
  return serializeProfile(profile, users.get(user.userId) ?? null);
}

export async function updateMine(user: AuthPayload, input: CandidateProfileInput) {
  const set = Object.fromEntries(Object.entries(input).filter(([, v]) => v !== undefined));
  if (Array.isArray(set.skills)) set.skills = [...new Set(set.skills as string[])];
  const profile = await CandidateProfile.findOneAndUpdate(
    { userId: user.userId },
    { $set: set, $setOnInsert: { userId: user.userId } },
    { upsert: true, new: true, runValidators: true },
  );
  const users = await getUserSummaries([user.userId]);
  return serializeProfile(profile, users.get(user.userId) ?? null);
}

/** public: any signed-in-or-not viewer; recruiters: members of any company; private: owner only. */
export async function getByHandle(handle: string, viewer?: AuthPayload) {
  const target = await getUserByHandle(handle);
  if (!target) throw new ApiError(404, "Candidate not found");
  const profile = await CandidateProfile.findOne({ userId: target.id });
  if (!profile) throw new ApiError(404, "Candidate not found");
  const isSelf = viewer?.userId === target.id;
  if (!isSelf && profile.visibility === "private") throw new ApiError(403, "This profile is private");
  if (!isSelf && profile.visibility === "recruiters") {
    const allowed = viewer && (isPlatformAdmin(viewer) || (await memberCompanyIds(viewer.userId)).size > 0);
    if (!allowed) throw new ApiError(403, "This profile is only visible to recruiters");
  }
  return serializeProfile(profile, target);
}
