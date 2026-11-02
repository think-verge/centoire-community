import { CircleDoc, HashtagDoc, PersonDoc, PostDoc } from "./model.js";

export type SearchType = "all" | "posts" | "people" | "circles" | "hashtags" | "tags";

const normalizePrefix = (q: string) => q.trim().replace(/^#+/, "").toLowerCase();
const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export async function search(q: string, type: SearchType) {
  const limit = type === "all" ? 5 : 20;
  const trimmed = q ? q.trim() : "";
  const hasText = trimmed.length > 0;
  const textQuery = hasText ? { $text: { $search: trimmed } } : {};
  const score = hasText ? { score: { $meta: "textScore" as const } } : {};
  type Sort = Record<string, 1 | -1 | { $meta: "textScore" }>;
  const rank = (fallback: Sort): Sort => (hasText ? { score: { $meta: "textScore" } } : fallback);

  const wants = (t: string) => type === "all" || type === t;

  const [posts, people, circles, hashtags] = await Promise.all([
    wants("posts")
      ? PostDoc.find(
          // Private-circle posts are excluded: global search must not leak them.
          { ...textQuery, status: "published", circlePrivate: { $ne: true } },
          hasText ? { ...score, card: 1 } : { card: 1 },
        )
          .sort(rank({ publishedAt: -1 }))
          .limit(limit)
          .lean()
      : [],
    wants("people")
      ? PersonDoc.find({ ...textQuery, hasHandle: true }, hasText ? { ...score, card: 1 } : { card: 1 })
          .sort(rank({ followerCount: -1 }))
          .limit(limit)
          .lean()
      : [],
    wants("circles")
      ? CircleDoc.find({ ...textQuery, isPrivate: { $ne: true } }, hasText ? { ...score, card: 1 } : { card: 1 })
          .sort(rank({ memberCount: -1 }))
          .limit(limit)
          .lean()
      : [],
    wants("hashtags")
      ? HashtagDoc.find({
          status: "active",
          ...(normalizePrefix(trimmed) ? { name: { $regex: `^${escapeRegex(normalizePrefix(trimmed))}` } } : {}),
        })
          .sort({ postCount: -1, name: 1 })
          .limit(limit)
          .select("name postCount")
          .lean()
      : [],
  ]);

  return {
    posts: posts.map((p) => p.card),
    people: people.map((p) => p.card),
    circles: circles.map((c) => c.card),
    hashtags: hashtags.map((h) => ({ name: h.name, postCount: h.postCount })),
  };
}
