import { useState, useRef, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  useJoinCircle,
  useLeaveCircle,
  useListCircles,
} from "../../lib/api/generated/circles/circles";
import type { Circle } from "../../lib/api/generated/model";

const FILTERS = ["ALL", "RECOMMENDED", "FASHION", "ART", "LIFESTYLE"] as const;
type CircleFilter = (typeof FILTERS)[number];

function useContainerColumnCount(containerRef: React.RefObject<HTMLDivElement | null>): number {
  const [cols, setCols] = useState(() => {
    if (typeof window === "undefined") return 4;
    return Math.max(1, Math.floor((window.innerWidth - 40 + 24) / 264));
  });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const update = () => {
      // 1. Read exact column count computed by the browser CSS Grid engine
      const grid = el.querySelector(".grid") as HTMLElement | null;
      if (grid) {
        const computed = window.getComputedStyle(grid).gridTemplateColumns;
        if (computed) {
          const parts = computed.trim().split(/\s+/).filter(Boolean);
          if (parts.length > 0) {
            setCols(parts.length);
            return;
          }
        }
      }
      // 2. Exact fallback based on container width
      const width = el.clientWidth;
      const c = Math.max(1, Math.floor((width + 24) / 264));
      setCols(c);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [containerRef]);

  return cols;
}

