import { Circle, type ICircle } from "../models/Circle.js";
import { CircleMembership, type CircleRole } from "../models/CircleMembership.js";
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

export async function createCircle(
  userId: string,
  input: {
    name: string;
    description: string;
    about?: string;
    rules?: string[];
    tagIds?: string[];
    avatarUrl?: string;
    coverImageUrl?: string;
  },
): Promise<ICircle> {
  const baseSlug = slugify(input.name);
  let slug = baseSlug;
  let attempt = 1;
  while (await Circle.exists({ slug })) {
    attempt += 1;
    slug = `${baseSlug}-${attempt}`;
  }
  const circle = await Circle.create({
    name: input.name,
    slug,
    description: input.description,
    about: input.about,
    rules: input.rules ?? [],
    tags: input.tagIds ?? [],
    avatarUrl: input.avatarUrl,
    coverImageUrl: input.coverImageUrl,
    createdBy: userId,
    memberCount: 1,
  });
  await CircleMembership.create({ circleId: circle._id, userId, role: "owner" });
  return circle.populate("tags", "name slug");
}

export async function joinCircle(circleId: string, userId: string): Promise<void> {
  try {
    await CircleMembership.create({ circleId, userId, role: "member" });
  } catch (err: unknown) {
    if ((err as { code?: number }).code === 11000) return; // already a member
    throw err;
  }
  await Circle.updateOne({ _id: circleId }, { $inc: { memberCount: 1 } });
}

export async function leaveCircle(circleId: string, userId: string): Promise<void> {
  const membership = await CircleMembership.findOne({ circleId, userId });
  if (!membership) return;
  if (membership.role === "owner") {
    throw new ApiError(422, "Owners cannot leave their circle");
  }
  await membership.deleteOne();
  await Circle.updateOne({ _id: circleId }, { $inc: { memberCount: -1 } });
}
