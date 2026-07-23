import { Types, type PipelineStage } from "mongoose";
import { Post, type IPost } from "../models/Post.js";
import { User } from "../models/User.js";
import { decodeCursor, encodeCursor } from "../utils/cursor.js";
import * as userService from "./userService.js";
import { serializePostCard, type ViewerState } from "./postSerializer.js";

const PAGE_SIZE = 20;
/** Score-sorted feeds paginate by offset inside a deterministic aggregation.
 *  Cap the walk depth; replace with a precomputed rankScore + decay cron when
 *  the corpus outgrows this. */
const MAX_RANKED_OFFSET = 400;
const FOR_YOU_WINDOW_DAYS = 45;
const TRENDING_WINDOW_DAYS = 7;

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
  { path: "authorId", select: "handle displayName avatarUrl" },
  { path: "sourceId", select: "name siteUrl faviconUrl" },
  { path: "tags", select: "name slug" },
  { path: "circleId", select: "name slug" },
];

/** score = log10(upvotes+1)*4 + tagMatch*2 + follow*6 + circle*4 + creator*3 - hoursOld/6
 *  Note: cache creatorIds if the creator roster grows large (currently invite-only, so small). */
function scoreStages(
  interestIds: Types.ObjectId[],
  followedIds: Types.ObjectId[],
  circleIds: Types.ObjectId[],
  creatorIds: Types.ObjectId[],
): PipelineStage[] {
  return [
    {
      $addFields: {
        tagMatchCount: { $size: { $setIntersection: ["$tags", interestIds] } },
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
          $divide: [{ $subtract: [new Date(), "$publishedAt"] }, 1000 * 60 * 60],
        },
      },
    },
    {
      $addFields: {
        score: {
          $add: [
            { $multiply: [{ $log10: { $add: ["$upvoteCount", 1] } }, 4] },
            { $multiply: ["$tagMatchCount", 2] },
            { $multiply: ["$authorFollowed", 6] },
            { $multiply: ["$inJoinedCircle", 4] },
            { $multiply: ["$authorIsCreator", 3] },
            { $multiply: [{ $divide: ["$hoursSincePublished", 6] }, -1] },
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
  const [{ Vote }, { Bookmark }] = await Promise.all([
    import("../models/Vote.js"),
    import("../models/Bookmark.js"),
  ]);
  const [votes, bookmarks] = await Promise.all([
    Vote.find({ userId, targetType: "post", targetId: { $in: postIds } }),
    Bookmark.find({ userId, postId: { $in: postIds } }),
  ]);
  for (const id of postIds) {
    map.set(id.toString(), { voted: null, bookmarked: false });
  }
  for (const vote of votes) {
    const entry = map.get(vote.targetId.toString());
    if (entry) entry.voted = vote.value;
  }
  for (const bookmark of bookmarks) {
    const entry = map.get(bookmark.postId.toString());
    if (entry) entry.bookmarked = true;
  }
  return map;
}

async function buildPage(
  ids: Types.ObjectId[],
  userId: string | undefined,
  nextCursor: string | null,
): Promise<FeedPage> {
  const posts = await hydrate(ids);
  const states = await viewerStates(ids, userId);
  return {
    items: posts.map((p) => serializePostCard(p, states.get(p._id.toString()))),
    nextCursor,
  };
}

async function rankedFeed(
  match: Record<string, unknown>,
  interestIds: Types.ObjectId[],
  followedIds: Types.ObjectId[],
  circleIds: Types.ObjectId[],
  creatorIds: Types.ObjectId[],
  cursor: string | undefined,
  userId?: string,
): Promise<FeedPage> {
  const offset = decodeCursor<RankedCursor>(cursor)?.offset ?? 0;
  if (offset >= MAX_RANKED_OFFSET) return { items: [], nextCursor: null };

  const results = await Post.aggregate<{ _id: Types.ObjectId }>([
    { $match: match },
    ...(scoreStages(interestIds, followedIds, circleIds, creatorIds) as PipelineStage.FacetPipelineStage[]),
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
  const creators = await User.find({ role: "creator" }).select("_id");
  return creators.map((u) => u._id);
}

export async function forYou(userId: string, cursor?: string): Promise<FeedPage> {
  const user = await User.findById(userId).select("interests");
  const interestIds = (user?.interests ?? []) as Types.ObjectId[];
  const [followedIds, circleIds, creatorIds] = await Promise.all([
    userService.getFollowedUserIds(userId),
    userService.getMembershipCircleIds(userId),
    getCreatorIds(),
  ]);

  const since = new Date(Date.now() - FOR_YOU_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const match = {
    status: "published",
    publishedAt: { $gte: since },
    $or: [
      { tags: { $in: interestIds } },
      { circleId: { $in: circleIds } },
      { authorId: { $in: followedIds } },
    ],
  };
  return rankedFeed(match, interestIds, followedIds, circleIds, creatorIds, cursor, userId);
}

export async function discover(
  options: { sort: "trending" | "new"; tagId?: Types.ObjectId; cursor?: string },
  userId?: string,
): Promise<FeedPage> {
  const base: Record<string, unknown> = { status: "published" };
  if (options.tagId) base.tags = options.tagId;

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

  // "new": keyset cursor on (publishedAt, _id)
  const decoded = decodeCursor<KeysetCursor>(options.cursor);
  const filter: Record<string, unknown> = { ...base, publishedAt: { $ne: null } };
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

export async function following(userId: string, cursor?: string): Promise<FeedPage> {
  const [followedIds, circleIds] = await Promise.all([
    userService.getFollowedUserIds(userId),
    userService.getMembershipCircleIds(userId),
  ]);
  const decoded = decodeCursor<KeysetCursor>(cursor);
  const filter: Record<string, unknown> = {
    status: "published",
    $or: [{ authorId: { $in: followedIds } }, { circleId: { $in: circleIds } }],
  };
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
