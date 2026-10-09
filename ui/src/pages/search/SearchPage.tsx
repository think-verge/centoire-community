import { useState, useRef, Fragment } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PostDrawer } from "../../components/PostDrawer";
import { useSearch } from "../../lib/api/generated/search/search";
import { postsLabel } from "../../lib/hashtag";

const TYPES = ["ALL", "PEOPLE", "POSTS", "CIRCLES", "HASHTAGS"] as const;
type SearchType = (typeof TYPES)[number];

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  // Map lowercase from URL to uppercase for our UI, default to ALL
  const paramType = params.get("type")?.toUpperCase() as SearchType | undefined;
  const type = paramType && TYPES.includes(paramType) ? paramType : "ALL";
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const postsRef = useRef<HTMLDivElement>(null);
  const circlesRef = useRef<HTMLDivElement>(null);
  const creatorsRef = useRef<HTMLDivElement>(null);

  const [canScroll, setCanScroll] = useState({
    posts: { left: false, right: true },
    circles: { left: false, right: true },
    creators: { left: false, right: true }
  });

  const scroll = (ref: React.RefObject<HTMLDivElement | null>, direction: 'left' | 'right') => {
    if (ref.current) {
      ref.current.scrollBy({ left: direction === 'left' ? -350 : 350, behavior: 'smooth' });
    }
  };

  const handleScroll = (ref: React.RefObject<HTMLDivElement | null>, key: 'posts' | 'circles' | 'creators') => {
    if (ref.current) {
      const { scrollLeft, scrollWidth, clientWidth } = ref.current;
      setCanScroll(prev => ({
        ...prev,
        [key]: {
          left: scrollLeft > 0,
          right: Math.ceil(scrollLeft) < scrollWidth - clientWidth - 2
        }
      }));
    }
  };

  const { data, isLoading } = useSearch(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { q, type: type === "ALL" ? "all" : type.toLowerCase() as any },
    { query: { enabled: q.trim().length > 0 } },
  );

  function submit(nextType: SearchType) {
    const next = new URLSearchParams();
    if (q.trim()) next.set("q", q.trim());
    if (nextType !== "ALL") next.set("type", nextType.toLowerCase());
    setParams(next, { replace: true });
  }

  const hasResults =
    data &&
    (data.posts.length > 0 ||
      data.people.length > 0 ||
      data.circles.length > 0 ||
      data.hashtags.length > 0);

  const renderPosts = data?.posts ? Array(10).fill(data.posts).flat() : [];
  const renderPeople = data?.people ? Array(10).fill(data.people).flat() : [];
  const finalPeople = Array(10).fill(renderPeople).flat();

  const renderCircles = [
    {
      id: "mock1",
      name: "c/Structural Wefts",
      slug: "structural-wefts",
      description: "A community for advanced algorithmic looms and new weave structures.",
      memberCount: 125,
      postCount: 34,
    },
    {
      id: "mock2",
      name: "c/Technical Luxury",
      slug: "technical-luxury",
      description: "Discussions on the intersection of technical fabrics and luxury fashion.",
      memberCount: 890,
      postCount: 156,
    },
    {
      id: "mock3",
      name: "c/Shanghai Trends",
      slug: "shanghai-trends",
      description: "Tracking the latest from Shanghai Fashion Week and local designers.",
      memberCount: 342,
      postCount: 89,
    }
  ];

  const finalCircles = Array(10).fill(renderCircles).flat();

  // Figma: Plus Jakarta Sans, SemiBold 600, 14px, uppercase, 8px gap, 16px side padding
  const pillBase =
    "rounded-full border px-3 py-[5px] sm:px-4 sm:py-[7px] font-ui text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] uppercase tracking-normal transition-colors shrink-0 whitespace-nowrap";
  const pillIdle = "bg-white border-[#111111]/20 text-black/60 hover:border-[#111111]/60 font-semibold";
  const pillActive = "bg-[#E4572E] border-[#E4572E] text-white font-bold";

  // Horizontal rails: padding (with matching negative margin) leaves room for the
  // card shadow (0 4 10) so it is never clipped by overflow-x-auto.
  const railClass =
    "flex items-stretch gap-6 overflow-x-auto snap-x scroll-pl-3 hide-scrollbar scroll-smooth px-3 -mx-3 pt-3 -mt-3 pb-5 -mb-5";
  const gridClass = "grid gap-6 px-3 -mx-3 py-3 -my-3";
  const gridStyle = { gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" };
  
  // Responsive widths to fit exactly 1 to 30 cards based on the container width:
  const railItemClass = "snap-start shrink-0 flex flex-col w-full " +
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
  const stretchCard = "h-full [&>article]:h-full [&>article]:mb-0 [&>article]:flex [&>article]:flex-col";

  return (
    <div className="flex flex-col min-h-screen bg-[#F0F0F0] w-full">
      <div className="w-full px-5 pt-8 pb-8 flex flex-col gap-6 @container">
        {/* Top filter row */}
        <div className="flex items-start md:items-center justify-between w-full flex-wrap gap-4">
          <div className="flex items-center gap-2 flex-wrap">
            {TYPES.map((value, index) => (
              <Fragment key={value}>
                <button
                  type="button"
                  onClick={() => submit(value)}
                  className={`${pillBase} ${type === value ? pillActive : pillIdle}`}
                >
                  {value}
                </button>
                {index === 0 && <div className="h-[34px] w-px bg-[#C4C4C4]"></div>}
              </Fragment>
            ))}
            <button className={`${pillBase} ${pillIdle} flex items-center gap-1.5`}>
              +4 MORE
              <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button className={`${pillBase} ${pillIdle} flex items-center gap-1.5`}>
              FILTERS
              <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
            </button>
            <button className={`${pillBase} ${pillIdle} flex items-center gap-1.5`}>
              ALL TIME
              <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
            </button>
          </div>
        </div>

        <div className="w-full">
          {!q && (
            <div className="text-center py-20">
              <h1 className="font-editorial text-[36px] font-normal text-[#111111]">Search Centoire</h1>
              <p className="mt-4 text-[14px] font-ui text-[#737373]">
                Type above to discover posts, circles, people, and topics.
              </p>
            </div>
          )}

          {isLoading && q && (
            <div className="py-20 text-center text-[#737373] font-ui text-[14px]">
              Generating AI insights...
            </div>
          )}

          {q && data && !hasResults && (
            <div className="mt-10 rounded-[20px] border border-dashed border-[#EAEAEA] p-12 text-center">
              <p className="font-editorial text-2xl font-semibold text-[#111111]">No results for "{q}"</p>
              <p className="mt-2 text-sm text-[#737373] font-ui">Try a different term or browse Discover.</p>
            </div>
          )}

          {q && data && hasResults && (
            <div className="flex flex-col gap-6">

              {/* Header Area */}
              <div>
                <p className="font-ui text-[14px] font-bold leading-none uppercase tracking-wider text-[#111111]/60 mb-3">
                  AI SEARCH RESULTS FOR
                </p>
                <h1 className="font-editorial text-[28px] font-medium leading-none text-[#111111] tracking-normal mb-5">
                  {q}
                </h1>

                {/* Source Badge under heading for ALL / POSTS / PEOPLE */}
                <div className="flex items-center gap-2 border border-[#111111]/10 rounded-full pl-0.5 pr-2 py-0.5 w-max">
                  <div className="flex -space-x-1.5">
                    <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50&h=50&fit=crop" className="size-[26px] rounded-full border border-white relative z-30 object-cover" alt="" />
                    <img src="https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=50&h=50&fit=crop" className="size-[26px] rounded-full border border-white relative z-20 object-cover" alt="" />
                    <img src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=50&h=50&fit=crop" className="size-[26px] rounded-full border border-white relative z-10 object-cover" alt="" />
                  </div>
                  <span className="font-ui text-[12px] font-medium text-[#737373]">
                    Source: c/fashion, c'trends +4 more
                  </span>
                </div>

                {/* AI Generated Content Block */}
                {type === "ALL" && (
                  <div className="flex flex-col mt-6">
                    <p className="font-ui text-[14px] font-bold leading-none uppercase tracking-wider text-[#111111]/60 mb-3">
                      SUMMARY:
                    </p>
                    <p className="font-ui text-[16px] text-[#333333] leading-[1.6]">
                      In 2026, the paradigm is shifting. By using advanced algorithmic looms, designers are combining traditional coarse flax weaves with incredibly high-density structural wefts.<br />
                      As the season progressed, runway presentations in Shanghai and Beijing emphasized movement, texture, and a new kind of <span className="font-semibold cursor-pointer underline text-[#3A76C4]">technical luxury.</span>
                    </p>
                  </div>
                )}
              </div>

              {/* Hashtags */}
              {(type === "ALL" || type === "HASHTAGS") && data.hashtags.length > 0 && (
                <section className="flex flex-col gap-3">
                  <p className="font-ui text-[14px] font-bold uppercase tracking-wider text-[#111111]/60">HASHTAGS</p>
                  <div className="flex flex-wrap gap-2">
                    {data.hashtags.map((h) => (
                      <Link
                        key={h.name}
                        to={`/hashtag/${h.name}`}
                        className="inline-flex items-center gap-2 rounded-full border border-[#EAEAEA] bg-white px-4 py-2 font-ui text-[14px] font-semibold text-[#111111] hover:border-[#111111]"
                      >
                        #{h.name}
                        <span className="text-[12px] font-medium text-[#8A8A8A]">{postsLabel(h.postCount)}</span>
                      </Link>
                    ))}
                  </div>
                </section>
              )}

              {/* Related Posts */}
              {(type === "ALL" || type === "POSTS") && data.posts.length > 0 && (
                <section className="flex flex-col gap-6">
                  {type === "ALL" && <div className="w-full h-px bg-[#D4D4D4]"></div>}
                  <div className="flex flex-col gap-4">
                    {type === "ALL" && (
                      <SectionHeader
                        label="RELATED POSTS"
                        title="RECOMMENDED FOR YOU"
                        viewAllTo={`/search?q=${q}&type=posts`}
                        canLeft={canScroll.posts.left}
                        canRight={canScroll.posts.right}
                        onLeft={() => scroll(postsRef, 'left')}
                        onRight={() => scroll(postsRef, 'right')}
                      />
                    )}
                    {type === "ALL" ? (
                      <div ref={postsRef} onScroll={() => handleScroll(postsRef, 'posts')} className={railClass} style={{ scrollbarWidth: 'none' }}>
                        {renderPosts.map((post, index) => (
                          <div key={`${post.id}-${index}`} className={`${railItemClass} ${stretchCard}`}>
                            <DemoPostCard post={post} index={index} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className={`${gridClass} !gap-x-6 !gap-y-4`} style={gridStyle}>
                        {renderPosts.map((post, index) => (
                          <div key={`${post.id}-${index}`} className={`flex flex-col ${stretchCard}`}>
                            <DemoPostCard post={post} index={index} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Circles */}
              {(type === "ALL" || type === "CIRCLES") && renderCircles.length > 0 && (
                <section className="flex flex-col gap-6">
                  {type === "ALL" && <div className="w-full h-px bg-[#D4D4D4]"></div>}
                  <div className="flex flex-col gap-4">
                    {type === "ALL" && (
                      <SectionHeader
                        label="CIRCLES"
                        title="RECOMMENDED FOR YOU"
                        viewAllTo={`/search?q=${q}&type=circles`}
                        canLeft={canScroll.circles.left}
                        canRight={canScroll.circles.right}
                        onLeft={() => scroll(circlesRef, 'left')}
                        onRight={() => scroll(circlesRef, 'right')}
                      />
                    )}
                    {type === "ALL" ? (
                      <div ref={circlesRef} onScroll={() => handleScroll(circlesRef, 'circles')} className={railClass} style={{ scrollbarWidth: 'none' }}>
                        {finalCircles.map((circle, index) => (
                          <div key={`${circle.id}-${index}`} className={`${railItemClass} h-auto`}>
                            <DemoCircleCard circle={circle} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className={gridClass} style={gridStyle}>
                        {finalCircles.map((circle, index) => (
                          <div key={`${circle.id}-${index}`}>
                            <DemoCircleCard circle={circle} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>
              )}

              {/* Featured Jobs */}
              {type === "ALL" && (
                <section className="w-full">
                  <div className="bg-[#111111] py-12 px-8 sm:px-12 text-white flex flex-col md:flex-row items-start md:items-center justify-between relative overflow-hidden min-h-[220px]">
                    <img src="/dark_silk_banner_bg.jpg" className="absolute inset-0 w-full h-full object-cover opacity-80" alt="" />
                    <div className="absolute inset-0 opacity-50 mix-blend-overlay">
                      <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                        <filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" /></filter>
                        <rect width="100%" height="100%" filter="url(#noise)" />
                      </svg>
                    </div>
                    <div className="relative z-10 flex flex-col gap-3 w-full md:max-w-[60%]">
                      <p className="font-ui text-[11px] font-bold uppercase tracking-widest text-[#E5552D]">FIND YOUR NEXT ROLE IN FASHION</p>
                      <h3 className="font-editorial text-[42px] sm:text-[40px] font-normal tracking-tight leading-[1.05]">Featured Jobs</h3>
                      <p className="font-ui text-[14px] text-[#A3A3A3] leading-relaxed">Browse curated openings at top brands, studios, and agencies - updated daily.</p>
                    </div>
                    <div className="relative z-10 mt-8 md:mt-0 shrink-0 self-start md:self-auto">
                      <button className="bg-[#E5552D] text-white rounded-full px-8 py-3.5 font-ui text-[13px] font-bold uppercase tracking-wider flex items-center gap-2 hover:bg-[#D4441C] transition-colors">
                        VIEW JOBS
                        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                      </button>
                    </div>
                  </div>
                </section>
              )}

              {/* Creators (People) */}
              {(type === "ALL" || type === "PEOPLE") && data.people.length > 0 && (
                <section className="flex flex-col gap-4">
                  {type === "ALL" && (
                    <SectionHeader
                      label="CREATORS"
                      title="TOP VOICES"
                      viewAllTo={`/search?q=${q}&type=people`}
                      canLeft={canScroll.creators.left}
                      canRight={canScroll.creators.right}
                      onLeft={() => scroll(creatorsRef, 'left')}
                      onRight={() => scroll(creatorsRef, 'right')}
                    />
                  )}
                  {type === "ALL" ? (
                    <div ref={creatorsRef} onScroll={() => handleScroll(creatorsRef, 'creators')} className={railClass} style={{ scrollbarWidth: 'none' }}>
                      {finalPeople.map((person, index) => (
                        <div key={`${person.id}-${index}`} className={`${railItemClass} h-auto`}>
                          <DemoCreatorCard person={person} />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className={gridClass} style={gridStyle}>
                      {finalPeople.map((person, index) => (
                        <div key={`${person.id}-${index}`} className="flex flex-col h-full">
                          <DemoCreatorCard person={person} />
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* Related Topics */}
              {type === "ALL" && (
                <section className="flex flex-col gap-6">
                  <div className="w-full h-px bg-[#D4D4D4]"></div>
                  <div className="flex flex-col gap-4">
                    <div className="flex flex-col gap-1">
                      <p className="font-ui text-[12px] leading-[15px] font-bold uppercase tracking-wider text-[#E4572E]">
                        RELATED TOPICS
                      </p>
                      <h3 className="font-ui text-[20px] font-bold leading-[1.9] uppercase tracking-normal text-[#111111]">Explore adjacent themes</h3>
                      <p className="font-ui text-[14px] text-[#737373]">Broaden your discovery with topics that are closely related to your search.</p>
                    </div>
                    <div className="flex flex-wrap gap-2.5">
                      {["Shanghai Fashion Week", "Chinese Designers", "Beijing Street Style", "Runway Trends", "Knitwear", "Accessories", "Collections", "Emerging Brands"].map(topic => (
                        <button key={topic} className="rounded-full bg-white border border-[#111111]/10 px-4 py-2.5 font-ui text-[14px] font-medium text-[#111111]/60 leading-none tracking-[0.5px] hover:border-[#111111]/30 transition-colors">
                          {topic}
                        </button>
                      ))}
                    </div>
                  </div>
                </section>
              )}

            </div>
          )}
        </div>
      </div>

      {selectedSlug && (
        <PostDrawer slug={selectedSlug} onClose={() => setSelectedSlug(null)} />
      )}
    </div>
  );
}

// Section heading: eyebrow label + title row separated by a 4px gap (Figma "Frame / gap 4px")
function SectionHeader({
  label,
  title,
  viewAllTo,
  canLeft,
  canRight,
  onLeft,
  onRight,
}: {
  label: string;
  title: string;
  viewAllTo: string;
  canLeft: boolean;
  canRight: boolean;
  onLeft: () => void;
  onRight: () => void;
}) {
  const arrowClass = (enabled: boolean) =>
    `size-[36px] shrink-0 rounded-full bg-white border flex items-center justify-center transition-colors ${enabled ? 'border-[#111111]/10 text-[#111111] hover:bg-black/5' : 'border-[#111111]/5 text-[#111111]/60'}`;
  return (
    <div className="flex flex-col gap-1 w-full">
      <p className="font-ui text-[12px] leading-[15px] font-bold uppercase tracking-wider text-[#E4572E]">
        {label}
      </p>
      <div className="flex flex-wrap items-center justify-between gap-y-2 gap-x-4">
        <h2 className="font-ui text-[20px] font-bold leading-none uppercase tracking-normal text-[#111111] flex flex-wrap items-baseline gap-3">
          {title}
          <Link to={viewAllTo} className="font-ui text-[14px] font-medium text-[#111111]/60 hover:text-[#111111] underline underline-offset-[2px] decoration-[#111111]/30 hover:decoration-[#111111] normal-case whitespace-nowrap relative -top-[3px]">View all</Link>
        </h2>
        <div className="flex gap-2">
          <button onClick={onLeft} disabled={!canLeft} className={arrowClass(canLeft)}>
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button onClick={onRight} disabled={!canRight} className={arrowClass(canRight)}>
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// -----------------------------------------------------------------------------
// INLINE DEMO CARDS TO MATCH FIGMA SCREENSHOTS EXACTLY
// -----------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DemoPostCard({ post, index }: { post: any, index?: number }) {
  const variant = (index ?? 0) % 3;
  return (
    <article className="group break-inside-avoid overflow-hidden rounded-[16px] bg-white flex flex-col flex-1 min-h-[320px] h-full transition-shadow duration-300" style={{ boxShadow: '0px 4px 10px rgba(17, 17, 17, 0.1)' }}>
      <div className="relative h-[158px] w-full shrink-0">
        <img
          src={post.coverImageUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&h=300&fit=crop"}
          alt=""
          className="h-full w-full object-cover"
        />
        {variant !== 1 && (
          <div className="absolute top-2 right-2 bg-[#00C365] text-white rounded-full px-2 py-0.5 text-[12px] font-medium font-ui flex items-center gap-1 shadow-sm">
            {variant === 2 ? (
              <>
                <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                Centoire Pick
              </>
            ) : (
              <>
                <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z" /></svg>
                Hot
              </>
            )}
          </div>
        )}
        {variant === 1 && (
          <div className="absolute bottom-2 left-2 bg-[#111111]/40 backdrop-blur-md text-white rounded-full px-2.5 py-[2px] text-[12px] font-medium font-ui flex items-center gap-1.5 shadow-sm">
            <span className="size-1.5 rounded-full bg-[#3CCBFF]"></span>
            Street Style
          </div>
        )}
        {variant === 2 && (
          <div className="absolute bottom-2 left-2 bg-[#111111]/40 backdrop-blur-md text-white rounded-full px-2.5 py-[2px] text-[12px] font-medium font-ui flex items-center gap-1.5 shadow-sm">
            <span className="size-1.5 rounded-full bg-[#FF6B00]"></span>
            Knitwear
          </div>
        )}
      </div>
      <div className="p-3 flex flex-col flex-1 gap-1">
        <p className="text-[12px] font-ui text-[#737373] flex items-center">
          12 Sep 24 
          <span className="w-[3px] h-[3px] rounded-full bg-[#111111]/30 mx-2 block"></span> 
          4 min read
        </p>
        <h3 
          className="mt-1 font-editorial text-[20px] font-medium leading-tight text-[#111111] line-clamp-3 h-[75px]"
          dangerouslySetInnerHTML={{ __html: (post.title || "The New Minimalist Runway: 5 Trends to Know Now").replace(/&amp;amp;/g, '&').replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"') }}
        />
        <div className="mt-auto pt-3 flex items-center justify-between border-t border-[#EAEAEA] border-opacity-60">
          <div className="flex items-center gap-2.5">
            {variant === 0 ? (
              <div className="size-8 rounded-full bg-[#3A76C4] text-white flex items-center justify-center font-ui font-semibold text-[14px]">
                E
              </div>
            ) : (
              <div className="size-8 shrink-0 rounded-full bg-[#EAEAEA] text-[#111111]/60 flex items-center justify-center">
                <svg className="size-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-[#111111]/60 text-[14px] font-ui font-semibold">
              <svg className="size-[14px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 11l7-7m0 0l7 7m-7-7v16" /></svg>
              1.2k
            </div>
            <div className="flex items-center gap-1.5 text-[#111111]/60 text-[14px] font-ui font-semibold">
              <svg className="size-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              48
            </div>
          </div>
          <div className="flex items-center gap-2 text-[#111111]/60">
            <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h.01M12 12h.01M19 12h.01M6 12a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0zm7 0a1 1 0 11-2 0 1 1 0 012 0z" /></svg>
            <div className="border border-[#EAEAEA] rounded-[8px] p-1">
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DemoCircleCard({ circle }: { circle: any }) {
  return (
    <div className="bg-white rounded-[16px] border border-[#111111]/10 flex flex-col h-full overflow-hidden transition-shadow duration-300" style={{ boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.1)' }}>
      <img src="https://images.unsplash.com/photo-1483985988355-763728e1935b?w=500&h=100&fit=crop" className="h-[36px] w-full object-cover" alt="" />
      <div className="px-4 flex justify-between relative -mt-5">
        <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop" className="size-14 rounded-full border-2 border-white object-cover shadow-sm bg-white" alt="" />
        <div className="flex items-center gap-3 mt-5 text-[#111111]/60 text-[12px] font-ui font-medium">
          <div className="flex items-center gap-1.5 border border-[#EAEAEA] rounded-full pl-0.5 pr-2.5 py-0.5 bg-white">
            <div className="flex -space-x-1.5">
              <img src="https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=50&h=50&fit=crop" className="size-4 rounded-full border border-white" />
              <img src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=50&h=50&fit=crop" className="size-4 rounded-full border border-white" />
              <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50&h=50&fit=crop" className="size-4 rounded-full border border-white" />
            </div>
            <span>14.2k</span>
          </div>
          <svg className="size-[18px] ml-1 stroke-[#111111]/60 hover:stroke-[#111111] transition-colors cursor-pointer" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
        </div>
      </div>
      <div className="px-4 mt-3 flex-1 flex flex-col">
        <h3 className="font-editorial text-[18px] font-semibold leading-none text-[#111111]">{circle.name}</h3>
        <p className="font-ui text-[14px] text-[#111111]/60 mt-2 line-clamp-3 leading-[20px]">{circle.description}</p>
        <div className="mt-auto pt-4 pb-4 flex justify-between items-center">
          <button className="border border-[#111111]/60 text-[#111111] rounded-full w-[81px] h-[28px] flex items-center justify-center text-[12px] font-semibold font-ui hover:bg-black/5 transition-colors">
            Join
          </button>
          <span className="font-ui text-[12px] text-[#111111]/60">2.6k weekly visitors</span>
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DemoCreatorCard({ person }: { person: any }) {
  return (
    <div className="bg-white rounded-[16px] border border-[#111111]/10 flex flex-col h-full relative px-3 py-3 transition-shadow duration-300" style={{ boxShadow: '0px 4px 10px rgba(0, 0, 0, 0.1)' }}>
      <div className="flex items-start">
        <img src={person.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop"} className="size-8 rounded-full object-cover" alt="" />
      </div>
      <h3 className="font-editorial text-[18px] font-normal text-[#111111] mt-1 flex items-center gap-2">
        {person.displayName}
        <span className="bg-[#0044CC] text-white text-[10px] font-ui font-bold px-2 py-px rounded-full uppercase tracking-wider">VERIFIED</span>
      </h3>
      <p className="font-ui text-[12px] text-[#111111]/60 mt-1 line-clamp-3 leading-[16px] flex-1">
        Senior fashion editor covering Shanghai Fashion Week and the next generation of Chinese designers.
      </p>
      <div className="mt-3 flex items-center justify-between">
        <span className="font-ui text-[12px] text-[#111111]/60">12.4k followers</span>
        <button className="border border-[#111111]/60 text-[#111111] rounded-full w-[81px] h-[28px] flex items-center justify-center text-[12px] font-semibold font-ui hover:bg-black/5 transition-colors">
          Follow
        </button>
      </div>
    </div>
  );
}
