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
}

/** Card projection used in feeds, drafts, and lists. */
export function serializePostCard(post: IPost, viewer?: ViewerState) {
  const author = ref(post.authorId);
  const source = ref(post.sourceId);
  const circle = ref(post.circleId);
  const tags = (post.tags as unknown[]).map(ref).filter(Boolean) as PopulatedRef[];
  return {
    id: post._id.toString(),
    slug: post.slug,
    origin: post.origin,
    status: post.status,
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
    tags: tags.map((t) => ({
      id: String(t._id),
      name: (t.name as string) ?? "",
      slug: (t.slug as string) ?? "",
    })),
    upvoteCount: post.upvoteCount,
    commentCount: post.commentCount,
    bookmarkCount: post.bookmarkCount,
    readTimeMinutes: post.readTimeMinutes,
    publishedAt: post.publishedAt?.toISOString() ?? null,
    updatedAt: post.updatedAt.toISOString(),
    viewer: viewer ?? { voted: null, bookmarked: false },
    authorIsCreator: (author?.role as string) === "creator",
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
    viewCount: post.viewCount,
    rejectionReason: post.rejectionReason ?? null,
    authorFollowedByViewer: authorFollowedByViewer ?? false,
    aiSummary: post.aiSummary ?? null,
    clickbaitDetected: Boolean(post.clickbaitDetected),
  };
}
