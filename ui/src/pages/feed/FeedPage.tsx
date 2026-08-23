import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AgentSearchBar } from "../../components/agent/AgentSearchBar";
import { MasonryFeed } from "../../components/MasonryFeed";
import { PostDrawer } from "../../components/PostDrawer";
import { CATEGORY_LABELS } from "../../lib/categoryTaxonomy";
import { useGetFeedDiscoverInfinite, useGetFeedForYouInfinite } from "../../lib/api/generated/feed/feed";
import { useAuth } from "../../lib/auth-context";
import type { AgentSearchFilters, PostCard } from "../../lib/api/generated/model";

export function FeedPage() {
  const { user } = useAuth();
  const location = useLocation();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [feedPath] = useState(() => location.pathname + location.search);
  const [agentFilters, setAgentFilters] = useState<AgentSearchFilters | null>(null);

  const forYou = useGetFeedForYouInfinite(undefined, {
    query: {
      enabled: !agentFilters,
      initialPageParam: undefined,
      getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    },
  });

  const agentResults = useGetFeedDiscoverInfinite(
    {
      sort: agentFilters?.sort ?? undefined,
      category: agentFilters?.category ?? undefined,
      subcategory: agentFilters?.subcategory ?? undefined,
      tag: agentFilters?.tag?.slug,
      country: agentFilters?.country ?? undefined,
      q: agentFilters?.q ?? undefined,
    },
    {
      query: {
        enabled: Boolean(agentFilters),
        initialPageParam: undefined,
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      },
    },
  );

  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = agentFilters
    ? agentResults
    : forYou;

  const posts = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="px-4 py-8 sm:px-6">
      <div className="mb-6">
        <AgentSearchBar onResult={setAgentFilters} />
      </div>

      {agentFilters ? (
        <div className="mb-6 flex flex-wrap items-center gap-2">
          {agentFilters.category && (
            <FilterChip label={CATEGORY_LABELS[agentFilters.category]} />
          )}
          {agentFilters.subcategory && <FilterChip label={agentFilters.subcategory} />}
          {agentFilters.tag && <FilterChip label={agentFilters.tag.name} />}
          {agentFilters.country && <FilterChip label={agentFilters.country} />}
          {agentFilters.q && <FilterChip label={`"${agentFilters.q}"`} />}
          <button
            type="button"
            onClick={() => setAgentFilters(null)}
            className="ml-1 text-sm font-semibold text-ink-soft underline hover:text-ink"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="mb-6 flex items-end justify-between">
          <div>
            <p className="kicker mb-1">For you</p>
            <h1 className="font-display-serif text-3xl font-semibold">
              {greeting()}, {user?.displayName.split(" ")[0]}
            </h1>
          </div>
          <Link
            to="/settings"
            className="hidden text-sm text-ink-soft hover:text-ink sm:block"
          >
            Tune your feed
          </Link>
        </div>
      )}
      <MasonryFeed
        posts={posts}
        isLoading={isLoading}
        hasNextPage={Boolean(hasNextPage)}
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={fetchNextPage}
        onOpenPost={(post: PostCard) => setSelectedSlug(post.slug)}
        emptyState={
          agentFilters ? (
            <div className="rounded-xl border border-dashed border-line p-12 text-center">
              <p className="font-display-serif text-2xl font-semibold">No matches</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
                Nothing fits that search yet. Try rephrasing, or clear it to go back to your
                feed.
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-line p-12 text-center">
              <p className="font-display-serif text-2xl font-semibold">
                Your feed is warming up
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm text-ink-soft">
                Posts matching your interests, circles, and follows land here. Explore
                Discover to find something great, or write the first post yourself.
              </p>
              <div className="mt-6 flex justify-center gap-3">
                <Link
                  to="/discover"
                  className="rounded-lg bg-crimson px-4 py-2 text-sm font-semibold text-ink-inverse hover:bg-crimson-deep"
                >
                  Explore Discover
                </Link>
                <Link
                  to="/compose"
                  className="rounded-lg border border-line bg-paper px-4 py-2 text-sm font-semibold text-ink hover:border-ink-soft"
                >
                  Write a post
                </Link>
              </div>
            </div>
          )
        }
      />
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

function FilterChip({ label }: { label: string }) {
  return (
    <span className="rounded-full border border-line bg-paper px-3 py-1 text-xs font-semibold text-ink-soft">
      {label}
    </span>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
