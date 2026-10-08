import { useState } from "react";
import { Link } from "react-router-dom";
import { MasonryFeed } from "../../components/MasonryFeed";
import { PostDrawer } from "../../components/PostDrawer";
import { PostCard } from "../../components/PostCard";
import { FeaturedBanner } from "../../components/FeaturedBanner";
import {
  useGetFeedDiscoverInfinite,
  useGetFeedDiscover,
  useGetFeedForYouInfinite,
} from "../../lib/api/generated/feed/feed";
import type { GetFeedDiscoverParams } from "../../lib/api/generated/model";
import { useAuth } from "../../lib/auth-context";
import type { PostCard as PostCardType } from "../../lib/api/generated/model";

type TabKey = "all" | "editorial" | "must_reads" | "latest" | "following" | "trending" | "fashion" | "art";

const MAIN_TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "editorial", label: "Centoire Picks" },
  { key: "latest", label: "Latest News" },
];

const MORE_TABS: { key: TabKey; label: string }[] = [
  { key: "following", label: "Following" },
  { key: "trending", label: "Trending" },
  { key: "fashion", label: "Fashion" },
  { key: "art", label: "Art" },
];

export function FeedPage() {
  const { user } = useAuth();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [moreOpen, setMoreOpen] = useState(false);

  const isAll = activeTab === "all";

  // Main "for you" infinite feed (used for "All" tab)
  const forYou = useGetFeedForYouInfinite(undefined, {
    query: {
      enabled: isAll,
      initialPageParam: undefined,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    },
  });

  // Discover with params for non-all tabs
  const discoverParams = tabToDiscoverParams(activeTab);
  const discoverInfinite = useGetFeedDiscoverInfinite(discoverParams, {
    query: {
      enabled: !isAll,
      initialPageParam: undefined,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    },
  });

  // Sectioned data for "All" tab — editorial picks (trending) and latest news
  const editorialPicks = useGetFeedDiscover(
    { sort: "trending" },
    { query: { enabled: isAll } },
  );
  const latestNews = useGetFeedDiscover(
    { sort: "new" },
    { query: { enabled: isAll } },
  );

  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = isAll
    ? forYou
    : discoverInfinite;

  const posts = data?.pages.flatMap((page) => page.items) ?? [];
  const rawEditorialPosts = editorialPicks.data?.items ?? [];
  const latestPosts = latestNews.data?.items ?? [];

  // Sort editorial posts so that posts with images appear first, then pad to 6 if needed
  const sortedRaw = [...rawEditorialPosts].sort((a, b) => {
    const aImg = Boolean(a.coverImageUrl);
    const bImg = Boolean(b.coverImageUrl);
    return aImg === bImg ? 0 : aImg ? -1 : 1;
  });
  const editorialPosts = sortedRaw.length > 0 
    ? [...sortedRaw, ...sortedRaw].slice(0, 6)
    : [];
    
  // Sort latest posts similarly just in case the images were down there
  const sortedLatest = [...latestPosts].sort((a, b) => {
    const aImg = Boolean(a.coverImageUrl);
    const bImg = Boolean(b.coverImageUrl);
    return aImg === bImg ? 0 : aImg ? -1 : 1;
  });

  const allMoreKeys = MORE_TABS.map((t) => t.key);
  const activeMoreTab = allMoreKeys.includes(activeTab) ? activeTab : null;

  return (
    <div className="min-h-screen flex flex-col w-full bg-[#EFEFEF]">
      <div className="w-full mx-auto">
        {/* Welcome header */}
        <div className="pt-6 pb-2 flex flex-col gap-1 px-4 sm:px-6">
          <h1 className="font-editorial text-[32px] font-normal leading-tight text-[#111111]">
            Welcome Back <span className="font-medium">{user?.displayName.split(" ")[0]},</span>
          </h1>
          <p className="font-ui text-[14px] text-[#111111] font-medium">
            Here's what's trending in fashion today
          </p>
        </div>

        {/* Tab bar — inline below the greeting */}
        <div className="px-4 sm:px-6 mt-4 mb-4">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 flex-wrap">
              {/* ALL Tab */}
              <button
                onClick={() => { setActiveTab("all"); setMoreOpen(false); }}
                className={`shrink-0 rounded-full px-4 py-[7px] font-ui text-[13px] leading-[17px] uppercase tracking-wider transition-colors border ${
                  activeTab === "all"
                    ? "border-[#E4572E] bg-[#E4572E] text-white font-bold"
                    : "border-[#111111]/20 bg-white text-black/60 hover:border-[#111111]/40 font-semibold"
                }`}
              >
                ALL
              </button>
              
              {/* Divider */}
              <div className="h-[24px] w-[1px] bg-[#D1D1D1] mx-1 shrink-0"></div>

              {/* Other Main Tabs */}
              {MAIN_TABS.filter((t) => t.key !== "all").map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => { setActiveTab(tab.key); setMoreOpen(false); }}
                  className={`shrink-0 rounded-full px-4 py-[7px] font-ui text-[13px] leading-[17px] uppercase tracking-wider transition-colors border ${
                    activeTab === tab.key
                      ? "border-[#E4572E] bg-[#E4572E] text-white font-bold"
                      : "border-[#111111]/20 bg-white text-black/60 hover:border-[#111111]/40 font-semibold"
                  }`}
                >
                  {tab.label}
                </button>
              ))}

              {/* +4 More Dropdown */}
              <div className="relative shrink-0">
                <button
                  onClick={() => setMoreOpen((o) => !o)}
                  className={`shrink-0 rounded-full px-4 py-[7px] font-ui text-[13px] leading-[17px] uppercase tracking-wider transition-colors border flex items-center gap-1.5 ${
                    activeMoreTab
                      ? "border-[#E4572E] bg-[#E4572E] text-white font-bold"
                      : "border-[#111111]/20 bg-white text-black/60 hover:border-[#111111]/40 font-semibold"
                  }`}
                >
                  {activeMoreTab ? (MORE_TABS.find((t) => t.key === activeMoreTab)?.label ?? "+4 More") : "+4 More"}
                  <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {moreOpen && (
                  <div className="absolute left-0 top-full z-40 mt-1 w-36 rounded-xl border border-[var(--color-hairline)] bg-white py-1 shadow-lg">
                    {MORE_TABS.map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => { setActiveTab(tab.key); setMoreOpen(false); }}
                        className={`block w-full px-4 py-2 text-left font-ui text-[12px] font-medium ${
                          activeTab === tab.key
                            ? "text-[#E4572E] bg-[#F0F0F0]"
                            : "text-[#737373] hover:bg-[#F0F0F0]"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <div className="hidden sm:flex items-center">
              <button className="shrink-0 rounded-full px-4 py-[7px] font-ui text-[13px] leading-[17px] font-semibold uppercase tracking-wider transition-colors border border-[#111111]/20 bg-white text-black/60 hover:border-[#111111]/40 flex items-center gap-1.5">
                FILTERS
                <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
              </button>
            </div>
          </div>
        </div>

        <div className="px-4 pt-4 sm:px-6">
          {isAll ? (
            <>
              {/* Latest News section (Moved to top as requested) */}
              {(latestPosts.length > 0 || latestNews.isLoading) && (
                <section className="mb-6">
                  {latestNews.isLoading ? (
                    <div className="grid gap-6 px-3 -mx-3 py-3 -my-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="flex flex-col h-full"><SkeletonCard tall /></div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid gap-6 px-3 -mx-3 py-3 -my-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
                      {sortedLatest.slice(0, 6).map((post, i) => (
                        <PostCard
                          key={`${post.id}-${i}`}
                          post={post}
                          onOpenPost={(p) => setSelectedSlug(p.slug)}
                        />
                      ))}
                    </div>
                  )}
                </section>
              )}
            </>
          ) : null}
        </div>
      </div>

      {isAll && (
        <>
          {/* Featured Jobs Banner - Full width */}
          <div className="w-full">
            <FeaturedBanner />
          </div>

          <div className="w-full mx-auto px-4 pt-6 pb-4 sm:px-6">
            {/* Editorial Picks section (Moved to bottom as requested) */}
            {(editorialPosts.length > 0 || editorialPicks.isLoading) && (
              <section className="mb-8">
                {editorialPicks.isLoading ? (
                  <div className="grid gap-6 px-3 -mx-3 py-3 -my-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="flex flex-col h-full"><SkeletonCard /></div>
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-6 px-3 -mx-3 py-3 -my-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
                    {editorialPosts.map((post, i) => (
                      <PostCard
                        key={`${post.id}-${i}`}
                        post={post}
                        onOpenPost={(p) => setSelectedSlug(p.slug)}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        </>
      )}

      {!isAll && (
        <div className="w-full mx-auto px-4 py-4 sm:px-6">
          {/* Non-All tabs: plain infinite scroll */}
          <MasonryFeed
            posts={posts}
            isLoading={isLoading}
            hasNextPage={Boolean(hasNextPage)}
            isFetchingNextPage={isFetchingNextPage}
            fetchNextPage={fetchNextPage}
            onOpenPost={(post: PostCardType) => setSelectedSlug(post.slug)}
            emptyState={<EmptyFeed />}
          />
        </div>
      )}

      {selectedSlug && (
        <PostDrawer
          slug={selectedSlug}
          onClose={() => setSelectedSlug(null)}
        />
      )}
    </div>
  );
}



function SkeletonCard({ tall }: { tall?: boolean }) {
  return (
    <div className={`animate-pulse rounded-xl bg-[var(--color-sand)] ${tall ? "h-72" : "h-56"}`} />
  );
}

function EmptyFeed() {
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-hairline)] p-12 text-center">
      <p className="font-editorial text-2xl italic text-[var(--color-charcoal)]">
        Your feed is warming up
      </p>
      <p className="mx-auto mt-2 max-w-md font-ui text-sm text-[var(--color-stone)]">
        Posts matching your interests, circles, and follows land here. Explore Discover to find
        something great.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link
          to="/discover"
          className="rounded-lg bg-[var(--color-coral)] px-4 py-2 font-ui text-sm font-semibold text-white hover:opacity-90"
        >
          Explore Discover
        </Link>
        <Link
          to="/compose"
          className="rounded-lg border border-[var(--color-hairline)] bg-white px-4 py-2 font-ui text-sm font-semibold text-[var(--color-charcoal)] hover:border-[var(--color-stone)]"
        >
          Write a post
        </Link>
      </div>
    </div>
  );
}

function tabToDiscoverParams(tab: TabKey): GetFeedDiscoverParams {
  switch (tab) {
    case "editorial":
      return { sort: "trending" };
    case "must_reads":
      return { sort: "trending" };
    case "latest":
      return { sort: "new" };
    case "trending":
      return { sort: "trending" };
    case "fashion":
      return { category: "fashion" };
    case "art":
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return { category: "art" as any };
    default:
      return {};
  }
}


