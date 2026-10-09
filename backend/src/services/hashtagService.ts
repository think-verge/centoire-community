import type { AnyBulkWriteOperation } from "mongodb";
import { Hashtag, type IHashtag } from "../models/Hashtag.js";
import { Post } from "../models/Post.js";
import { User } from "../models/User.js";
import { ApiError } from "../utils/api-error.js";
import { escapeRegex, normalizeHashtag, normalizeHashtags, normalizePrefix } from "../utils/hashtag.js";

export const DEFAULT_SUGGEST_LIMIT = 8;
export const MAX_SUGGEST_LIMIT = 50;
const SHORT_PREFIX_TTL_MS = 60_000;
const TRENDING_TTL_MS = 5 * 60_000;
const TRENDING_WINDOW_DAYS = 7;

interface CacheEntry<T> {
  at: number;
  value: T;
}
const suggestCache = new Map<string, CacheEntry<Suggestion[]>>();
const trendingCache = new Map<string, CacheEntry<TrendingHashtag[]>>();
const CACHE_MAX_ENTRIES = 500;

function remember<T>(cache: Map<string, CacheEntry<T>>, key: string, value: T): T {
  if (cache.size >= CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value as string);
  cache.set(key, { at: Date.now(), value });
  return value;
}
function recall<T>(cache: Map<string, CacheEntry<T>>, key: string, ttl: number): T | undefined {
  const hit = cache.get(key);
  return hit && Date.now() - hit.at < ttl ? hit.value : undefined;
}

export interface Suggestion {
  name: string;
  postCount: number;
}
export interface TrendingHashtag extends Suggestion {
  /** Posts using it in the trending window. */
  recentCount: number;
}

const isDuplicateKey = (err: unknown) => (err as { code?: number }).code === 11000;

/**
 * Typeahead. An anchored `^prefix` match on the unique `name` index, most-used first, hard-capped.
 * Very short prefixes match thousands of rows, so those results are cached briefly.
 */
export async function search(params: { q?: string; limit?: number; featured?: boolean }): Promise<Suggestion[]> {
  const prefix = normalizePrefix(params.q ?? "");
  const limit = Math.min(Math.max(params.limit ?? DEFAULT_SUGGEST_LIMIT, 1), MAX_SUGGEST_LIMIT);
  const cacheable = prefix.length <= 2;
  const key = `${prefix}|${limit}|${params.featured ? 1 : 0}`;
  if (cacheable) {
    const hit = recall(suggestCache, key, SHORT_PREFIX_TTL_MS);
    if (hit) return hit;
  }
  const filter: Record<string, unknown> = { status: "active" };
  if (prefix) filter.name = { $regex: `^${escapeRegex(prefix)}` };
  if (params.featured) filter.featured = true;
  const rows = await Hashtag.find(filter)
    .sort({ postCount: -1, name: 1 })
    .limit(limit)
    .select("name postCount")
    .lean();
  const result = rows.map((r) => ({ name: r.name, postCount: r.postCount }));
  return cacheable ? remember(suggestCache, key, result) : result;
}

