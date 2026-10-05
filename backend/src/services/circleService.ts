import { Types } from "mongoose";
import { Circle, type ICircle } from "../models/Circle.js";
import { CircleMembership, type CircleRole } from "../models/CircleMembership.js";
import { Tag } from "../models/Tag.js";
import type { IUser } from "../models/User.js";
import { serializeUser } from "./userSerializer.js";
import { ApiError } from "../utils/api-error.js";
import { slugify } from "../utils/slugify.js";

export function serializeCircle(circle: ICircle, viewerRole?: CircleRole | null) {
  const tags = circle.tags as unknown as Array<{ _id: unknown; name?: string; slug?: string }>;
  return {
    id: circle._id.toString(),
    name: circle.name,
    slug: circle.slug,
    description: circle.description,
    about: circle.about ?? null,
    rules: circle.rules,
    avatarUrl: circle.avatarUrl ?? null,
    coverImageUrl: circle.coverImageUrl ?? null,
    tags: tags.map((tag) => ({
      id: String(tag._id ?? tag),
      name: tag.name ?? "",
      slug: tag.slug ?? "",
    })),
    memberCount: circle.memberCount,
    postCount: circle.postCount,
    viewerRole: viewerRole ?? null,
    createdAt: circle.createdAt.toISOString(),
  };
}

export async function getBySlug(slug: string): Promise<ICircle> {
  const circle = await Circle.findOne({ slug }).populate("tags", "name slug");
  if (!circle) throw new ApiError(404, "Circle not found");
  return circle;
}

export async function getViewerRole(
  circleId: string,
  userId?: string,
): Promise<CircleRole | null> {
  if (!userId) return null;
  const membership = await CircleMembership.findOne({ circleId, userId });
  return membership?.role ?? null;
}

const MAX_CIRCLE_TAGS = 5;
const MAX_SLUG_ATTEMPTS = 8;

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isDuplicateKey(err: unknown): boolean {
  return (err as { code?: number }).code === 11000;
}

async function resolveTagIds(input: { tagIds?: string[]; tagNames?: string[] }): Promise<string[]> {
  const ids = new Set<string>(input.tagIds ?? []);
  if (ids.size > 0) {
    const found = await Tag.countDocuments({ _id: { $in: [...ids] } });
    if (found !== ids.size) throw new ApiError(422, "tagIds: one or more tags do not exist");
  }
  const slugs = new Map<string, string>();
  for (const name of input.tagNames ?? []) {
    const tagSlug = slugify(name);
    if (tagSlug && !slugs.has(tagSlug)) slugs.set(tagSlug, name);
  }
  const tags = await Promise.all(
    [...slugs].map(([tagSlug, name]) =>
      Tag.findOneAndUpdate(
        { slug: tagSlug },
        { $setOnInsert: { name, slug: tagSlug, category: "culture" } },
        { upsert: true, new: true },
      ),
    ),
  );
  for (const tag of tags) ids.add(tag._id.toString());
  if (ids.size < 1) throw new ApiError(422, "tags: pick at least one topic");
  if (ids.size > MAX_CIRCLE_TAGS) {
    throw new ApiError(422, `tags: a circle can have at most ${MAX_CIRCLE_TAGS} topics`);
  }
  return [...ids];
}

