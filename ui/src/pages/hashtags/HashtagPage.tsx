import { useQueryClient } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { MasonryFeed } from "../../components/MasonryFeed";
import { useGetFeedDiscoverInfinite } from "../../lib/api/generated/feed/feed";
import {
  getGetHashtagQueryKey,
  useFollowHashtag,
  useGetHashtag,
  useUnfollowHashtag,
} from "../../lib/api/generated/hashtags/hashtags";
import { useAuth } from "../../lib/auth-context";
import { cleanHashtag, formatCount } from "../../lib/hashtag";

export function HashtagPage() {
  const { name: rawName } = useParams();
  const name = cleanHashtag(rawName ?? "");
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // 404 just means nobody has used it yet; the page still renders (and explains that).
  const { data: hashtag, isLoading: loadingTag } = useGetHashtag(name, { query: { enabled: Boolean(name), retry: false } });
  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useGetFeedDiscoverInfinite(
    // Newest first: a hashtag page lists everything under it, not just what is hot this week.
    { sort: "new", hashtag: name },
    {
      query: {
        enabled: Boolean(name),
        initialPageParam: undefined,
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
      },
    },
  );
  const posts = data?.pages.flatMap((page) => page.items) ?? [];

  const refresh = () => queryClient.invalidateQueries({ queryKey: getGetHashtagQueryKey(name) });
  const follow = useFollowHashtag({ mutation: { onSuccess: refresh } });
  const unfollow = useUnfollowHashtag({ mutation: { onSuccess: refresh } });
  const busy = follow.isPending || unfollow.isPending;

  return (
    <div className="px-4 py-8 sm:px-6">
      <p className="kicker mb-1">Hashtag</p>
      <div className="flex flex-wrap items-center gap-4">
        <h1 className="font-display-serif text-3xl font-semibold">#{name}</h1>
        {hashtag && user && (
          <button
            type="button"
            disabled={busy}
            onClick={() => (hashtag.following ? unfollow.mutate({ name }) : follow.mutate({ name }))}
            className={`rounded-full border px-5 py-1.5 font-ui text-[13px] font-semibold transition-colors disabled:opacity-50 ${
              hashtag.following
                ? "border-transparent bg-[var(--color-coral)] text-white hover:opacity-90"
                : "border-[#111111] bg-white text-[#111111] hover:bg-[#F5F5F5]"
            }`}
          >
            {hashtag.following ? "Following" : "Follow"}
          </button>
        )}
      </div>
      <p className="mt-1 text-xs text-ink-faint">
        {loadingTag
          ? " "
          : hashtag
            ? `${formatCount(hashtag.postCount)} ${hashtag.postCount === 1 ? "post" : "posts"} · ${formatCount(hashtag.followerCount)} following`
            : "No posts use this hashtag yet"}
      </p>
      <div className="mt-6">
        <MasonryFeed
          posts={posts}
          isLoading={isLoading}
          hasNextPage={Boolean(hasNextPage)}
          isFetchingNextPage={isFetchingNextPage}
          fetchNextPage={fetchNextPage}
          emptyState={
            <div className="rounded-xl border border-dashed border-line p-12 text-center">
              <p className="font-display-serif text-2xl font-semibold">No posts yet in #{name}</p>
              <p className="mt-2 text-sm text-ink-soft">
                Be the first to publish here.{" "}
                <Link to="/compose" className="font-semibold text-[var(--color-coral)] hover:underline">
                  Write a post
                </Link>
              </p>
            </div>
          }
        />
      </div>
    </div>
  );
}
