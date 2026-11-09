import type { IPost } from "../models/Post.js";

interface PopulatedRef {
  _id: unknown;
  [key: string]: unknown;
}

function ref(value: unknown): PopulatedRef | null {
  if (value && typeof value === "object" && "_id" in value) return value as PopulatedRef;
  return null;
}

export interface ViewerState {
  voted: 1 | -1 | null;
  bookmarked: boolean;
  authorFollowed?: boolean;
  sourceFollowed?: boolean;
  reported?: boolean;
}

/** Card projection used in feeds, drafts, and lists. */
export function serializePostCard(post: IPost, viewer?: ViewerState) {
  const author = ref(post.authorId);
  const source = ref(post.sourceId);
  const circle = ref(post.circleId);
  return {
    id: post._id.toString(),
    slug: post.slug,
    origin: post.origin,
    status: post.status,
    curated: Boolean(post.curated),
    title: post.title,
    excerpt: post.excerpt,
    coverImageUrl: post.coverImageUrl ?? null,
    externalUrl: post.externalUrl ?? null,
    author: author
      ? {
          id: String(author._id),
          handle: (author.handle as string) ?? null,
          displayName: (author.displayName as string) ?? "",
          avatarUrl: (author.avatarUrl as string) ?? null,
          followerCount: typeof author.followerCount === "number" ? author.followerCount : 0,
        }
      : null,
    source: source
      ? {
          id: String(source._id),
          name: (source.name as string) ?? "",
          siteUrl: (source.siteUrl as string) ?? "",
          faviconUrl: (source.faviconUrl as string) ?? null,
        }
      : null,
    circle: circle
      ? {
          id: String(circle._id),
          name: (circle.name as string) ?? "",
          slug: (circle.slug as string) ?? "",
        }
      : null,
    category: post.category ?? null,
    subcategory: post.subcategory ?? null,
    hashtags: post.hashtags ?? [],
    upvoteCount: post.upvoteCount,
    commentCount: post.commentCount,
    bookmarkCount: post.bookmarkCount,
    readTimeMinutes: post.readTimeMinutes,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    updatedAt: post.updatedAt.toISOString(),
    viewer: viewer ?? { voted: null, bookmarked: false },
    authorIsCreator: (author?.role as string) === "creator" || (author?.role as string) === "admin",
    discovery: post.discovery
      ? {
          storyId: post.discovery.storyId,
          category: post.discovery.category ?? null,
          websiteCount: post.discovery.websiteCount,
          articleCount: post.discovery.articleCount,
          firstPublished: post.discovery.firstPublished
            ? {
                name: post.discovery.firstPublished.name,
                url: post.discovery.firstPublished.url ?? null,
                at: post.discovery.firstPublished.at.toISOString(),
              }
            : null,
          engineSawAt: post.discovery.engineSawAt?.toISOString() ?? null,
          spread: (post.discovery.spread ?? []).map((s) => ({
            name: s.name,
            url: s.url ?? null,
            firstAt: s.firstAt.toISOString(),
          })),
          markets: post.discovery.markets ?? [],
          momentum: post.discovery.momentum?.tag
            ? {
                tag: post.discovery.momentum.tag,
                reason: post.discovery.momentum.reason ?? "",
                computedAt: post.discovery.momentum.computedAt?.toISOString() ?? null,
              }
            : null,
        }
      : null,
  };
}

/** Full detail: card + rich content. */
export function serializePostDetail(
  post: IPost,
  viewer?: ViewerState,
  authorFollowedByViewer?: boolean,
) {
  return {
    ...serializePostCard(post, viewer),
    content: (post.content as Record<string, unknown>) ?? null,
    // External posts link out; any body stored by the old scraper is never served.
    contentHtml: post.origin === "aggregated" ? null : (post.contentHtml ?? null),
    viewCount: post.viewCount,
    rejectionReason: post.rejectionReason ?? null,
    authorFollowedByViewer: authorFollowedByViewer ?? false,
    aiSummary: post.aiSummary ?? null,
    clickbaitDetected: Boolean(post.clickbaitDetected),
  };
}
