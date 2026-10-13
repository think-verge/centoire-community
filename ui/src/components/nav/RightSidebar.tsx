import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useListTags } from "../../lib/api/generated/tags/tags";
import { useGetFeedDiscover } from "../../lib/api/generated/feed/feed";
import { useFollowUser, useUnfollowUser } from "../../lib/api/generated/users/users";
import { apiClient } from "../../lib/api/http";
import type { ListTagsCategory } from "../../lib/api/generated/model";

export type RightSidebarContext =
  | { type: "feed" }
  | { type: "following" }
  | { type: "discover" }
  | { type: "search" }
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

const FIGMA_TAG_ORDER = [
  "StreetStyle",
  "FashionWeek",
  "Minimalist",
  "Accessories",
  "Denim",
  "Resort Wear",
  "Athleisure",
  "Luxury",
  "Boho Chic",
  "Tailoring",
  "Vintage",
  "Sustainability",
];

type FeaturedUser = {
  id: string;
  displayName: string;
  handle: string;
  avatarUrl: string | null;
  bio: string | null;
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

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, "&")
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function formatTagName(name: string): string {
  return name.replace(/([a-z])([A-Z])/g, "$1 $2");
}

function getCreatorHeadline(creator: FeaturedUser): string {
  if (creator.bio && creator.bio.trim()) {
    return creator.bio.trim();
  }
  if (creator.role === "creator") return "Fashion Creator";
  if (creator.role === "editor") return "Fashion Editor";
  if (creator.role === "admin") return "Editorial Team";
  return "Style Contributor";
}

function getInitials(name?: string): string {
  if (!name || !name.trim()) return "E";
  return name.trim().charAt(0).toUpperCase();
}

// ── Component ──────────────────────────────────────────────────────────────

