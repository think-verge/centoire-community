import { useParams } from "react-router-dom";
import { MasonryFeed } from "../../components/MasonryFeed";
import { useGetFeedDiscoverInfinite } from "../../lib/api/generated/feed/feed";
import { useGetTag } from "../../lib/api/generated/tags/tags";

export function TagPage() {
  const { slug } = useParams();
  const { data: tag } = useGetTag(slug ?? "");
  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useGetFeedDiscoverInfinite(
      { sort: "trending", tag: slug },
      {
        query: {
          initialPageParam: undefined,
          getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        },
      },
    );

  const posts = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div className="px-4 py-8 sm:px-6">
      <p className="kicker mb-1">{tag?.category ?? "Tag"}</p>
      <h1 className="font-display-serif text-3xl font-semibold">{tag?.name ?? slug}</h1>
      {tag?.description && <p className="mt-2 text-ink-soft">{tag.description}</p>}
      <p className="mt-1 text-xs text-ink-faint">
        {tag?.postCount ?? 0} posts · {tag?.followerCount ?? 0} following this
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
              <p className="font-display-serif text-2xl font-semibold">
                No posts yet in {tag?.name ?? "this tag"}
              </p>
              <p className="mt-2 text-sm text-ink-soft">Be the first to publish here.</p>
            </div>
          }
        />
      </div>
    </div>
  );
}
