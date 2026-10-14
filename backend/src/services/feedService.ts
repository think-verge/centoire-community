import { Types, type PipelineStage } from "mongoose";
import { Post, type IPost } from "../models/Post.js";
import { User } from "../models/User.js";
import { decodeCursor, encodeCursor } from "../utils/cursor.js";
import type { PostCategory } from "../config/categoryTaxonomy.js";
import * as userService from "./userService.js";
import { serializePostCard, type ViewerState } from "./postSerializer.js";

const PAGE_SIZE = 20;
/** Score-sorted feeds paginate by offset inside a deterministic aggregation.
 *  Cap the walk depth; replace with a precomputed rankScore + decay cron when
 *  the corpus outgrows this. */
const MAX_RANKED_OFFSET = 400;
const FOR_YOU_WINDOW_DAYS = 90;
const TRENDING_WINDOW_DAYS = 90;

export interface FeedPage {
  items: ReturnType<typeof serializePostCard>[];
  nextCursor: string | null;
}

interface RankedCursor extends Record<string, unknown> {
  offset: number;
}

interface KeysetCursor extends Record<string, unknown> {
  publishedAt: string;
  id: string;
}

const CARD_POPULATE = [
  { path: "authorId", select: "handle displayName avatarUrl role followerCount" },
  { path: "sourceId", select: "name siteUrl faviconUrl" },
  { path: "circleId", select: "name slug" },
];

/** score = log10(upvotes+1)*4 + tagMatch*2 + follow*6 + circle*4 + creator*3 - hoursOld/6
 *  Note: cache creatorIds if the creator roster grows large (currently invite-only, so small). */
function scoreStages(
  interests: string[],
  followedIds: Types.ObjectId[],
  circleIds: Types.ObjectId[],
  creatorIds: Types.ObjectId[],
): PipelineStage[] {
  return [
    {
      $addFields: {
        tagMatchCount: { $size: { $setIntersection: [{ $ifNull: ["$hashtags", []] }, interests] } },
        authorFollowed: {
          $cond: [{ $in: ["$authorId", followedIds] }, 1, 0],
        },
        inJoinedCircle: {
          $cond: [{ $in: ["$circleId", circleIds] }, 1, 0],
        },
        authorIsCreator: {
          $cond: [{ $in: ["$authorId", creatorIds] }, 1, 0],
        },
        hoursSincePublished: {
          $divide: [
            {
              $subtract: [
                new Date(),
                { $ifNull: ["$publishedAt", new Date()] },
              ],
            },
            1000 * 60 * 60,
          ],
        },
      },
    },
    {
      $addFields: {
        score: {
          $add: [
            { $multiply: [{ $log10: { $add: [{ $ifNull: ["$upvoteCount", 0] }, 1] } }, 4] },
            { $multiply: ["$tagMatchCount", 2] },
            { $multiply: ["$authorFollowed", 6] },
            { $multiply: ["$inJoinedCircle", 4] },
            { $multiply: ["$authorIsCreator", 3] },
            { $multiply: [{ $ifNull: ["$aiQualityScore", 0] }, 2] },
            { $multiply: [{ $divide: [{ $ifNull: ["$hoursSincePublished", 0] }, 6] }, -1] },
          ],
        },
      },
    },
    { $sort: { score: -1, publishedAt: -1, _id: -1 } },
  ];
}

async function hydrate(ids: Types.ObjectId[]): Promise<IPost[]> {
  const posts = await Post.find({ _id: { $in: ids } }).populate(CARD_POPULATE);
  const byId = new Map(posts.map((p) => [p._id.toString(), p]));
  return ids.map((id) => byId.get(id.toString())).filter(Boolean) as IPost[];
}

async function viewerStates(
  postIds: Types.ObjectId[],
  userId?: string,
): Promise<Map<string, ViewerState>> {
  const map = new Map<string, ViewerState>();
  if (!userId || postIds.length === 0) return map;
  const [{ Vote }, { Bookmark }, { PostReport }] = await Promise.all([
    import("../models/Vote.js"),
    import("../models/Bookmark.js"),
    import("../models/PostReport.js"),
  ]);
  const [votes, bookmarks, reports] = await Promise.all([
    Vote.find({ userId, targetType: "post", targetId: { $in: postIds } }),
    Bookmark.find({ userId, postId: { $in: postIds } }),
    PostReport.find({ reporterId: userId, postId: { $in: postIds } }),
  ]);
  for (const id of postIds) {
    map.set(id.toString(), { voted: null, bookmarked: false, reported: false });
  }
  for (const vote of votes) {
    const entry = map.get(vote.targetId.toString());
    if (entry) entry.voted = vote.value;
  }
  for (const bookmark of bookmarks) {
    const entry = map.get(bookmark.postId.toString());
    if (entry) entry.bookmarked = true;
  }
  for (const report of reports) {
    const entry = map.get(report.postId.toString());
    if (entry) entry.reported = true;
  }
  return map;
}