/** Hashtags used most in recent published posts (optionally within one post category). */
export async function trending(params: { category?: string; limit?: number }): Promise<TrendingHashtag[]> {
  const limit = Math.min(Math.max(params.limit ?? 12, 1), 30);
  const key = `${params.category ?? "all"}|${limit}`;
  const hit = recall(trendingCache, key, TRENDING_TTL_MS);
  if (hit) return hit;

  const since = new Date(Date.now() - TRENDING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const match: Record<string, unknown> = { status: "published", publishedAt: { $gte: since } };
  if (params.category) match.category = params.category;
  const recent = await Post.aggregate<{ _id: string; recentCount: number }>([
    { $match: match },
    { $unwind: "$hashtags" },
    { $group: { _id: "$hashtags", recentCount: { $sum: 1 } } },
    { $sort: { recentCount: -1, _id: 1 } },
    { $limit: limit * 2 }, // headroom: blocked hashtags are filtered out below
  ]);

  let rows: TrendingHashtag[] = [];
  if (recent.length > 0) {
    const docs = await Hashtag.find({ name: { $in: recent.map((r) => r._id) }, status: "active" })
      .select("name postCount")
      .lean();
    const byName = new Map(docs.map((d) => [d.name, d.postCount]));
    rows = recent
      .filter((r) => byName.has(r._id))
      .slice(0, limit)
      .map((r) => ({ name: r._id, postCount: byName.get(r._id) ?? 0, recentCount: r.recentCount }));
  }
  if (rows.length === 0) {
    // Quiet week (or fresh install): fall back to all-time most used.
    rows = (await search({ limit })).map((s) => ({ ...s, recentCount: 0 }));
  }
  return remember(trendingCache, key, rows);
}

export async function getByName(name: string, viewerId?: string) {
  const normalized = normalizeHashtag(name);
  const doc = normalized ? await Hashtag.findOne({ name: normalized, status: "active" }) : null;
  if (!doc || !normalized) throw new ApiError(404, "Hashtag not found");
  const following = viewerId
    ? Boolean(await User.exists({ _id: viewerId, followedHashtags: normalized }))
    : false;
  return serialize(doc, following);
}

export function serialize(doc: IHashtag, following = false) {
  return { name: doc.name, postCount: doc.postCount, followerCount: doc.followerCount, following };
}

/**
 * Normalizes, de-duplicates and upserts hashtags, returning the ones that may be used.
 * Blocked hashtags are silently dropped. Safe under concurrent creation of the same name.
 */
export async function ensureHashtags(names: readonly unknown[], opts: { createdBy?: string; max?: number } = {}): Promise<string[]> {
  const normalized = normalizeHashtags(names, opts.max);
  if (normalized.length === 0) return [];
  const blocked = await Hashtag.find({ name: { $in: normalized }, status: "blocked" }).select("name").lean();
  const blockedSet = new Set(blocked.map((b) => b.name));
  const allowed = normalized.filter((n) => !blockedSet.has(n));
  if (allowed.length === 0) return [];
  const ops = allowed.map((name) => ({
    updateOne: {
      filter: { name },
      update: { $setOnInsert: { name, postCount: 0, followerCount: 0, featured: false, status: "active", ...(opts.createdBy ? { createdBy: opts.createdBy } : {}) } },
      upsert: true,
    },
  }));
  try {
    await Hashtag.bulkWrite(ops as never, { ordered: false });
  } catch (err) {
    // Two requests creating the same new hashtag race on the unique index; the loser can ignore it.
    if (!isDuplicateKey(err) && !(err as { writeErrors?: Array<{ err?: { code?: number } }> }).writeErrors?.every((w) => w.err?.code === 11000)) throw err;
  }
  return allowed;
}

/** Subset of `names` that already exist and are active (used for AI-suggested hashtags: never creates). */
export async function filterExisting(names: readonly unknown[]): Promise<string[]> {
  const normalized = normalizeHashtags(names);
  if (normalized.length === 0) return [];
  const docs = await Hashtag.find({ name: { $in: normalized }, status: "active" }).select("name").lean();
  const existing = new Set(docs.map((d) => d.name));
  return normalized.filter((n) => existing.has(n));
}

/** Applies +1 / -1 usage-count changes. Decrements never go below zero. */
export async function adjustCounts(delta: { added?: readonly string[]; removed?: readonly string[] }): Promise<void> {
  const ops: AnyBulkWriteOperation<IHashtag>[] = [];
  for (const name of delta.added ?? []) {
    ops.push({ updateOne: { filter: { name }, update: { $inc: { postCount: 1 } } } });
  }
  for (const name of delta.removed ?? []) {
    ops.push({ updateOne: { filter: { name, postCount: { $gt: 0 } }, update: { $inc: { postCount: -1 } } } });
  }
  if (ops.length > 0) await Hashtag.bulkWrite(ops as never, { ordered: false });
}

export async function follow(userId: string, name: string): Promise<void> {
  const normalized = normalizeHashtag(name);
  const doc = normalized ? await Hashtag.findOne({ name: normalized, status: "active" }).select("_id") : null;
  if (!doc || !normalized) throw new ApiError(404, "Hashtag not found");
  const res = await User.updateOne({ _id: userId, followedHashtags: { $ne: normalized } }, { $addToSet: { followedHashtags: normalized } });
  if (res.modifiedCount > 0) await Hashtag.updateOne({ _id: doc._id }, { $inc: { followerCount: 1 } });
}

export async function unfollow(userId: string, name: string): Promise<void> {
  const normalized = normalizeHashtag(name);
  if (!normalized) return;
  const res = await User.updateOne({ _id: userId, followedHashtags: normalized }, { $pull: { followedHashtags: normalized } });
  if (res.modifiedCount > 0) await Hashtag.updateOne({ name: normalized, followerCount: { $gt: 0 } }, { $inc: { followerCount: -1 } });
}

export async function setStatus(name: string, status: "active" | "blocked"): Promise<void> {
  const normalized = normalizeHashtag(name);
  const res = normalized ? await Hashtag.updateOne({ name: normalized }, { $set: { status } }) : null;
  if (!res || res.matchedCount === 0) throw new ApiError(404, "Hashtag not found");
  suggestCache.clear();
  trendingCache.clear();
}

/**
 * Recomputes every `postCount` from published posts. Counts are also maintained incrementally;
 * this nightly pass guarantees any drift (crashes, bulk deletes, old data) is corrected.
 */
export async function reconcileCounts(): Promise<{ updated: number; zeroed: number }> {
  const actual = await Post.aggregate<{ _id: string; n: number }>([
    { $match: { status: "published" } },
    { $unwind: "$hashtags" },
    { $group: { _id: "$hashtags", n: { $sum: 1 } } },
  ]);
  const ops: AnyBulkWriteOperation<IHashtag>[] = actual.map((a) => ({
    updateOne: { filter: { name: a._id, postCount: { $ne: a.n } }, update: { $set: { postCount: a.n } } },
  }));
  const used = actual.map((a) => a._id);
  ops.push({ updateMany: { filter: { name: { $nin: used }, postCount: { $ne: 0 } }, update: { $set: { postCount: 0 } } } });
  const res = await Hashtag.bulkWrite(ops as never, { ordered: false });
  suggestCache.clear();
  trendingCache.clear();
  return { updated: res.modifiedCount, zeroed: 0 };
}

/** Test hook. */
export function clearHashtagCaches(): void {
  suggestCache.clear();
  trendingCache.clear();
}