export async function createCircle(
  userId: string,
  input: {
    name: string;
    description: string;
    about?: string;
    rules?: string[];
    tagIds?: string[];
    tagNames?: string[];
    avatarUrl?: string;
    coverImageUrl?: string;
  },
): Promise<ICircle> {
  const name = input.name.trim();
  if (await Circle.exists({ name: { $regex: `^${escapeRegex(name)}$`, $options: "i" } })) {
    throw new ApiError(409, "A circle with this name already exists");
  }
  const tags = await resolveTagIds(input);
  const baseSlug = slugify(name);

  for (let attempt = 1; attempt <= MAX_SLUG_ATTEMPTS; attempt++) {
    const slug = attempt === 1 ? baseSlug : `${baseSlug}-${attempt}`;
    let circle: ICircle;
    try {
      circle = await Circle.create({
        name,
        slug,
        description: input.description,
        about: input.about,
        rules: input.rules ?? [],
        tags,
        avatarUrl: input.avatarUrl,
        coverImageUrl: input.coverImageUrl,
        createdBy: userId,
        memberCount: 1,
      });
    } catch (err) {
      if (isDuplicateKey(err)) continue; // slug taken (possibly by a concurrent create)
      throw err;
    }
    try {
      await CircleMembership.create({ circleId: circle._id, userId, role: "owner" });
    } catch (err) {
      await Circle.deleteOne({ _id: circle._id }); // never leave an ownerless circle behind
      throw err;
    }
    return circle.populate("tags", "name slug");
  }
  throw new ApiError(409, "Could not allocate a unique handle for this circle, try a different name");
}

export async function listCircles(
  query: { q?: string; tag?: string; limit?: number },
  viewerId?: string,
) {
  const filter: Record<string, unknown> = {};
  if (query.tag) {
    const tag = await Tag.findOne({ slug: query.tag }).select("_id");
    if (!tag) return [];
    filter.tags = tag._id;
  }
  const limit = query.limit ?? 50;
  let find = Circle.find(filter);
  if (query.q) {
    filter.$text = { $search: query.q };
    find = Circle.find(filter)
      .select({ score: { $meta: "textScore" } })
      .sort({ score: { $meta: "textScore" }, memberCount: -1 });
  } else {
    find = find.sort({ memberCount: -1, _id: 1 });
  }
  const circles = await find.limit(limit).populate("tags", "name slug");

  const roles = new Map<string, CircleRole>();
  if (viewerId && circles.length > 0) {
    const memberships = await CircleMembership.find({
      userId: viewerId,
      circleId: { $in: circles.map((c) => c._id) },
    }).select("circleId role");
    for (const m of memberships) roles.set(m.circleId.toString(), m.role);
  }
  return circles.map((c) => serializeCircle(c, roles.get(c._id.toString()) ?? null));
}

const ROLE_RANK: Record<CircleRole, number> = { owner: 0, moderator: 1, member: 2 };
const MEMBER_LIMIT = 100;

export async function listMembers(circleId: Types.ObjectId) {
  const memberships = await CircleMembership.find({ circleId })
    .sort({ createdAt: 1 })
    .limit(MEMBER_LIMIT * 2)
    .populate({
      path: "userId",
      select: "handle displayName avatarUrl bio reputation followerCount followingCount postCount createdAt",
    });
  return memberships
    .filter((m) => m.userId)
    .sort((a, b) => ROLE_RANK[a.role] - ROLE_RANK[b.role])
    .slice(0, MEMBER_LIMIT)
    .map((m) => ({ role: m.role, user: serializeUser(m.userId as unknown as IUser) }));
}

export async function joinCircle(circleId: string, userId: string): Promise<void> {
  try {
    await CircleMembership.create({ circleId, userId, role: "member" });
  } catch (err: unknown) {
    if (isDuplicateKey(err)) return; // already a member
    throw err;
  }
  await Circle.updateOne({ _id: circleId }, { $inc: { memberCount: 1 } });
}

export async function leaveCircle(circleId: string, userId: string): Promise<void> {
  // Delete atomically so two concurrent leaves can't both decrement the count.
  const removed = await CircleMembership.findOneAndDelete({
    circleId,
    userId,
    role: { $ne: "owner" },
  });
  if (!removed) {
    const owner = await CircleMembership.exists({ circleId, userId, role: "owner" });
    if (owner) throw new ApiError(422, "Owners cannot leave their circle");
    return;
  }
  await Circle.updateOne({ _id: circleId, memberCount: { $gt: 0 } }, { $inc: { memberCount: -1 } });
}
