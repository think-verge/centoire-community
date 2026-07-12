import { Link } from "react-router-dom";
import { MasonryFeed } from "../../components/MasonryFeed";
import { useGetFeedForYouInfinite } from "../../lib/api/generated/feed/feed";
import { useAuth } from "../../lib/auth-context";

export function FeedPage() {
  const { user } = useAuth();
  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useGetFeedForYouInfinite(undefined, {
      query: {
        initialPageParam: undefined,
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      },
    });

  const posts = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="px-4 py-8 sm:px-6">
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
      <MasonryFeed
        posts={posts}
        isLoading={isLoading}
        hasNextPage={Boolean(hasNextPage)}
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={fetchNextPage}
        emptyState={
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
        }
      />
    </div>
  );
}

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}
