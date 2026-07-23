import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { MasonryFeed } from "../../components/MasonryFeed";
import { PostDrawer } from "../../components/PostDrawer";
import { useGetFeedFollowingInfinite } from "../../lib/api/generated/feed/feed";
import type { PostCard } from "../../lib/api/generated/model";

export function FollowingPage() {
  const location = useLocation();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [feedPath] = useState(() => location.pathname + location.search);
  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useGetFeedFollowingInfinite(undefined, {
      query: {
        initialPageParam: undefined,
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      },
    });

  const posts = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="px-4 py-8 sm:px-6">
      <p className="kicker mb-1">Following</p>
      <h1 className="font-display-serif mb-6 text-3xl font-semibold">
        Your people & circles
      </h1>
      <MasonryFeed
        posts={posts}
        isLoading={isLoading}
        hasNextPage={Boolean(hasNextPage)}
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={fetchNextPage}
        onOpenPost={(post: PostCard) => setSelectedSlug(post.slug)}
        emptyState={
          <div className="rounded-xl border border-dashed border-line p-12 text-center">
            <p className="font-display-serif text-2xl font-semibold">
              Follow people to fill this feed
            </p>
            <p className="mt-2 text-sm text-ink-soft">
              Posts from creators you follow and circles you've joined show here in order.
            </p>
            <Link
              to="/circles"
              className="mt-6 inline-block rounded-lg bg-crimson px-4 py-2 text-sm font-semibold text-ink-inverse hover:bg-crimson-deep"
            >
              Browse circles
            </Link>
          </div>
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
