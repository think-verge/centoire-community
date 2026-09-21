import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useListTags } from "../../lib/api/generated/tags/tags";
import { useGetFeedDiscover } from "../../lib/api/generated/feed/feed";
import { useFollowUser, useUnfollowUser } from "../../lib/api/generated/users/users";
import { apiClient } from "../../lib/api/http";
import type { ListTagsCategory } from "../../lib/api/generated/model";
import { AvatarBubble } from "../AppShell";

export type RightSidebarContext =
  | { type: "feed" }
  | { type: "following" }
  | { type: "discover" }
  | { type: "category"; category: string };

// Category → tag category mapping for Trending Topics
const CATEGORY_TAG_FILTER: Record<string, ListTagsCategory> = {
  fashion: "style",
  lifestyle: "style",
  art: "culture",
  beauty: "style",
  ai_technology: "business",
  business_intelligence: "business",
};

const CATEGORY_LABELS: Record<string, string> = {
  fashion: "Fashion",
  art: "Art",
  lifestyle: "Lifestyle",
  beauty: "Beauty",
};

type FeaturedUser = {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  role: string;
  followerCount: number;
  isFollowing: boolean;
};

function useFeaturedUsers() {
  return useQuery<FeaturedUser[]>({
    queryKey: ["users", "featured"],
    queryFn: () => apiClient.get("/users/featured?limit=3").then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

// ── Component ──────────────────────────────────────────────────────────────

export function RightSidebar({ context }: { context: RightSidebarContext }) {
  const isCategory = context.type === "category";
  const category = isCategory ? context.category : undefined;
  const categoryLabel = category ? (CATEGORY_LABELS[category] ?? category) : undefined;

  const tagFilter = category ? CATEGORY_TAG_FILTER[category] : undefined;
  const { data: tags = [] } = useListTags(
    tagFilter ? { category: tagFilter } : undefined,
    { query: {} },
  );

  const { data: latestPostsData } = useGetFeedDiscover({ sort: "trending" });
  const latestPosts = latestPostsData?.items?.slice(0, 3) ?? [];

  const { data: featuredUsers = [], refetch: refetchCreators } = useFeaturedUsers();

  const followMutation = useFollowUser({
    mutation: { onSuccess: () => refetchCreators() },
  });
  const unfollowMutation = useUnfollowUser({
    mutation: { onSuccess: () => refetchCreators() },
  });

  return (
    <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-72 shrink-0 flex-col gap-6 overflow-y-auto border-l border-[var(--color-hairline)] bg-white px-5 py-5 xl:flex">

      {/* Category context header */}
      {isCategory && categoryLabel && (
        <>
          <section>
            <p className="font-ui text-[10px] font-semibold uppercase tracking-widest text-[var(--color-taupe)]">
              Browsing
            </p>
            <h2 className="font-editorial mt-1 text-2xl italic text-[var(--color-charcoal)]">
              {categoryLabel}
            </h2>
            <Link
              to={`/category/${category}`}
              className="mt-1 inline-block font-ui text-xs text-[var(--color-coral)] hover:underline"
            >
              See all {categoryLabel} →
            </Link>
          </section>
          <div className="h-px bg-[var(--color-hairline)]" />
        </>
      )}

      {/* Latest Posts — only on feed/discover/following */}
      {!isCategory && (
        <>
          <section>
            <div className="mb-3 flex items-center justify-between">
              <p className="font-ui text-[10px] font-semibold uppercase tracking-widest text-[var(--color-taupe)]">
                Latest Posts
              </p>
              <Link
                to="/discover"
                className="font-ui text-[10px] font-semibold text-[var(--color-coral)] hover:underline"
              >
                VIEW ALL
              </Link>
            </div>
            <ul className="flex flex-col gap-3">
              {latestPosts.length > 0
                ? latestPosts.map((post) => (
                    <li key={post.id}>
                      <Link to={post.externalUrl ?? `/p/${post.slug}`} className="group flex gap-2.5">
                        {post.coverImageUrl ? (
                          <img
                            src={post.coverImageUrl}
                            alt=""
                            className="h-10 w-12 shrink-0 rounded object-cover"
                          />
                        ) : (
                          <div className="h-10 w-12 shrink-0 rounded bg-[var(--color-sand)]" />
                        )}
                        <div className="min-w-0">
                          <p className="line-clamp-2 text-sm font-medium leading-snug text-[var(--color-charcoal)] group-hover:text-[var(--color-coral)]">
                            {post.title}
                          </p>
                          <p className="mt-0.5 font-ui text-[11px] text-[var(--color-taupe)]">
                            {post.author?.displayName} · {post.readTimeMinutes} min
                          </p>
                        </div>
                      </Link>
                    </li>
                  ))
                : /* skeleton */
                  [0, 1, 2].map((i) => (
                    <li key={i} className="flex gap-2.5">
                      <div className="h-10 w-12 shrink-0 animate-pulse rounded bg-[var(--color-sand)]" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 animate-pulse rounded bg-[var(--color-sand)]" />
                        <div className="h-3 w-2/3 animate-pulse rounded bg-[var(--color-sand)]" />
                      </div>
                    </li>
                  ))}
            </ul>
          </section>
          <div className="h-px bg-[var(--color-hairline)]" />
        </>
      )}

      {/* Trending Topics */}
      <section>
        <p className="mb-3 font-ui text-[10px] font-semibold uppercase tracking-widest text-[var(--color-taupe)]">
          {isCategory && categoryLabel ? `Trending in ${categoryLabel}` : "Trending Topics"}
        </p>
        {(tags as { id: string; slug: string; name: string }[]).length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {(tags as { id: string; slug: string; name: string }[]).slice(0, 12).map((tag, i) => (
              <Link
                key={tag.id}
                to={`/t/${tag.slug}`}
                className={`rounded-full border px-3 py-1 font-ui text-[11px] transition-colors ${
                  i === 0
                    ? "border-[var(--color-coral)] bg-[var(--color-coral)] text-white"
                    : "border-[var(--color-hairline)] text-[var(--color-stone)] hover:border-[var(--color-coral)] hover:text-[var(--color-coral)]"
                }`}
              >
                #{tag.name}
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {["StreetStyle", "FashionWeek", "Minimalist", "Accessories", "Denim", "Luxury"].map(
              (name, i) => (
                <span
                  key={name}
                  className={`rounded-full border px-3 py-1 font-ui text-[11px] ${
                    i === 0
                      ? "border-[var(--color-coral)] bg-[var(--color-coral)] text-white"
                      : "border-[var(--color-hairline)] text-[var(--color-stone)]"
                  }`}
                >
                  #{name}
                </span>
              ),
            )}
          </div>
        )}
      </section>

      <div className="h-px bg-[var(--color-hairline)]" />

      {/* Top Creators */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <p className="font-ui text-[10px] font-semibold uppercase tracking-widest text-[var(--color-taupe)]">
            {isCategory && categoryLabel ? `Creators in ${categoryLabel}` : "Top Creators"}
          </p>
          <Link
            to="/discover"
            className="font-ui text-[10px] font-semibold text-[var(--color-coral)] hover:underline"
          >
            VIEW ALL
          </Link>
        </div>
        <ul className="flex flex-col gap-3">
          {featuredUsers.map((creator) => (
            <li key={creator.id} className="flex items-center gap-2.5">
              <AvatarBubble name={creator.displayName} url={creator.avatarUrl} size="size-8" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--color-charcoal)]">
                  {creator.displayName}
                </p>
                <p className="font-ui text-[11px] capitalize text-[var(--color-taupe)]">{creator.role}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (creator.isFollowing) {
                    unfollowMutation.mutate({ id: creator.id });
                  } else {
                    followMutation.mutate({ id: creator.id });
                  }
                }}
                className={`shrink-0 rounded-full border px-2.5 py-0.5 font-ui text-[11px] font-semibold transition-colors ${
                  creator.isFollowing
                    ? "border-[var(--color-hairline)] text-[var(--color-stone)] hover:border-red-300 hover:text-red-500"
                    : "border-[var(--color-coral)] text-[var(--color-coral)] hover:bg-[var(--color-coral)] hover:text-white"
                }`}
              >
                {creator.isFollowing ? "Following" : "Follow"}
              </button>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