async function getDismissedPostIds(userId?: string): Promise<Types.ObjectId[]> {
  if (!userId || !Types.ObjectId.isValid(userId)) return [];
  const user = await User.findById(userId).select("dismissedPosts").lean();
  return ((user as any)?.dismissedPosts ?? []) as Types.ObjectId[];
}

async function buildPage(
  ids: Types.ObjectId[],
  userId: string | undefined,
  nextCursor: string | null,
): Promise<FeedPage> {
  const posts = await hydrate(ids);
  const states = await viewerStates(ids, userId);
  const followedUserIds = userId ? await userService.getFollowedUserIds(userId) : [];
  const followedSet = new Set(followedUserIds.map((id) => id.toString()));
  const followedSourceIds = userId ? await userService.getFollowedSourceIds(userId) : [];
  const followedSourceSet = new Set(followedSourceIds.map((id) => id.toString()));

  return {
    items: posts.map((p) => {
      const state = states.get(p._id.toString()) ?? { voted: null, bookmarked: false };
      const authorId = p.authorId ? String((p.authorId as { _id?: unknown })._id ?? p.authorId) : null;
      if (authorId) {
        state.authorFollowed = followedSet.has(authorId);
      }
      const sourceId = p.sourceId ? String((p.sourceId as { _id?: unknown })._id ?? p.sourceId) : null;
      if (sourceId) {
        state.sourceFollowed = followedSourceSet.has(sourceId);
      }
      return serializePostCard(p, state);
    }),
    nextCursor,
  };
}

async function rankedFeed(
  match: Record<string, unknown>,
  interests: string[],
  followedIds: Types.ObjectId[],
  circleIds: Types.ObjectId[],
  creatorIds: Types.ObjectId[],
  cursor: string | undefined,
  userId?: string,
): Promise<FeedPage> {
  const dismissed = await getDismissedPostIds(userId);
  if (dismissed.length > 0) {
    match._id = { $nin: dismissed };
  }

  const offset = decodeCursor<RankedCursor>(cursor)?.offset ?? 0;
  if (offset >= MAX_RANKED_OFFSET) return { items: [], nextCursor: null };

  const results = await Post.aggregate<{ _id: Types.ObjectId }>([
    { $match: match },
    ...(scoreStages(interests, followedIds, circleIds, creatorIds) as PipelineStage.FacetPipelineStage[]),
    { $skip: offset },
    { $limit: PAGE_SIZE + 1 },
    { $project: { _id: 1 } },
  ]);

  const hasMore = results.length > PAGE_SIZE;
  const ids = results.slice(0, PAGE_SIZE).map((r) => r._id);
  const nextCursor = hasMore ? encodeCursor({ offset: offset + PAGE_SIZE }) : null;
  return buildPage(ids, userId, nextCursor);
}

async function getCreatorIds(): Promise<Types.ObjectId[]> {
  const creators = await User.find({ role: { $in: ["creator", "admin"] } }).select("_id");
  return creators.map((u) => u._id);
}

