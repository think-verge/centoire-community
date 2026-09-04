import { Link } from "react-router-dom";
import { useListTags } from "../../lib/api/generated/tags/tags";
import type { ListTagsCategory } from "../../lib/api/generated/model";

export type RightSidebarContext =
  | { type: "feed" }
  | { type: "following" }
  | { type: "discover" }
  | { type: "category"; category: string };

// ── Static placeholder data ────────────────────────────────────────────────

const EDITORS_PICKS = [
  { id: "1", title: "The quiet return of couture craftsmanship", author: "Editorial Team", readTime: 4 },
  { id: "2", title: "How streetwear reshaped the luxury ladder", author: "Style Desk", readTime: 6 },
  { id: "3", title: "Art fairs in 2026: who's buying, who's showing", author: "Arts Editor", readTime: 5 },
];

const CREATORS_BY_CATEGORY: Record<string, { id: string; name: string; role: string }[]> = {
  fashion: [
    { id: "1", name: "Aria Sharma", role: "Fashion Curator" },
    { id: "2", name: "Leila Owusu", role: "Style Journalist" },
    { id: "3", name: "Marcus Tan", role: "Runway Critic" },
  ],
  art: [
    { id: "1", name: "Ethan Muro", role: "Art Director" },
    { id: "2", name: "Soo-Yeon Kim", role: "Gallery Curator" },
    { id: "3", name: "Rafael Neto", role: "Contemporary Artist" },
  ],
  lifestyle: [
    { id: "1", name: "Priya Desai", role: "Lifestyle Editor" },
    { id: "2", name: "James Olivier", role: "Wellness Writer" },
    { id: "3", name: "Mia Larsen", role: "Design Journalist" },
  ],
  default: [
    { id: "1", name: "Aria Sharma", role: "Fashion Curator" },
    { id: "2", name: "Ethan Muro", role: "Art Director" },
    { id: "3", name: "Leila Owusu", role: "Style Journalist" },
  ],
};

const COLLECTION = [
  "The power of slow fashion in a fast world",
  "Building a second-skin wardrobe",
  "Why photorealism is back in contemporary art",
];

// Category → tag category mapping for Trending Topics
const CATEGORY_TAG_FILTER: Record<string, ListTagsCategory> = {
  fashion: "style",
  lifestyle: "style",
  art: "culture",
  beauty: "style",
  ai_technology: "business",
  business_intelligence: "business",
};

const CATEGORY_LABELS: Record<string, string> = {
  fashion: "Fashion",
  art: "Art",
  lifestyle: "Lifestyle",
  beauty: "Beauty",
};

// ── Component ──────────────────────────────────────────────────────────────

