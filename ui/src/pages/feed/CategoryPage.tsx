import { useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { MasonryFeed } from "../../components/MasonryFeed";
import { PostDrawer } from "../../components/PostDrawer";
import { ActiveFilterPills } from "../../components/filter/ActiveFilterPills";
import { ServerFilterBar } from "../../components/filter/ServerFilterBar";
import { useServerFilter } from "../../components/filter/useServerFilter";
import type { FilterFieldDef } from "../../components/filter/types";
import { useGetFeedCategoryInfinite } from "../../lib/api/generated/feed/feed";
import type { PostCard } from "../../lib/api/generated/model";
import { CATEGORY_LABELS, CATEGORY_SUBCATEGORIES, isPostCategory, type PostCategoryValue } from "../../lib/categoryTaxonomy";

export function CategoryPage() {
  const { category } = useParams<{ category: string }>();
  const location = useLocation();
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);
  const [feedPath] = useState(() => location.pathname + location.search);

  if (!category || !isPostCategory(category)) {
    return (
      <div className="px-4 py-8 sm:px-6">
        <p className="kicker mb-1">Not found</p>
        <p className="font-display-serif text-2xl font-semibold">This section doesn't exist</p>
      </div>
    );
  }

  return (
    <CategoryFeed
      category={category}
      feedPath={feedPath}
      selectedSlug={selectedSlug}
      onSelectSlug={setSelectedSlug}
    />
  );
}

function CategoryFeed({
  category,
  feedPath,
  selectedSlug,
  onSelectSlug,
}: {
  category: PostCategoryValue;
  feedPath: string;
  selectedSlug: string | null;
  onSelectSlug: (slug: string | null) => void;
}) {
  const filterConfig: FilterFieldDef[] = [
    {
      key: "subcategory",
      label: "Subcategory",
      type: "single",
      options: CATEGORY_SUBCATEGORIES[category].map((sub) => ({ value: sub, label: sub })),
    },
  ];
  const { activeFilters, filterCount } = useServerFilter(filterConfig);
  const subcategory = activeFilters.subcategory?.[0];

  const { data, isLoading, hasNextPage, isFetchingNextPage, fetchNextPage } = useGetFeedCategoryInfinite(
    category,
    { subcategory },
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
      <p className="kicker mb-1">{CATEGORY_LABELS[category]}</p>
      <h1 className="font-display-serif text-3xl font-semibold">{CATEGORY_LABELS[category]}</h1>

      <div className="mt-5 flex items-center gap-2">
        <div className="ml-auto">
          <ServerFilterBar config={filterConfig} />
        </div>
      </div>

      {filterCount > 0 && (
        <div className="mt-2">
          <ActiveFilterPills config={filterConfig} />
        </div>
      )}

      <div className="mt-6">
        <MasonryFeed
          posts={posts}
          isLoading={isLoading}
          hasNextPage={Boolean(hasNextPage)}
          isFetchingNextPage={isFetchingNextPage}
          fetchNextPage={fetchNextPage}
          onOpenPost={(post: PostCard) => onSelectSlug(post.slug)}
          emptyState={
            <div className="rounded-xl border border-dashed border-line p-12 text-center">
              <p className="font-display-serif text-2xl font-semibold">Nothing here yet</p>
              <p className="mt-2 text-sm text-ink-soft">
                {subcategory
                  ? `No posts tagged "${subcategory}" yet — try another subcategory.`
                  : `${CATEGORY_LABELS[category]} content lands here once sources are tagged for this section.`}
              </p>
            </div>
          }
        />
      </div>
      {selectedSlug && (
        <PostDrawer slug={selectedSlug} feedPath={feedPath} onClose={() => onSelectSlug(null)} />
      )}
    </div>
  );
}