export async function forYou(userId: string, cursor?: string): Promise<FeedPage> {
  const user = await User.findById(userId).select("followedHashtags");
  const interests = user?.followedHashtags ?? [];
  const [followedIds, circleIds, creatorIds] = await Promise.all([
    userService.getFollowedUserIds(userId),
    userService.getMembershipCircleIds(userId),
    getCreatorIds(),
  ]);

  const since = new Date(Date.now() - FOR_YOU_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const match: Record<string, unknown> = {
    status: "published",
    publishedAt: { $gte: since },
  };
  const orConditions: Record<string, unknown>[] = [];
  if (interests.length > 0) orConditions.push({ hashtags: { $in: interests } });
  if (circleIds.length > 0) orConditions.push({ circleId: { $in: circleIds } });
  if (followedIds.length > 0) orConditions.push({ authorId: { $in: followedIds } });
  if (orConditions.length > 0) {
    match.$or = orConditions;
  }
  return rankedFeed(match, interests, followedIds, circleIds, creatorIds, cursor, userId);
}

/** Shared "new"-sort pagination: keyset cursor on (publishedAt, _id). Used by
 *  discover()'s "new" sort and by categoryFeed(), which has no ranking mode. */
async function keysetPublishedFeed(
  base: Record<string, unknown>,
  cursor: string | undefined,
  userId?: string,
): Promise<FeedPage> {
  const decoded = decodeCursor<KeysetCursor>(cursor);
  const dismissed = await getDismissedPostIds(userId);
  const filter: Record<string, unknown> = { ...base, publishedAt: { $ne: null } };
  if (dismissed.length > 0) {
    filter._id = { $nin: dismissed };
  }
  if (decoded) {
    filter.$or = [
      { publishedAt: { $lt: new Date(decoded.publishedAt) } },
      {
        publishedAt: new Date(decoded.publishedAt),
        _id: { $lt: new Types.ObjectId(decoded.id) },
      },
    ];
  }
  const posts = await Post.find(filter)
    .sort({ publishedAt: -1, _id: -1 })
    .limit(PAGE_SIZE + 1)
    .select("_id");

  const hasMore = posts.length > PAGE_SIZE;
  const page = posts.slice(0, PAGE_SIZE);
  const last = page[page.length - 1];
  const lastDoc = hasMore && last ? await Post.findById(last._id).select("publishedAt") : null;
  const nextCursor =
    hasMore && lastDoc?.publishedAt
      ? encodeCursor({ publishedAt: lastDoc.publishedAt.toISOString(), id: String(last!._id) })
      : null;
  return buildPage(page.map((p) => p._id), userId, nextCursor);
}

export async function discover(
  options: {
    sort: "trending" | "new";
    hashtag?: string;
    sourceId?: Types.ObjectId;
    origin?: string;
    category?: PostCategory;
    subcategory?: string;
    country?: string;
    q?: string;
    cursor?: string;
  },
  userId?: string,
): Promise<FeedPage> {
  const base: Record<string, unknown> = { status: "published" };
  if (options.hashtag) base.hashtags = options.hashtag;
  if (options.sourceId) base.sourceId = options.sourceId;
  if (options.origin) base.origin = options.origin;
  if (options.category) base.category = options.category;
  if (options.subcategory) base.subcategory = options.subcategory;
  if (options.country) base.country = options.country;
  if (options.q) base.$text = { $search: options.q };

  if (options.sort === "trending") {
    const since = new Date(Date.now() - TRENDING_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const creatorIds = await getCreatorIds();
    return rankedFeed(
      { ...base, publishedAt: { $gte: since } },
      [],
      [],
      [],
      creatorIds,
      options.cursor,
      userId,
    );
  }

  return keysetPublishedFeed(base, options.cursor, userId);
}

/** A single content vertical's mixed-subcategory feed (Fashion, Beauty, etc.) —
 *  no personalization/ranking, just newest-first within the category. */
export async function categoryFeed(
  category: PostCategory,
  subcategory: string | undefined,
  cursor: string | undefined,
  userId?: string,
): Promise<FeedPage> {
  const base: Record<string, unknown> = { status: "published", category };
  if (subcategory) base.subcategory = subcategory;
  return keysetPublishedFeed(base, cursor, userId);
}

/** Newest-first published posts of a single circle, keyset-paginated. */
export async function circleFeed(
  circleId: Types.ObjectId,
  cursor: string | undefined,
  userId?: string,
): Promise<FeedPage> {
  return keysetPublishedFeed({ status: "published", circleId }, cursor, userId);
}

export async function following(userId: string, cursor?: string): Promise<FeedPage> {
  const [followedIds, circleIds, followedSourceIds, dismissed] = await Promise.all([
    userService.getFollowedUserIds(userId),
    userService.getMembershipCircleIds(userId),
    userService.getFollowedSourceIds(userId),
    getDismissedPostIds(userId),
  ]);
  const decoded = decodeCursor<KeysetCursor>(cursor);
  const orConditions: Record<string, unknown>[] = [];
  if (followedIds.length > 0) orConditions.push({ authorId: { $in: followedIds } });
  if (circleIds.length > 0) orConditions.push({ circleId: { $in: circleIds } });
  if (followedSourceIds.length > 0) orConditions.push({ sourceId: { $in: followedSourceIds } });

  const filter: Record<string, unknown> = {
    status: "published",
    $or: orConditions.length > 0 ? orConditions : [{ _id: null }],
  };
  if (dismissed.length > 0) {
    filter._id = { $nin: dismissed };
  }
  if (decoded) {
    filter.$and = [
      {
        $or: [
          { publishedAt: { $lt: new Date(decoded.publishedAt) } },
          {
            publishedAt: new Date(decoded.publishedAt),
            _id: { $lt: new Types.ObjectId(decoded.id) },
          },
        ],
      },
    ];
  }
  const posts = await Post.find(filter)
    .sort({ publishedAt: -1, _id: -1 })
    .limit(PAGE_SIZE + 1)
    .select("_id publishedAt");

  const hasMore = posts.length > PAGE_SIZE;
  const page = posts.slice(0, PAGE_SIZE);
  const last = page[page.length - 1];
  const nextCursor =
    hasMore && last?.publishedAt
      ? encodeCursor({ publishedAt: last.publishedAt.toISOString(), id: String(last._id) })
      : null;
  return buildPage(page.map((p) => p._id), userId, nextCursor);
}