export function RightSidebar({ context }: { context: RightSidebarContext }) {
  const isCategory = context.type === "category";
  const category = isCategory ? context.category : undefined;
  const categoryLabel = category ? (CATEGORY_LABELS[category] ?? category) : undefined;

  const tagFilter = category ? CATEGORY_TAG_FILTER[category] : undefined;
  const { data: tags = [] } = useListTags(
    tagFilter ? { category: tagFilter } : undefined,
    { query: {} },
  );

  const creators: { id: string; name: string; role: string }[] =
    (category ? CREATORS_BY_CATEGORY[category] : undefined) ?? CREATORS_BY_CATEGORY.default;

  return (
    <aside className="sticky top-14 hidden h-[calc(100vh-3.5rem)] w-72 shrink-0 flex-col gap-6 overflow-y-auto border-l border-[var(--color-hairline)] bg-white px-5 py-5 xl:flex">

      {/* Category context header */}
      {isCategory && categoryLabel && (
        <>
          <section>
            <p className="font-ui text-[10px] font-semibold uppercase tracking-widest text-[var(--color-taupe)]">
              Browsing
            </p>
            <h2 className="font-editorial mt-1 text-2xl italic text-[var(--color-charcoal)]">
              {categoryLabel}
            </h2>
            <Link
              to={`/category/${category}`}
              className="mt-1 inline-block font-ui text-xs text-[var(--color-coral)] hover:underline"
            >
              See all {categoryLabel} →
            </Link>
          </section>
          <div className="h-px bg-[var(--color-hairline)]" />
        </>
      )}

      {/* Editor's Picks — only on feed/discover/following */}
      {!isCategory && (
        <>
          <section>
            <div className="mb-3 flex items-center justify-between">
              <p className="font-ui text-[10px] font-semibold uppercase tracking-widest text-[var(--color-taupe)]">
                Editor's Picks
              </p>
              <Link
                to="/discover"
                className="font-ui text-[10px] font-semibold text-[var(--color-coral)] hover:underline"
              >
                VIEW ALL
              </Link>
            </div>
            <ul className="flex flex-col gap-3">
              {EDITORS_PICKS.map((item) => (
                <li key={item.id}>
                  <Link to="/discover" className="group block">
                    <p className="line-clamp-2 text-sm font-medium leading-snug text-[var(--color-charcoal)] group-hover:text-[var(--color-coral)]">
                      {item.title}
                    </p>
                    <p className="mt-0.5 font-ui text-[11px] text-[var(--color-taupe)]">
                      {item.author} · {item.readTime} min
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
          <div className="h-px bg-[var(--color-hairline)]" />
        </>
      )}

      {/* Trending Topics */}
      <section>
        <p className="mb-3 font-ui text-[10px] font-semibold uppercase tracking-widest text-[var(--color-taupe)]">
          {isCategory && categoryLabel ? `Trending in ${categoryLabel}` : "Trending Topics"}
        </p>
        {(tags as { id: string; slug: string; name: string }[]).length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {(tags as { id: string; slug: string; name: string }[]).slice(0, 12).map((tag) => (
              <Link
                key={tag.id}
                to={`/t/${tag.slug}`}
                className="rounded-full border border-[var(--color-hairline)] px-3 py-1 font-ui text-[11px] text-[var(--color-stone)] transition-colors hover:border-[var(--color-coral)] hover:text-[var(--color-coral)]"
              >
                {tag.name}
              </Link>
            ))}
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {["Haute Couture", "Streetwear", "Sustainable", "Runway", "Art Basel", "Luxury"].map(
              (name) => (
                <span
                  key={name}
                  className="rounded-full border border-[var(--color-hairline)] px-3 py-1 font-ui text-[11px] text-[var(--color-stone)]"
                >
                  {name}
                </span>
              ),
            )}
          </div>
        )}
      </section>

      <div className="h-px bg-[var(--color-hairline)]" />

      {/* Creators to Watch */}
      <section>
        <p className="mb-3 font-ui text-[10px] font-semibold uppercase tracking-widest text-[var(--color-taupe)]">
          {isCategory && categoryLabel ? `Creators in ${categoryLabel}` : "Creators to Watch"}
        </p>
        <ul className="flex flex-col gap-3">
          {creators.map((creator) => (
            <li key={creator.id} className="flex items-center gap-2.5">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-[var(--color-sand)] font-ui text-sm font-semibold text-[var(--color-stone)]">
                {creator.name.charAt(0)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--color-charcoal)]">
                  {creator.name}
                </p>
                <p className="font-ui text-[11px] text-[var(--color-taupe)]">{creator.role}</p>
              </div>
              <button
                type="button"
                className="shrink-0 rounded-full border border-[var(--color-coral)] px-2.5 py-0.5 font-ui text-[11px] font-semibold text-[var(--color-coral)] transition-colors hover:bg-[var(--color-coral)] hover:text-white"
              >
                Follow
              </button>
            </li>
          ))}
        </ul>
      </section>

      {/* Your Collection — only on non-category pages */}
      {!isCategory && (
        <>
          <div className="h-px bg-[var(--color-hairline)]" />
          <section>
            <div className="mb-3 flex items-center justify-between">
              <p className="font-ui text-[10px] font-semibold uppercase tracking-widest text-[var(--color-taupe)]">
                Your Collection
              </p>
              <Link
                to="/bookmarks"
                className="font-ui text-[10px] font-semibold text-[var(--color-coral)] hover:underline"
              >
                VIEW ALL
              </Link>
            </div>
            <ul className="flex flex-col gap-2">
              {COLLECTION.map((title) => (
                <li key={title} className="flex items-start gap-2">
                  <span className="mt-0.5 size-3.5 shrink-0 rounded-sm border border-[var(--color-hairline)]" />
                  <p className="line-clamp-2 text-xs leading-snug text-[var(--color-stone)]">
                    {title}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </aside>
  );
}
