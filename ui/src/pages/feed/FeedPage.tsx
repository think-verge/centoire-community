import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
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
  { key: "editorial", label: "Editorial Picks" },
  { key: "must_reads", label: "Must Reads" },
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
  const location = useLocation();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [feedPath] = useState(() => location.pathname + location.search);
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
  const editorialPosts = editorialPicks.data?.items ?? [];
  const latestPosts = latestNews.data?.items ?? [];

  const allMoreKeys = MORE_TABS.map((t) => t.key);
  const activeMoreTab = allMoreKeys.includes(activeTab) ? activeTab : null;

  return (
    <div className="min-h-screen">
      {/* Tab bar */}
      <div className="sticky top-14 z-30 border-b border-[var(--color-hairline)] bg-white px-4 sm:px-6">
        <div className="flex items-center gap-1 overflow-x-auto py-2 scrollbar-none">
          {MAIN_TABS.map((tab) => (
            <TabButton
              key={tab.key}
              label={tab.label}
              active={activeTab === tab.key}
              onClick={() => { setActiveTab(tab.key); setMoreOpen(false); }}
            />
          ))}
          <div className="relative">
            <TabButton
              label={activeMoreTab ? (MORE_TABS.find((t) => t.key === activeMoreTab)?.label ?? "+4 More") : "+4 More"}
              active={Boolean(activeMoreTab)}
              onClick={() => setMoreOpen((o) => !o)}
            />
            {moreOpen && (
              <div className="absolute left-0 top-full z-40 mt-1 w-36 rounded-xl border border-[var(--color-hairline)] bg-white py-1 shadow-lg">
                {MORE_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => { setActiveTab(tab.key); setMoreOpen(false); }}
                    className={`block w-full px-4 py-2 text-left font-ui text-sm ${
                      activeTab === tab.key
                        ? "font-semibold text-[var(--color-coral)]"
                        : "text-[var(--color-stone)] hover:bg-[var(--color-sand)]"
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

      <div className="px-4 py-6 sm:px-6">
        {isAll ? (
          <>
            {/* Header */}
            <div className="mb-6">
              <p className="font-ui text-[11px] font-semibold uppercase tracking-widest text-[var(--color-taupe)]">
                For you
              </p>
              <h1 className="font-editorial mt-0.5 text-3xl italic text-[var(--color-charcoal)]">
                {greeting()}, {user?.displayName.split(" ")[0]}
              </h1>
            </div>

            {/* Editorial Picks section */}
            {(editorialPosts.length > 0 || editorialPicks.isLoading) && (
              <section className="mb-8">
                <SectionHeader label="Editorial Picks" to="/discover?sort=trending" />
                {editorialPicks.isLoading ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <SkeletonCard key={i} />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {editorialPosts.slice(0, 6).map((post) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        onOpenPost={(p) => setSelectedSlug(p.slug)}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Featured Jobs Banner */}
            <FeaturedBanner />

            {/* Latest News section */}
            {(latestPosts.length > 0 || latestNews.isLoading) && (
              <section className="mb-8">
                <SectionHeader label="Latest News" to="/discover?sort=new" />
                {latestNews.isLoading ? (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {Array.from({ length: 2 }).map((_, i) => (
                      <SkeletonCard key={i} tall />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {latestPosts.slice(0, 4).map((post) => (
                      <PostCard
                        key={post.id}
                        post={post}
                        onOpenPost={(p) => setSelectedSlug(p.slug)}
                      />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* For You infinite feed */}
            <SectionHeader label="Your Feed" to="/settings" linkLabel="Tune feed" />
            <MasonryFeed
              posts={posts}
              isLoading={isLoading}
              hasNextPage={Boolean(hasNextPage)}
              isFetchingNextPage={isFetchingNextPage}
              fetchNextPage={fetchNextPage}
              onOpenPost={(post: PostCardType) => setSelectedSlug(post.slug)}
              emptyState={<EmptyFeed />}
            />
          </>
        ) : (
          /* Non-All tabs: plain infinite scroll */
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

      {selectedSlug && (
        <PostDrawer
          slug={selectedSlug}
          feedPath={feedPath}
          onClose={() => setSelectedSlug(null)}
        />
      )}
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`shrink-0 rounded-full px-4 py-1.5 font-ui text-sm font-medium transition-colors ${
        active
          ? "bg-[var(--color-coral)] text-white"
          : "text-[var(--color-stone)] hover:bg-[var(--color-sand)] hover:text-[var(--color-charcoal)]"
      }`}
    >
      {label}
    </button>
  );
}

function SectionHeader({
  label,
  to,
  linkLabel = "VIEW ALL",
}: {
  label: string;
  to: string;
  linkLabel?: string;
}) {
  return (
    <div className="mb-4 flex items-center justify-between">
      <h2 className="font-editorial text-2xl italic text-[var(--color-charcoal)]">{label}</h2>
      <Link
        to={to}
        className="font-ui text-xs font-semibold text-[var(--color-coral)] hover:underline"
      >
        {linkLabel}
      </Link>
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

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
