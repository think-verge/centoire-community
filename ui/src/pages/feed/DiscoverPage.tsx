import { useSearchParams } from "react-router-dom";
import { MasonryFeed } from "../../components/MasonryFeed";
import { useGetFeedDiscoverInfinite } from "../../lib/api/generated/feed/feed";
import { useListTags } from "../../lib/api/generated/tags/tags";

export function DiscoverPage() {
  const [params, setParams] = useSearchParams();
  const sort = (params.get("sort") as "trending" | "new") ?? "trending";
  const tag = params.get("tag") ?? undefined;
  const { data: tags } = useListTags();

  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useGetFeedDiscoverInfinite(
      { sort, tag },
      {
        query: {
          initialPageParam: undefined,
          getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        },
      },
    );

  const posts = data?.pages.flatMap((page) => page.items) ?? [];

  function setSort(next: "trending" | "new") {
    const nextParams = new URLSearchParams(params);
    nextParams.set("sort", next);
    setParams(nextParams, { replace: true });
  }

  function setTag(slug: string | null) {
    const nextParams = new URLSearchParams(params);
    if (slug) nextParams.set("tag", slug);
    else nextParams.delete("tag");
    setParams(nextParams, { replace: true });
  }

  return (
    <div className="px-4 py-8 sm:px-6">
      <p className="kicker mb-1">Discover</p>
      <h1 className="font-display-serif text-3xl font-semibold">Explore fashion</h1>

      <div className="mt-5 flex items-center gap-2">
        {(["trending", "new"] as const).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={sort === value}
            onClick={() => setSort(value)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
              sort === value
                ? "bg-ink text-ink-inverse"
                : "border border-line bg-paper text-ink-soft hover:border-ink-soft"
            }`}
          >
            {value === "trending" ? "Trending" : "New"}
          </button>
        ))}
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
        <button
          type="button"
          onClick={() => setTag(null)}
          className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${
            !tag
              ? "border-crimson bg-crimson text-ink-inverse"
              : "border-line bg-paper text-ink-soft hover:border-ink-soft"
          }`}
        >
          All
        </button>
        {(tags ?? []).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTag(t.slug === tag ? null : t.slug)}
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${
              tag === t.slug
                ? "border-crimson bg-crimson text-ink-inverse"
                : "border-line bg-paper text-ink-soft hover:border-ink-soft"
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>

      <div className="mt-6">
        <MasonryFeed
          posts={posts}
          isLoading={isLoading}
          hasNextPage={Boolean(hasNextPage)}
          isFetchingNextPage={isFetchingNextPage}
          fetchNextPage={fetchNextPage}
          emptyState={
            <div className="rounded-xl border border-dashed border-line p-12 text-center">
              <p className="font-display-serif text-2xl font-semibold">Nothing here yet</p>
              <p className="mt-2 text-sm text-ink-soft">
                {tag
                  ? "No posts carry this tag yet — try another, or write the first one."
                  : "Aggregated stories land here once sources are fetched."}
              </p>
            </div>
          }
        />
      </div>
    </div>
  );
}