export function RightSidebar({ context }: { context: RightSidebarContext }) {
  const location = useLocation();
  const queryClient = useQueryClient();
  const isCategory = context.type === "category";
  const category = isCategory ? context.category : undefined;
  const categoryLabel = category ? (CATEGORY_LABELS[category] ?? category) : undefined;

  const tagFilter = category ? CATEGORY_TAG_FILTER[category] : undefined;
  const { data: rawTags = [], isLoading: isLoadingTags } = useListTags(
    tagFilter ? { category: tagFilter } : undefined,
    { query: {} },
  );

  const { data: latestPostsData, isLoading: isLoadingPosts } = useGetFeedDiscover({ sort: "new" });
  const latestPosts = latestPostsData?.items?.slice(0, 3) ?? [];

  const { data: featuredUsers = [], isLoading: isLoadingUsers } = useFeaturedUsers();

  const [activeTagId, setActiveTagId] = useState<string | null>(null);
  const [followingMap, setFollowingMap] = useState<Record<string, boolean>>({});

  const followMutation = useFollowUser({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ["users", "featured"] });
      },
      onError: (_err, variables) => {
        setFollowingMap((prev) => ({ ...prev, [variables.id]: false }));
      },
    },
  });

  const unfollowMutation = useUnfollowUser({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ["users", "featured"] });
      },
      onError: (_err, variables) => {
        setFollowingMap((prev) => ({ ...prev, [variables.id]: true }));
      },
    },
  });

  const handleToggleFollow = (creator: FeaturedUser) => {
    const currentFollowing = followingMap[creator.id] ?? creator.isFollowing;
    const nextFollowing = !currentFollowing;

    // Immediate optimistic update
    setFollowingMap((prev) => ({ ...prev, [creator.id]: nextFollowing }));

    if (nextFollowing) {
      followMutation.mutate({ id: creator.id });
    } else {
      unfollowMutation.mutate({ id: creator.id });
    }
  };

  // Sort tags prioritizing standard fashion tags matching Figma order
  const displayTags = [...(rawTags as { id: string; slug: string; name: string }[])]
    .sort((a, b) => {
      const idxA = FIGMA_TAG_ORDER.indexOf(a.name);
      const idxB = FIGMA_TAG_ORDER.indexOf(b.name);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return 0;
    })
    .slice(0, 10);

  // Sync active tag with current /t/:slug URL pathname if present, otherwise activeTagId, otherwise first tag
  const tagSlugFromUrl = location.pathname.match(/^\/t\/([^/]+)$/)?.[1];
  const matchedTagFromUrl = tagSlugFromUrl
    ? displayTags.find((t) => t.slug === tagSlugFromUrl)?.id
    : undefined;
  const currentActiveTagId = activeTagId ?? matchedTagFromUrl ?? displayTags[0]?.id;

  return (
    <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-[280px] shrink-0 flex-col gap-4 overflow-y-auto border-l border-[#D4D4D4] bg-white p-5 xl:flex">

      {/* Category context header if in category view */}
      {isCategory && categoryLabel && (
        <>
          <section className="flex flex-col gap-1">
            <p className="font-ui text-[14px] font-semibold uppercase tracking-wider text-[#737373]">
              BROWSING
            </p>
            <h2 className="font-editorial text-2xl italic text-[#111111]">
              {categoryLabel}
            </h2>
            <Link
              to={`/category/${category}`}
              className="mt-1 inline-block font-ui text-xs text-[#E5552D] hover:underline"
            >
              See all {categoryLabel} →
            </Link>
          </section>
          <div className="h-px w-full bg-[#D4D4D4]" />
        </>
      )}

      {/* Section 1: LATEST POSTS */}
      <section className="flex flex-col gap-4">
        <h3 className="font-ui text-[14px] font-semibold uppercase tracking-wider text-[#737373]">
          LATEST POSTS
        </h3>
        <ul className="flex flex-col gap-3.5">
          {isLoadingPosts
            ? [0, 1, 2].map((i) => (
                <li key={i} className="flex items-start gap-3">
                  <div className="h-[48px] w-[44px] shrink-0 animate-pulse rounded-[8px] bg-[#F5F5F5]" />
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="h-[34px] w-full animate-pulse rounded bg-[#F5F5F5]" />
                    <div className="h-2.5 w-2/3 animate-pulse rounded bg-[#F5F5F5]" />
                  </div>
                </li>
              ))
            : latestPosts.map((post) => {
                const bylineAuthor = post.author?.displayName || post.source?.name || "Centoire";
                return (
                  <li key={post.id}>
                    <Link
                      to={post.externalUrl || `/p/${post.slug}`}
                      target={post.externalUrl ? "_blank" : undefined}
                      rel={post.externalUrl ? "noopener noreferrer" : undefined}
                      className="group flex items-start gap-3"
                    >
                      {post.coverImageUrl ? (
                        <img
                          src={post.coverImageUrl}
                          alt=""
                          className="h-[48px] w-[44px] shrink-0 rounded-[8px] object-cover bg-[#F5F5F5]"
                          onError={(e) => {
                            (e.currentTarget as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="flex h-[48px] w-[44px] shrink-0 items-center justify-center rounded-[8px] bg-[#F5F5F5] text-[#A3A3A3]">
                          <svg
                            className="size-4 opacity-40"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                            <circle cx="9" cy="9" r="2" />
                            <path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21" />
                          </svg>
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <h4 className="h-[34px] min-h-[34px] line-clamp-2 font-ui text-[12.5px] font-medium leading-[17px] text-[#111111] transition-colors group-hover:text-[#E5552D]">
                          {decodeHtmlEntities(post.title)}
                        </h4>
                        <p className="mt-1 font-ui text-[11px] leading-none text-[#737373]">
                          By {bylineAuthor} • {post.readTimeMinutes || 1} min
                        </p>
                      </div>
                    </Link>
                  </li>
                );
              })}
        </ul>
      </section>

      {/* Divider */}
      <div className="h-px w-full bg-[#D4D4D4]" />

      {/* Section 2: TRENDING TOPICS */}
      <section className="flex flex-col gap-4">
        <h3 className="font-ui text-[14px] font-semibold uppercase tracking-wider text-[#737373]">
          TRENDING TOPICS
        </h3>
        <div className="flex flex-wrap gap-2">
          {isLoadingTags
            ? [0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-6 w-16 animate-pulse rounded-full bg-[#F5F5F5]"
                />
              ))
            : displayTags.map((tag) => {
                const isActive = currentActiveTagId === tag.id;
                return (
                  <Link
                    key={tag.id}
                    to={`/t/${tag.slug}`}
                    onClick={() => setActiveTagId(tag.id)}
                    className={`rounded-full px-2.5 py-1 font-ui text-[11px] font-medium transition-colors ${
                      isActive
                        ? "border border-[#E5552D] bg-[#E5552D] text-white hover:bg-[#d44820]"
                        : "border border-[#D4D4D4] bg-white text-[#111111] hover:border-[#111111] hover:text-[#111111]"
                    }`}
                  >
                    #{formatTagName(tag.name)}
                  </Link>
                );
              })}
        </div>
      </section>

      {/* Divider */}
      <div className="h-px w-full bg-[#D4D4D4]" />

      {/* Section 3: TOP VOICES */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between leading-none">
          <h3 className="font-ui text-[14px] font-semibold uppercase tracking-wider text-[#737373]">
            TOP VOICES
          </h3>
          <Link
            to="/search?type=people"
            className="font-ui text-[12px] font-medium uppercase tracking-wider text-[#737373] underline decoration-[#999999] underline-offset-[2px] transition-colors hover:text-[#111111] hover:decoration-[#111111]"
          >
            VIEW ALL
          </Link>
        </div>
        <div className="flex flex-col">
          {isLoadingUsers
            ? [0, 1, 2].map((i) => (
                <div key={i} className="flex flex-col">
                  <div className="flex items-center justify-between gap-2.5">
                    <div className="flex min-w-0 flex-1 items-center gap-2.5">
                      <div className="size-9 shrink-0 animate-pulse rounded-full bg-[#F5F5F5]" />
                      <div className="flex-1 space-y-1.5">
                        <div className="h-3 w-20 animate-pulse rounded bg-[#F5F5F5]" />
                        <div className="h-2.5 w-14 animate-pulse rounded bg-[#F5F5F5]" />
                      </div>
                    </div>
                    <div className="h-[26px] w-16 animate-pulse rounded-full bg-[#F5F5F5]" />
                  </div>
                  {i < 2 && (
                    <svg
                      className="my-4 h-px w-full shrink-0 overflow-visible"
                      viewBox="0 0 240 1"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <line
                        x1="0"
                        y1="0.5"
                        x2="240"
                        y2="0.5"
                        stroke="rgba(17, 17, 17, 0.2)"
                        strokeWidth="1"
                        strokeDasharray="6 6"
                      />
                    </svg>
                  )}
                </div>
              ))
            : featuredUsers.map((creator, idx) => {
                const isFollowing = followingMap[creator.id] ?? creator.isFollowing;
                return (
                  <div key={creator.id} className="flex flex-col">
                    <div className="flex items-center justify-between gap-2.5">
                      <div className="flex min-w-0 flex-1 items-center gap-2.5">
                        <Link
                          to={creator.handle ? `/u/${creator.handle}` : "#"}
                          className="shrink-0"
                        >
                          {creator.avatarUrl ? (
                            <img
                              src={creator.avatarUrl}
                              alt={creator.displayName}
                              className="size-9 shrink-0 rounded-full object-cover bg-[#F5F5F5]"
                            />
                          ) : (
                            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#3A76C4] font-ui text-xs font-semibold text-white">
                              {getInitials(creator.displayName)}
                            </div>
                          )}
                        </Link>
                        <div className="min-w-0 flex-1">
                          <Link
                            to={creator.handle ? `/u/${creator.handle}` : "#"}
                            className="block truncate font-ui text-[13px] font-semibold leading-tight text-[#111111] hover:underline"
                          >
                            {creator.displayName}
                          </Link>
                          <p className="mt-0.5 truncate font-ui text-[12px] leading-normal pb-0.5 text-[#737373]">
                            {getCreatorHeadline(creator)}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleToggleFollow(creator)}
                        className={`h-[22px] min-w-[58px] shrink-0 rounded-full px-3 py-0 font-ui text-[11px] font-medium transition-all flex items-center justify-center leading-none ${
                          isFollowing
                            ? "border border-[#111111] bg-[#111111] text-white hover:bg-black/85"
                            : "border border-[#CCCCCC] bg-white text-[#111111] hover:border-[#111111] hover:bg-neutral-50"
                        }`}
                      >
                        {isFollowing ? "Following" : "Follow"}
                      </button>
                    </div>

                    {/* Dashed divider between creators matching Figma 6,6 dashed line and 16px spacing */}
                    {idx < featuredUsers.length - 1 && (
                      <svg
                        className="my-4 h-px w-full shrink-0 overflow-visible"
                        viewBox="0 0 240 1"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <line
                          x1="0"
                          y1="0.5"
                          x2="240"
                          y2="0.5"
                          stroke="rgba(17, 17, 17, 0.2)"
                          strokeWidth="1"
                          strokeDasharray="6 6"
                        />
                      </svg>
                    )}
                  </div>
                );
              })}
        </div>
      </section>
    </aside>
  );
}
