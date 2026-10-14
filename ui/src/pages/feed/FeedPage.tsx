import { useState, useRef, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { MasonryFeed } from "../../components/MasonryFeed";
import { PostDrawer } from "../../components/PostDrawer";
import { PostCard } from "../../components/PostCard";
import { FeaturedBanner } from "../../components/FeaturedBanner";
import {
  useGetFeedDiscoverInfinite,
  useGetFeedFollowingInfinite,
} from "../../lib/api/generated/feed/feed";
import type { GetFeedDiscoverParams } from "../../lib/api/generated/model";
import { useAuth } from "../../lib/auth-context";
import type { PostCard as PostCardType } from "../../lib/api/generated/model";

type TabKey = "all" | "editorial" | "must_reads" | "following" | "trending" | "fashion" | "art";

const MAIN_TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "editorial", label: "Centoire Picks" },
  { key: "must_reads", label: "Must Reads" },
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
  const sentinelRef = useRef<HTMLDivElement>(null);
  const topContainerRef = useRef<HTMLDivElement>(null);
  const [columns, setColumns] = useState(() => {
    if (typeof window !== "undefined") {
      const minCardWidth = 240;
      const gap = 24;
      const estimatedWidth = Math.max(300, window.innerWidth - 460);
      return Math.max(1, Math.floor((estimatedWidth + gap) / (minCardWidth + gap)));
    }
    return 6;
  });

  const isAll = activeTab === "all";
  const isFollowingTab = activeTab === "following";

  // Persistent ResizeObserver on the top container so column count is always exact
  useEffect(() => {
    const el = topContainerRef.current;
    if (!el || !isAll) return;

    const updateColumns = () => {
      const width = el.clientWidth;
      if (width > 0) {
        const minCardWidth = 240;
        const gap = 24;
        const cols = Math.max(1, Math.floor((width + gap) / (minCardWidth + gap)));
        setColumns(cols);
      }
    };

    updateColumns();
    const ro = new ResizeObserver(updateColumns);
    ro.observe(el);
    window.addEventListener("resize", updateColumns);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateColumns);
    };
  }, [isAll]);

  // Discover feed params for respective tab
  const discoverParams = tabToDiscoverParams(activeTab);

  const discoverQuery = useGetFeedDiscoverInfinite(discoverParams, {
    query: {
      enabled: !isFollowingTab,
      initialPageParam: undefined,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    },
  });

  const followingQuery = useGetFeedFollowingInfinite(undefined, {
    query: {
      enabled: isFollowingTab && Boolean(user),
      initialPageParam: undefined,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    },
  });

  const currentQuery = isFollowingTab ? followingQuery : discoverQuery;
  const {
    data,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  } = currentQuery;

  const posts = useMemo(() => {
    const raw = data?.pages.flatMap((page) => page.items) ?? [];
    const seen = new Set<string>();
    return raw.filter((p) => {
      if (seen.has(p.id)) return false;
      seen.add(p.id);
      return true;
    });
  }, [data?.pages]);

  // Top section displays 2 complete full rows so every row goes all the way till the end
  const topRows = 2;
  const topCount = Math.max(columns * topRows, columns);
  const topPosts = posts.slice(0, topCount);
  const remainingPosts = posts.slice(topCount);

  // Automatically fetch more if initial page doesn't have enough to fill both top and remaining
  useEffect(() => {
    if (isAll && posts.length < topCount + columns && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [isAll, posts.length, topCount, columns, hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Setup intersection observer for infinite scroll in All tab
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !isAll) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { rootMargin: "600px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, isAll]);

  const allMoreKeys = MORE_TABS.map((t) => t.key);
  const activeMoreTab = allMoreKeys.includes(activeTab) ? activeTab : null;

  // Exact pill sizing & styling matching SearchPage
  const pillBase =
    "rounded-full border px-3 py-[5px] sm:px-4 sm:py-[7px] font-ui text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] uppercase tracking-normal transition-colors shrink-0 whitespace-nowrap cursor-pointer";
  const pillIdle = "bg-white border-[#111111]/20 text-black/60 hover:border-[#111111]/60 font-semibold";
  const pillActive = "bg-[#E4572E] border-[#E4572E] text-white font-bold";

  return (
    <div className="min-h-screen flex flex-col w-full bg-[#EFEFEF]">
      <div className="w-full mx-auto">
        {/* Welcome header */}
        <div className="pt-6 pb-2 flex flex-col gap-1 px-4 sm:px-6">
          <h1 className="font-editorial text-[32px] font-normal leading-tight text-[#111111]">
            Welcome Back <span className="font-semibold text-[#000000]">{user?.displayName ? user.displayName.split(" ")[0] : "Centoire"},</span>
          </h1>
          <p className="font-ui text-[14px] text-[#111111] font-medium">
            Here's what's trending in fashion today
          </p>
        </div>

        {/* Tab bar — exact search page matching, with filter pill removed */}
        <div className="px-4 sm:px-6 mt-4 mb-4">
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2 flex-wrap">
              {/* ALL Tab */}
              <button
                type="button"
                onClick={() => { setActiveTab("all"); setMoreOpen(false); }}
                className={`${pillBase} ${activeTab === "all" ? pillActive : pillIdle}`}
              >
                ALL
              </button>
              
              {/* Divider matching SearchPage */}
              <div className="h-[34px] w-px bg-[#C4C4C4] shrink-0"></div>

              {/* Other Main Tabs */}
              {MAIN_TABS.filter((t) => t.key !== "all").map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => { setActiveTab(tab.key); setMoreOpen(false); }}
                  className={`${pillBase} ${activeTab === tab.key ? pillActive : pillIdle}`}
                >
                  {tab.label}
                </button>
              ))}

              {/* +4 More Dropdown */}
              <div className="relative shrink-0">
                <button
                  type="button"
                  onClick={() => setMoreOpen((o) => !o)}
                  className={`${pillBase} ${activeMoreTab ? pillActive : pillIdle} flex items-center gap-1.5`}
                >
                  {activeMoreTab ? (MORE_TABS.find((t) => t.key === activeMoreTab)?.label ?? "+4 MORE") : "+4 MORE"}
                  <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                </button>
                {moreOpen && (
                  <div className="absolute left-0 top-full z-40 mt-1 w-36 rounded-xl border border-[var(--color-hairline)] bg-white py-1 shadow-lg">
                    {MORE_TABS.map((tab) => (
                      <button
                        key={tab.key}
                        type="button"
                        onClick={() => { setActiveTab(tab.key); setMoreOpen(false); }}
                        className={`block w-full px-4 py-2 text-left font-ui text-[12px] font-medium cursor-pointer ${
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
          </div>
        </div>

        {/* Top Posts Section for ALL tab */}
        <div ref={topContainerRef} className="px-4 pt-4 sm:px-6">
          {isAll ? (
            <>
              {isLoading ? (
                <div className="grid gap-6 px-3 -mx-3 py-3 -my-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
                  {Array.from({ length: topCount }).map((_, i) => (
                    <div key={i} className="flex flex-col h-full"><SkeletonCard tall /></div>
                  ))}
                </div>
              ) : topPosts.length > 0 ? (
                <section className="mb-6">
                  <div className="grid gap-6 px-3 -mx-3 py-3 -my-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
                    {topPosts.map((post) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        onOpenPost={(p) => setSelectedSlug(p.slug)}
                      />
                    ))}
                  </div>
                </section>
              ) : null}
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

          {/* Remaining Posts Section (shows every remaining card from backend) */}
          <div className="w-full mx-auto px-4 pt-6 pb-4 sm:px-6">
            {remainingPosts.length > 0 ? (
              <section className="mb-8">
                <div className="grid gap-6 px-3 -mx-3 py-3 -my-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
                  {remainingPosts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      onOpenPost={(p) => setSelectedSlug(p.slug)}
                    />
                  ))}
                  {isFetchingNextPage &&
                    Array.from({ length: 4 }).map((_, i) => (
                      <div key={`remaining-skeleton-${i}`} className="flex flex-col h-full"><SkeletonCard /></div>
                    ))}
                </div>
                <div ref={sentinelRef} aria-hidden />
                {!hasNextPage && (
                  <p className="py-6 text-center text-sm font-ui text-[#737373]">You're all caught up.</p>
                )}
              </section>
            ) : isFetchingNextPage ? (
              <div className="grid gap-6 px-3 -mx-3 py-3 -my-3" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={`loading-skeleton-${i}`} className="flex flex-col h-full"><SkeletonCard /></div>
                ))}
              </div>
            ) : posts.length === 0 && !isLoading ? (
              <EmptyFeed />
            ) : null}
          </div>
        </>
      )}

      {/* Non-All tabs: plain infinite scroll */}
      {!isAll && (
        <div className="w-full mx-auto px-4 py-4 sm:px-6">
          {isFollowingTab && !user ? (
            <FollowingLoggedOut />
          ) : (
            <MasonryFeed
              posts={posts}
              isLoading={isLoading}
              hasNextPage={Boolean(hasNextPage)}
              isFetchingNextPage={isFetchingNextPage}
              fetchNextPage={fetchNextPage}
              onOpenPost={(post: PostCardType) => setSelectedSlug(post.slug)}
              emptyState={<EmptyFeed />}
            />
          )}
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

function FollowingLoggedOut() {
  return (
    <div className="rounded-xl border border-dashed border-[var(--color-hairline)] p-12 text-center bg-white">
      <p className="font-editorial text-2xl italic text-[var(--color-charcoal)]">
        Follow your favorite creators & circles
      </p>
      <p className="mx-auto mt-2 max-w-md font-ui text-sm text-[var(--color-stone)]">
        Sign in to personalize your feed with updates from people and circles you follow.
      </p>
      <div className="mt-6 flex justify-center gap-3">
        <Link
          to="/login"
          className="rounded-lg bg-[#E4572E] px-5 py-2 font-ui text-sm font-semibold text-white hover:opacity-90"
        >
          Sign In
        </Link>
      </div>
    </div>
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
      return { origin: "native", sort: "trending" };
    case "must_reads":
      return { sort: "new" };
    case "trending":
      return { sort: "trending" };
    case "fashion":
      return { category: "fashion" };
    case "art":
      return { category: "art" };
    default:
      return { sort: "trending" };
  }
}