export function CirclesPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const cols = useContainerColumnCount(containerRef);
  const [query, setQuery] = useState("");
  const { data: rawCircles, isLoading } = useListCircles(query ? { q: query } : undefined);
  const [filter, setFilter] = useState<CircleFilter>("ALL");
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const circles = rawCircles || [];

  // Explicit primary category mappings to eliminate cross-category duplicate cards
  const CIRCLE_PRIMARY_CATEGORY: Record<string, "FASHION" | "ART" | "LIFESTYLE"> = {
    // FASHION
    "workwear-edit": "FASHION",
    "fashion-week": "FASHION",
    "accessories-edit": "FASHION",
    "street-style": "FASHION",
    "wardrobe-diaries": "FASHION",
    "evening-wear": "FASHION",
    "japanese-denim": "FASHION",
    "pattern-room": "FASHION",

    // ART & DESIGN
    "art-architecture": "ART",
    "ceramics-objects": "ART",
    "graphic-forms": "ART",
    "textile-innovations": "ART",
    "sneaker-sketches": "ART",

    // LIFESTYLE
    "beauty-notes": "LIFESTYLE",
    "sustainable-style": "LIFESTYLE",
    "deadstock-design": "LIFESTYLE",
    "indie-labels": "LIFESTYLE",
    "knit-lab": "LIFESTYLE",
    "centoire-community": "LIFESTYLE",
  };

  const getCircleCategory = (c: Circle): "FASHION" | "ART" | "LIFESTYLE" => {
    if (CIRCLE_PRIMARY_CATEGORY[c.slug]) return CIRCLE_PRIMARY_CATEGORY[c.slug];
    const tags = (c.hashtags || []).map((t) => t.toLowerCase());
    if (tags.some((t) => ["art", "architecture", "design", "ceramics", "graphics"].includes(t))) return "ART";
    if (tags.some((t) => ["beauty", "lifestyle", "wellness", "sustainability", "community", "retail"].includes(t))) return "LIFESTYLE";
    return "FASHION";
  };

  // Full canonical lists per domain
  const allFashionCircles = circles.filter((c) => getCircleCategory(c) === "FASHION");
  const allArtCircles = circles.filter((c) => getCircleCategory(c) === "ART");
  const allLifestyleCircles = circles.filter((c) => getCircleCategory(c) === "LIFESTYLE");

  // Curated standout picks across fashion, art, and lifestyle
  const recommendedSlugs = ["workwear-edit", "beauty-notes", "art-architecture", "japanese-denim"];
  const recommendedCircles = recommendedSlugs
    .map((slug) => circles.find((c) => c.slug === slug))
    .filter((c): c is Circle => Boolean(c));

  // In the main "ALL" view, prevent duplicate appearances so each circle card exists only once on the page
  const recommendedIds = new Set(recommendedCircles.map((c) => c.id));
  const fashionCircles = allFashionCircles.filter((c) => !recommendedIds.has(c.id));
  const artCircles = allArtCircles.filter((c) => !recommendedIds.has(c.id));
  const lifestyleCircles = allLifestyleCircles.filter((c) => !recommendedIds.has(c.id));

  // Determine what to display based on active filter capsule
  const getFilteredList = () => {
    switch (filter) {
      case "RECOMMENDED":
        return recommendedCircles;
      case "FASHION":
        return allFashionCircles;
      case "ART":
        return allArtCircles;
      case "LIFESTYLE":
        return allLifestyleCircles;
      case "ALL":
      default:
        return circles;
    }
  };

  const filteredCircles = getFilteredList();

  // Determine circles for the View All section
  const getExpandedSectionCircles = () => {
    let list: Circle[];
    switch (expandedSection) {
      case "RECOMMENDED FOR YOU":
      case "RECOMMENDED":
        list = recommendedCircles;
        break;
      case "FASHION":
        list = allFashionCircles;
        break;
      case "ART & DESIGN":
      case "ART":
        list = allArtCircles;
        break;
      case "LIFESTYLE":
        list = allLifestyleCircles;
        break;
      default:
        list = circles;
        break;
    }
    if (query.trim().length > 0) {
      const q = query.trim().toLowerCase();
      return list.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q) ||
          (c.hashtags || []).some((h) => h.toLowerCase().includes(q))
      );
    }
    return list;
  };

  const currentSectionCircles = getExpandedSectionCircles();
  const total = currentSectionCircles.length;
  // Fulfill complete rows above the banner so no empty space remains:
  // If enough cards exist for 2 full rows (cols * 2 <= total), fill 2 full rows (e.g. 100%, 90%, 80%, 75%, 67%).
  // Otherwise if enough cards exist for 1 full row (cols <= total), fill 1 full row (e.g. 50%).
  // Otherwise display all available cards in the top section.
  const topCapacity =
    cols * 2 <= total ? cols * 2 : cols <= total ? cols : total;
  const firstBatch = currentSectionCircles.slice(0, topCapacity);
  const secondBatch = currentSectionCircles.slice(topCapacity);

  // Exact same rail constants as SearchPage (feature/ai-search-ux) - removed scroll-smooth to prevent double-smooth overshoot in Chromium
  const railClass =
    "flex items-stretch gap-6 overflow-x-auto snap-x scroll-pl-3 hide-scrollbar px-3 -mx-3 pt-3 -mt-3 pb-5 -mb-5";
  const railItemClass =
    "snap-start shrink-0 flex flex-col w-full " +
    "@[504px]:w-[calc((100%-24px)/2)] " +
    "@[768px]:w-[calc((100%-48px)/3)] " +
    "@[1032px]:w-[calc((100%-72px)/4)] " +
    "@[1296px]:w-[calc((100%-96px)/5)] " +
    "@[1560px]:w-[calc((100%-120px)/6)] " +
    "@[1824px]:w-[calc((100%-144px)/7)] " +
    "@[2088px]:w-[calc((100%-168px)/8)] " +
    "@[2352px]:w-[calc((100%-192px)/9)] " +
    "@[2616px]:w-[calc((100%-216px)/10)] " +
    "@[2880px]:w-[calc((100%-240px)/11)] " +
    "@[3144px]:w-[calc((100%-264px)/12)] " +
    "@[3408px]:w-[calc((100%-288px)/13)] " +
    "@[3672px]:w-[calc((100%-312px)/14)] " +
    "@[3936px]:w-[calc((100%-336px)/15)] " +
    "@[4200px]:w-[calc((100%-360px)/16)] " +
    "@[4464px]:w-[calc((100%-384px)/17)] " +
    "@[4728px]:w-[calc((100%-408px)/18)] " +
    "@[4992px]:w-[calc((100%-432px)/19)] " +
    "@[5256px]:w-[calc((100%-456px)/20)] " +
    "@[5520px]:w-[calc((100%-480px)/21)] " +
    "@[5784px]:w-[calc((100%-504px)/22)] " +
    "@[6048px]:w-[calc((100%-528px)/23)] " +
    "@[6312px]:w-[calc((100%-552px)/24)] " +
    "@[6576px]:w-[calc((100%-576px)/25)] " +
    "@[6840px]:w-[calc((100%-600px)/26)] " +
    "@[7104px]:w-[calc((100%-624px)/27)] " +
    "@[7368px]:w-[calc((100%-648px)/28)] " +
    "@[7632px]:w-[calc((100%-672px)/29)] " +
    "@[7896px]:w-[calc((100%-696px)/30)]";

  return (
    <div className="min-h-screen flex flex-col w-full bg-[#F0F0F0] px-5 pt-8 pb-8">
      {/* @container must wrap the WHOLE content so @[Xpx] breakpoints work on railItemClass */}
      <div ref={containerRef} className="@container w-full flex flex-col gap-6">
        {/* Header Row: Title, Subtitle, and Figma-matched Create Circle Button */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-editorial text-[32px] sm:text-[36px] font-bold text-[#111111] leading-tight">
              Circles
            </h1>
            <p className="mt-1 text-[#555552] font-ui text-[14px]">
              Discover communities and join the conversations that matter.
            </p>
          </div>

          {/* Exact Figma match: Hug 173px x 34px, rgba(228, 87, 46, 0.1) bg, 14px bold uppercase text, larger plus sign shifted 1px up */}
          <Link
            to="/circles/new"
            className="h-[34px] rounded-full bg-[#E4572E]/10 hover:bg-[#E4572E]/20 text-[#E4572E] font-ui text-[14px] font-bold uppercase tracking-normal px-5 flex items-center justify-center gap-2 transition-colors shrink-0 leading-none select-none"
          >
            <span className="text-[20px] font-bold leading-none -mt-[3px] select-none">+</span>
            <span>CREATE CIRCLE</span>
          </Link>
        </div>

        {/* ── CONDITIONAL VIEW: EXPANDED SECTION (FIGMA "VIEW ALL") VS NORMAL VIEW ── */}
        {expandedSection ? (
          /* ── VIEW ALL SECTION VIEW (FIGMA FRAME 2147226033) ── */
          <div className="flex flex-col gap-6">
            {/* Section Header Row: Title on Left, Search Bar on Right (Pills are removed!) */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setExpandedSection(null);
                    setQuery("");
                  }}
                  className="size-8 rounded-full border border-[#111111]/15 bg-white hover:bg-black/5 flex items-center justify-center transition-colors text-[#111111] cursor-pointer shrink-0"
                  aria-label="Back to all circles"
                  title="Back to all circles"
                >
                  <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <h2 className="font-ui text-[20px] font-bold uppercase tracking-normal text-[#111111]">
                  {expandedSection}
                </h2>
              </div>

              {/* Lighter Search Pill Input in place */}
              <div className="relative w-full sm:w-[320px] shrink-0">
                <svg
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#8A8A8A]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search circles..."
                  className="w-full rounded-full border border-[#EAEAEA] bg-white pl-10 pr-4 py-2 font-ui text-[13px] text-[#111111] placeholder:text-[#8A8A8A] focus:border-[#CCCCCC] focus:outline-none transition-colors shadow-2xs"
                />
              </div>
            </div>

            {/* Section Circles Grid: First Batch */}
            {firstBatch.length > 0 ? (
              <div
                className="grid gap-6 px-3 -mx-3 py-3 -my-3"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}
              >
                {firstBatch.map((circle) => (
                  <div key={circle.id} className="flex flex-col h-full">
                    <CircleCard circle={circle} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[#111111]/20 p-12 text-center bg-white">
                <p className="font-editorial text-2xl font-medium text-[#111111]">
                  No circles found
                </p>
                <p className="mt-2 text-[14px] text-[#5A5A5A] font-ui">
                  {query.trim().length > 0
                    ? `No circles matching "${query}" in ${expandedSection}.`
                    : `No circles available in this category yet.`}
                </p>
              </div>
            )}

            {/* Jobs Promo Banner - dedicated comfortable spacing in View All section */}
            <JobsPromoBanner className="my-0" />

            {/* Section Circles Grid: Second Batch (remaining cards displayed till the end!) */}
            {secondBatch.length > 0 && (
              <div
                className="grid gap-6 px-3 -mx-3 py-3 -my-3"
                style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}
              >
                {secondBatch.map((circle) => (
                  <div key={circle.id} className="flex flex-col h-full">
                    <CircleCard circle={circle} />
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ── NORMAL MULTI-SECTION VIEW ── */
          <>
            {/* Filter Capsules & Lighter Search Input Row */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              <div className="flex items-center gap-2 flex-wrap">
                {FILTERS.map((f, index) => (
                  <span key={f} className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setFilter(f)}
                      className={`shrink-0 rounded-full px-4 py-[7px] font-ui text-[14px] leading-[18px] uppercase tracking-normal transition-colors border cursor-pointer ${
                        filter === f
                          ? "border-[#E4572E] bg-[#E4572E] text-white font-bold shadow-2xs"
                          : "border-[#111111]/20 bg-white text-black/60 hover:border-[#111111]/40 font-semibold"
                      }`}
                    >
                      {f}
                    </button>
                    {index === 0 && <div className="h-[24px] w-[1px] bg-[#D1D1D1] mx-1 shrink-0" />}
                  </span>
                ))}
              </div>

              {/* Lighter Search Pill Input */}
              <div className="relative w-full sm:w-[320px] shrink-0">
                <svg
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#8A8A8A]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search circles..."
                  className="w-full rounded-full border border-[#EAEAEA] bg-white pl-10 pr-4 py-2 font-ui text-[13px] text-[#111111] placeholder:text-[#8A8A8A] focus:border-[#CCCCCC] focus:outline-none transition-colors shadow-2xs"
                />
              </div>
            </div>

            {/* Loading state */}
            {isLoading && (
              <div className="py-20 text-center text-[#737373] font-ui text-[14px]">
                Loading circles...
              </div>
            )}

            {/* Content Section: Filtered Grid OR Structured Multi-section Rails */}
            {!isLoading && (
              <>
                {query.trim().length > 0 || filter !== "ALL" ? (
                  <div className="flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <h2 className="font-ui text-[20px] font-bold uppercase tracking-normal text-[#111111]">
                        {query.trim().length > 0
                          ? `SEARCH RESULTS FOR "${query}"`
                          : `${filter} CIRCLES`}
                      </h2>
                      <span className="font-ui text-[14px] text-[#737373]">
                        {filteredCircles.length} {filteredCircles.length === 1 ? "circle" : "circles"}
                      </span>
                    </div>

                    {filteredCircles.length > 0 ? (
                      <div
                        className="grid gap-6 px-3 -mx-3 py-3 -my-3"
                        style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}
                      >
                        {filteredCircles.map((circle) => (
                          <div key={circle.id} className="flex flex-col h-full">
                            <CircleCard circle={circle} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="mt-8 rounded-2xl border border-dashed border-[#111111]/20 p-12 text-center bg-white">
                        <p className="font-editorial text-2xl font-medium text-[#111111]">
                          No circles found
                        </p>
                        <p className="mt-2 text-[14px] text-[#5A5A5A] font-ui">
                          {query.trim().length > 0
                            ? `Try searching for different keywords or explore other categories.`
                            : `No circles available in this category yet.`}
                        </p>
                      </div>
                    )}
                  </div>
                ) : (
                  /* ALL View: Multi-section rails with Jobs banner */
                  <div className="flex flex-col gap-10 pb-12">
                    {recommendedCircles.length > 0 && (
                      <CircleCarousel
                        title="RECOMMENDED FOR YOU"
                        circles={recommendedCircles}
                        railClass={railClass}
                        railItemClass={railItemClass}
                        onViewAll={() => setExpandedSection("RECOMMENDED FOR YOU")}
                        className="-mb-4 sm:-mb-3"
                      />
                    )}

                    {fashionCircles.length > 0 && (
                      <CircleCarousel
                        title="FASHION"
                        circles={fashionCircles}
                        railClass={railClass}
                        railItemClass={railItemClass}
                        onViewAll={() => setExpandedSection("FASHION")}
                      />
                    )}

                    {/* Featured Jobs Promo Banner */}
                    <JobsPromoBanner />

                    {artCircles.length > 0 && (
                      <CircleCarousel
                        title="ART & DESIGN"
                        circles={artCircles}
                        railClass={railClass}
                        railItemClass={railItemClass}
                        onViewAll={() => setExpandedSection("ART & DESIGN")}
                        className="-mb-4 sm:-mb-3"
                      />
                    )}

                    {lifestyleCircles.length > 0 && (
                      <CircleCarousel
                        title="LIFESTYLE"
                        circles={lifestyleCircles}
                        railClass={railClass}
                        railItemClass={railItemClass}
                        onViewAll={() => setExpandedSection("LIFESTYLE")}
                      />
                    )}

                    {circles.length === 0 && (
                      <div className="mt-10 rounded-2xl border border-dashed border-[#111111]/20 p-12 text-center bg-white">
                        <p className="font-editorial text-2xl font-medium text-[#111111]">
                          No circles found
                        </p>
                        <p className="mt-2 text-[14px] text-[#5A5A5A] font-ui">
                          Start the one you're looking for.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CircleCarousel({
  title,
  circles,
  railClass,
  railItemClass,
  onViewAll,
  className = "",
}: {
  title: string;
  circles: Circle[];
  railClass: string;
  railItemClass: string;
  onViewAll: () => void;
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const snapTimeoutRef = useRef<number | null>(null);
  const [canScroll, setCanScroll] = useState({ left: false, right: true });

  const updateScroll = () => {
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      setCanScroll({
        left: scrollLeft > 5,
        right: Math.ceil(scrollLeft) < scrollWidth - clientWidth - 5,
      });
    }
  };

  useEffect(() => {
    updateScroll();
    window.addEventListener("resize", updateScroll);
    return () => {
      window.removeEventListener("resize", updateScroll);
      if (snapTimeoutRef.current) window.clearTimeout(snapTimeoutRef.current);
    };
  }, [circles]);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const children = Array.from(scrollRef.current.children) as HTMLElement[];
      if (children.length === 0) return;
      const firstChild = children[0];
      const step = firstChild.offsetWidth + 24;
      const currentScroll = scrollRef.current.scrollLeft;
      const currentIndex = Math.round(currentScroll / step);
      const targetIndex =
        direction === "left"
          ? Math.max(0, currentIndex - 1)
          : Math.min(children.length - 1, currentIndex + 1);

      // Exact target coordinate relative to the first child's start
      const targetLeft =
        targetIndex === 0
          ? 0
          : children[targetIndex].offsetLeft - firstChild.offsetLeft;

      // Temporarily disable CSS scroll snapping during programmatic smooth scroll
      // so the browser physics doesn't fight or overshoot the target position
      scrollRef.current.style.scrollSnapType = "none";
      scrollRef.current.scrollTo({ left: targetLeft, behavior: "smooth" });

      if (snapTimeoutRef.current) {
        window.clearTimeout(snapTimeoutRef.current);
      }
      snapTimeoutRef.current = window.setTimeout(() => {
        if (scrollRef.current) {
          scrollRef.current.style.scrollSnapType = "";
        }
      }, 450);
    }
  };

  if (!circles || circles.length === 0) return null;

  const arrowClass = (enabled: boolean) =>
    `size-[36px] shrink-0 rounded-full bg-white border flex items-center justify-center transition-colors cursor-pointer ${
      enabled
        ? "border-[#111111]/10 text-[#111111] hover:bg-black/5"
        : "border-[#111111]/5 text-[#111111]/30 cursor-not-allowed"
    }`;

  return (
    <div className={`w-full flex flex-col gap-3 ${className}`}>
      {/* Header row */}
      <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-4">
        <h2 className="font-ui text-[20px] font-bold uppercase tracking-normal text-[#111111] flex flex-wrap items-baseline gap-3">
          {title}
          <button
            type="button"
            onClick={onViewAll}
            className="font-ui text-[14px] font-medium text-[#111111]/60 hover:text-[#111111] underline underline-offset-[2px] decoration-[#111111]/30 hover:decoration-[#111111] normal-case whitespace-nowrap relative -top-[3px] cursor-pointer"
          >
            View all
          </button>
        </h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => scroll("left")}
            disabled={!canScroll.left}
            aria-label="Previous"
            className={arrowClass(canScroll.left)}
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => scroll("right")}
            disabled={!canScroll.right}
            aria-label="Next"
            className={arrowClass(canScroll.right)}
          >
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Carousel Rail with full breathing room for card shadows */}
      <div
        ref={scrollRef}
        onScroll={updateScroll}
        className={railClass}
        style={{ scrollbarWidth: "none" }}
      >
        {circles.map((circle) => (
          <div key={circle.id} className={`${railItemClass} h-auto`}>
            <CircleCard circle={circle} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function CircleCard({ circle }: { circle: Circle }) {
  const queryClient = useQueryClient();
  const [joined, setJoined] = useState(Boolean(circle.viewerRole));
  const [members, setMembers] = useState(circle.memberCount);
  const [copied, setCopied] = useState(false);
  const join = useJoinCircle();
  const leave = useLeaveCircle();
  const isMutatingRef = useRef(false);

  useEffect(() => {
    if (!isMutatingRef.current) {
      setJoined(Boolean(circle.viewerRole));
      setMembers(circle.memberCount);
    }
  }, [circle.viewerRole, circle.memberCount]);

  function toggle() {
    isMutatingRef.current = true;
    const updateCache = (newRole: "member" | null, delta: number) => {
      queryClient.setQueriesData<Circle[]>(
        {
          predicate: (q) =>
            Array.isArray(q.queryKey) &&
            typeof q.queryKey[0] === "string" &&
            q.queryKey[0].startsWith("/circles"),
        },
        (old) => {
          if (!old) return old;
          return old.map((c) =>
            c.slug === circle.slug
              ? {
                  ...c,
                  viewerRole: newRole,
                  memberCount: Math.max(0, c.memberCount + delta),
                }
              : c
          );
        }
      );
    };

    if (joined) {
      setJoined(false);
      setMembers((n) => Math.max(0, n - 1));
      updateCache(null, -1);
      leave.mutate(
        { slug: circle.slug },
        {
          onError: () => {
            setJoined(true);
            setMembers((n) => n + 1);
            updateCache("member", 1);
          },
          onSettled: () => {
            isMutatingRef.current = false;
          },
        }
      );
    } else {
      setJoined(true);
      setMembers((n) => n + 1);
      updateCache("member", 1);
      join.mutate(
        { slug: circle.slug },
        {
          onError: () => {
            setJoined(false);
            setMembers((n) => Math.max(0, n - 1));
            updateCache(null, -1);
          },
          onSettled: () => {
            isMutatingRef.current = false;
          },
        }
      );
    }
  }

  async function share(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/c/${circle.slug}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable
    }
  }

  const cover = circle.coverImageUrl;
  const avatar = circle.avatarUrl;
  const weeklyVisitors = formatWeeklyVisitors(members);

  // If there is only 1 follower, show only 1 circle profile; otherwise show up to max 5 profiles
  const profileCount = Math.min(5, Math.max(0, members));
  const memberAvatars = (circle.memberAvatars || []).slice(0, profileCount);

  // Exact card structure from SearchPage DemoCircleCard – border-radius on card only, image sharp-edged
  return (
    <div
      className="bg-white rounded-[16px] border border-[#111111]/10 flex flex-col h-full overflow-hidden transition-shadow duration-300"
      style={{ boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.1)" }}
    >
      {/* Cover banner: from backend database, fallback to sleek neutral dark gradient if none */}
      {cover ? (
        <img src={cover} alt="" className="h-[36px] w-full object-cover shrink-0" />
      ) : (
        <div className="h-[36px] w-full bg-gradient-to-r from-[#1c1c1c] via-[#2d2d2d] to-[#1c1c1c] shrink-0" />
      )}

      {/* DP circle overlapping banner (-mt-5 = -20px, ~55% inside) + followers pill */}
      <div className="px-4 flex justify-between relative -mt-5">
        <Link to={`/c/${circle.slug}`} className="shrink-0 group">
          <div className="size-14 rounded-full border-2 border-white object-cover shadow-sm bg-white overflow-hidden flex items-center justify-center">
            {avatar ? (
              <img
                src={avatar}
                alt={circle.name}
                className="w-full h-full object-cover group-hover:opacity-95 transition-opacity"
              />
            ) : (
              <span className="font-editorial font-bold text-[#111111] text-[20px] select-none">
                {circle.name.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
        </Link>

        {/* Followers pill + share: starts at mt-5 so it sits fully below the banner */}
        <div className="flex items-center gap-3 mt-5 text-[#111111]/60 text-[12px] font-ui font-medium">
          <div className="flex items-center gap-1 border border-[#EAEAEA] rounded-full pl-0.5 pr-1.5 py-0.5 bg-white">
            {profileCount > 0 && (
              <div className="flex -space-x-1.5">
                {Array.from({ length: profileCount }).map((_, i) => {
                  const avatarUrl = memberAvatars[i];
                  return avatarUrl ? (
                    <img
                      key={i}
                      src={avatarUrl}
                      alt=""
                      className="size-4 rounded-full border border-white object-cover shrink-0"
                    />
                  ) : (
                    <div
                      key={i}
                      className="size-4 rounded-full border border-white bg-[#E0E0E0] text-[#737373] flex items-center justify-center shrink-0 overflow-hidden"
                    >
                      <svg className="size-2.5 fill-current" viewBox="0 0 24 24">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                      </svg>
                    </div>
                  );
                })}
              </div>
            )}
            <span className="leading-none text-[12px]">{formatCount(members)}</span>
          </div>
          <button
            type="button"
            onClick={share}
            aria-label={copied ? "Link copied" : "Share circle"}
            title={copied ? "Link copied to clipboard!" : "Copy link"}
            className="relative cursor-pointer"
          >
            {copied && (
              <span className="absolute -top-7 right-0 bg-[#111111] text-white font-ui text-[10px] px-2 py-0.5 rounded shadow-sm whitespace-nowrap z-20">
                Copied!
              </span>
            )}
            <svg className="size-[18px] stroke-[#111111]/60 hover:stroke-[#111111] transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content area */}
      <div className="px-4 mt-3 flex-1 flex flex-col">
        <Link to={`/c/${circle.slug}`}>
          <h3 className="font-editorial text-[18px] font-semibold leading-none text-[#111111] hover:text-[#E4572E] transition-colors truncate">
            c/{circle.name}
          </h3>
        </Link>
        <p className="font-ui text-[14px] text-[#111111]/60 mt-2 line-clamp-3 leading-[20px] min-h-[60px] mb-2">
          {circle.description}
        </p>
        <div className="mt-auto pt-2 pb-3 flex items-center justify-between border-t border-[#111111]/5">
          <span className="font-ui text-[12px] text-[#111111]/60">{weeklyVisitors}</span>
          <button
            type="button"
            onClick={toggle}
            className={`border rounded-full w-[81px] h-[28px] flex items-center justify-center text-[12px] font-semibold font-ui transition-colors shrink-0 cursor-pointer ${
              joined
                ? "bg-[#E4572E] text-white border-[#E4572E] hover:bg-[#D4441C]"
                : "border-[#111111]/60 text-[#111111] bg-white hover:bg-black/5"
            }`}
          >
            {joined ? "Joined" : "Join"}
          </button>
        </div>
      </div>
    </div>
  );
}

function JobsPromoBanner({ className = "" }: { className?: string } = {}) {
  return (
    <div
      className={`-mx-5 w-[calc(100%+2.5rem)] bg-[#111111] text-white py-8 px-5 overflow-hidden relative shadow-md ${
        className || "-my-5"
      }`}
    >
      <img
        src="/dark_silk_banner_bg.jpg"
        className="absolute inset-0 w-full h-full object-cover opacity-80"
        alt=""
      />
      <div className="absolute inset-0 opacity-50 mix-blend-overlay">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <filter id="noise">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.65"
              numOctaves="3"
              stitchTiles="stitch"
            />
          </filter>
          <rect width="100%" height="100%" filter="url(#noise)" />
        </svg>
      </div>

      <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8 w-full">
        <div>
          <p className="font-ui text-[12px] font-bold uppercase tracking-[0.15em] text-[#E4572E] mb-2.5">
            RECOMMENDED FOR YOU
          </p>
          <h2 className="font-editorial text-[32px] sm:text-[40px] font-normal leading-tight text-white tracking-tight">
            Jobs we think you&apos;ll love
          </h2>
        </div>
        <div className="flex items-center gap-6">
          <button type="button" className="font-ui text-[14px] font-normal text-white hover:text-[#CCCCCC] underline underline-offset-[5px] decoration-white/50 decoration-[1px] cursor-pointer">
            Post a Job
          </button>
          <button type="button" className="rounded-full bg-[#E4572E] text-white font-ui text-[13px] font-medium uppercase tracking-wider px-6 py-2.5 transition-colors hover:bg-[#CC4824] flex items-center gap-2 cursor-pointer shadow-sm">
            EXPLORE JOBS
            <svg
              className="size-[18px]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0l-6-6m6 6l-6 6" />
            </svg>
          </button>
        </div>
      </div>

      {/* Job Cards Grid: spans full width reaching till the end as the explore button is reaching */}
      <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-5 w-full">
        {[
          {
            company: "ATELIER VOSS",
            title: "Senior Knitwear Designer",
            location: "Copenhagen (Hybrid)",
            type: "Full-Time",
          },
          {
            company: "LUMEN STUDIO",
            title: "Textile Sourcing Lead",
            location: "Paris (On-site)",
            type: "Contract",
          },
          {
            company: "CENTOIRE COLLECTIVE",
            title: "Visual Merchandiser",
            location: "New York (On-site)",
            type: "Full-Time",
          },
        ].map((job, i) => (
          <div
            key={i}
            className="bg-white text-[#111111] p-5 flex flex-col justify-between min-h-[120px] shadow-sm"
          >
            <div>
              <p className="font-ui text-[12px] font-bold uppercase tracking-wider text-[#E4572E] mb-1">
                {job.company}
              </p>
              <h3 className="font-editorial text-[17px] font-medium leading-snug tracking-tight text-[#111111]">
                {job.title}
              </h3>
            </div>
            <div className="mt-4 flex items-center justify-between font-ui text-[12px]">
              <div className="flex items-center gap-1.5 text-[#5A5A5A]">
                <svg
                  className="size-[14px]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                  />
                </svg>
                {job.location}
              </div>
              <span className="bg-[#E8E8E8] px-2 py-0.5 text-[11px] font-bold text-[#555555] uppercase tracking-wide">
                {job.type}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "")}k` : String(n);
}

function formatWeeklyVisitors(count: number): string {
  const formatted = formatCount(count);
  return `${formatted} ${count === 1 ? "weekly visitor" : "weekly visitors"}`;
}
