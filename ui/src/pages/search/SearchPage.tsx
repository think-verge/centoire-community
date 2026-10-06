import { useState, Fragment, useRef } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { SparkleIcon } from "../../components/nav/icons";
import { PostDrawer } from "../../components/PostDrawer";
import { useSearch } from "../../lib/api/generated/search/search";

const TYPES = ["ALL", "PEOPLE", "POSTS", "CIRCLES"] as const;
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
      data.tags.length > 0);

  const renderPosts = data?.posts ? [...data.posts, ...data.posts, ...data.posts] : [];
  const renderPeople = data?.people ? [...data.people, ...data.people, ...data.people] : [];
  const finalPeople = [...renderPeople, ...renderPeople, ...renderPeople];

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

  const finalCircles = [...renderCircles, ...renderCircles, ...renderCircles];

  return (
    <div className="flex flex-col min-h-screen bg-[#F0F0F0] w-full">
      <div className="w-full px-5 pt-8 pb-4 flex flex-col gap-6">
        {/* Top filter row */}
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2 flex-wrap">
            {TYPES.map((value, index) => (
              <Fragment key={value}>
                <button
                  type="button"
                  onClick={() => submit(value)}
                  className={`rounded-full px-5 py-1.5 font-ui text-[14px] font-bold uppercase tracking-wider transition-colors border ${
                    type === value
                      ? "bg-[#E5552D] border-[#E5552D] text-white"
                      : "bg-white border-[#EAEAEA] text-[#555555] hover:border-[#111111]"
                  }`}
                >
                  {value}
                </button>
                {index === 0 && <div className="h-8 w-px bg-[#D0D0D0] mx-1"></div>}
              </Fragment>
            ))}
            <button className="rounded-full bg-white border border-[#EAEAEA] text-[#555555] hover:border-[#111111] px-5 py-1.5 font-ui text-[14px] font-bold uppercase tracking-wider transition-colors">
              TAGS
            </button>
            <button className="rounded-full bg-white border border-[#EAEAEA] text-[#555555] hover:border-[#111111] px-5 py-1.5 font-ui text-[14px] font-bold uppercase tracking-wider transition-colors flex items-center gap-1.5">
              +4 MORE
              <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
            </button>
          </div>
          <div className="flex items-center gap-3 hidden sm:flex">
            <button className="rounded-full border border-[#EAEAEA] bg-white text-[#555555] px-4 py-1.5 flex items-center gap-1.5 font-ui text-[14px] font-bold uppercase tracking-wider hover:border-[#111111]">
              FILTERS
              <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
            </button>
            <button className="rounded-full border border-[#EAEAEA] bg-white text-[#555555] px-4 py-1.5 flex items-center gap-1.5 font-ui text-[14px] font-bold uppercase tracking-wider hover:border-[#111111]">
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
          <div className="flex flex-col gap-12">
            
            {/* Header Area */}
            <div className={type !== "ALL" ? "-mb-10 relative z-10" : ""}>
              <p className="font-ui text-[13px] font-bold uppercase tracking-wider text-[#555555] mb-2.5">
                AI SEARCH RESULTS FOR
              </p>
              <h1 className="font-editorial text-[36px] font-normal leading-tight text-[#111111] tracking-tight mb-4">
                {q}
              </h1>

              {/* Source Badge under heading for ALL / POSTS / PEOPLE */}
              <div className="flex items-center gap-2 border border-[#C0C0C0] rounded-full pl-1 pr-3 py-1 w-max mb-6">
                <div className="flex -space-x-1.5">
                  <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50&h=50&fit=crop" className="size-6 rounded-full border-2 border-white relative z-30 object-cover" alt=""/>
                  <img src="https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=50&h=50&fit=crop" className="size-6 rounded-full border-2 border-white relative z-20 object-cover" alt=""/>
                  <img src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=50&h=50&fit=crop" className="size-6 rounded-full border-2 border-white relative z-10 object-cover" alt=""/>
                </div>
                <span className="font-ui text-[12px] font-medium text-[#737373]">
                  Source: c/fashion, c/trends + 4 more
                </span>
              </div>

              {/* AI Generated Content Block */}
              {type === "ALL" && (
                <div className="flex flex-col gap-4 -mb-8 relative z-10">

                  <p className="font-ui text-[16px] text-[#333333] leading-[1.6]">
                    In 2026, the paradigm is shifting. By using advanced algorithmic looms, designers are combining traditional coarse flax weaves with incredibly high-density structural wefts.<br/>
                    As the season progressed, runway presentations in Shanghai and Beijing emphasized movement, texture, and a new kind of <span className="text-[#3A76C4] font-medium cursor-pointer underline">technical luxury</span>.
                  </p>

                  <div className="bg-white border border-[#EAEAEA] rounded-[16px] p-5 mt-2">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <p className="font-ui text-[12px] text-[#737373] mb-1.5">
                          Sourced from <span className="text-[#3A76C4] cursor-pointer underline">Structural Wefts Circle</span>
                        </p>
                        <p className="font-ui text-[14px] text-[#333333]">
                          "The heavy, architectural drape is intentional — it breathes without losing shape."
                        </p>
                        <p className="font-ui text-[12px] text-[#737373] mt-2">
                          Quoted by <span className="text-[#3A76C4] font-medium cursor-pointer underline">Maya Chen</span>
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-ui text-[12px] text-[#A3A3A3]">
                          125 contributors
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mb-2">
                    <button className="font-ui text-[11px] font-bold uppercase tracking-wider text-[#E5552D] hover:opacity-80 flex items-center gap-1.5 mt-2">
                      <SparkleIcon className="size-[14px]" />
                      SEE MORE
                      <svg className="size-[12px] ml-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7" /></svg>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Related Posts */}
            {(type === "ALL" || type === "POSTS") && data.posts.length > 0 && (
              <section className="-mb-6 relative z-0">
                {type === "ALL" && (
                  <>
                    <div className="w-full h-px bg-[#D0D0D0] mt-0 mb-4"></div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-ui text-[11px] font-semibold uppercase tracking-widest text-[#E5552D]">
                        RELATED POSTS
                      </p>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="font-ui text-[14px] font-bold uppercase tracking-widest text-[#111111] flex items-center">
                        RECOMMENDED FOR YOU 
                        <Link to={`/search?q=${q}&type=posts`} className="font-ui text-[12px] text-[#555555] hover:text-[#111111] underline ml-3 capitalize font-normal">View all</Link>
                      </h2>
                      <div className="flex gap-2">
                        <button onClick={() => scroll(postsRef, 'left')} disabled={!canScroll.posts.left} className={`size-8 rounded-full bg-white border flex items-center justify-center transition-colors ${canScroll.posts.left ? 'border-[#EAEAEA] text-[#111111] hover:bg-gray-50' : 'border-transparent text-[#D0D0D0]'}`}>
                          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <button onClick={() => scroll(postsRef, 'right')} disabled={!canScroll.posts.right} className={`size-8 rounded-full bg-white border flex items-center justify-center transition-colors ${canScroll.posts.right ? 'border-[#EAEAEA] text-[#111111] hover:bg-gray-50' : 'border-transparent text-[#D0D0D0]'}`}>
                          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                        </button>
                      </div>
                    </div>
                  </>
                )}
                
                {type === "ALL" ? (
                  <div ref={postsRef} onScroll={() => handleScroll(postsRef, 'posts')} className="flex gap-4 overflow-x-auto snap-x hide-scrollbar scroll-smooth py-6 -my-6" style={{ scrollbarWidth: 'none' }}>
                    {renderPosts.map((post, index) => (
                      <div key={`${post.id}-${index}`} className="w-[270px] snap-start shrink-0 flex flex-col h-full [&>article]:h-full [&>article]:mb-0 [&>article]:flex [&>article]:flex-col">
                        <DemoPostCard post={post} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-4 py-4 -my-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))' }}>
                    {renderPosts.map((post, index) => (
                      <div key={`${post.id}-${index}`} className="flex flex-col h-full [&>article]:h-full [&>article]:mb-0 [&>article]:flex [&>article]:flex-col">
                        <DemoPostCard post={post} />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Circles */}
            {(type === "ALL" || type === "CIRCLES") && renderCircles.length > 0 && (
              <section className="-mb-8 relative z-0">
                {type === "ALL" && (
                  <>
                    <div className="w-full h-px bg-[#D0D0D0] mt-0 mb-4"></div>
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-ui text-[11px] font-semibold uppercase tracking-widest text-[#E5552D]">
                        CIRCLES
                      </p>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="font-ui text-[14px] font-bold uppercase tracking-widest text-[#111111] flex items-center">
                        RECOMMENDED FOR YOU
                        <Link to={`/search?q=${q}&type=circles`} className="font-ui text-[12px] text-[#555555] hover:text-[#111111] underline ml-3 capitalize font-normal">View all</Link>
                      </h2>
                      <div className="flex gap-2">
                        <button onClick={() => scroll(circlesRef, 'left')} disabled={!canScroll.circles.left} className={`size-8 rounded-full bg-white border flex items-center justify-center transition-colors ${canScroll.circles.left ? 'border-[#EAEAEA] text-[#111111] hover:bg-gray-50' : 'border-transparent text-[#D0D0D0]'}`}>
                          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <button onClick={() => scroll(circlesRef, 'right')} disabled={!canScroll.circles.right} className={`size-8 rounded-full bg-white border flex items-center justify-center transition-colors ${canScroll.circles.right ? 'border-[#EAEAEA] text-[#111111] hover:bg-gray-50' : 'border-transparent text-[#D0D0D0]'}`}>
                          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                        </button>
                      </div>
                    </div>
                  </>
                )}
                {type === "ALL" ? (
                  <div ref={circlesRef} onScroll={() => handleScroll(circlesRef, 'circles')} className="flex gap-4 overflow-x-auto snap-x hide-scrollbar scroll-smooth py-6 -my-6" style={{ scrollbarWidth: 'none' }}>
                    {finalCircles.map((circle, index) => (
                      <div key={`${circle.id}-${index}`} className="w-[270px] snap-start shrink-0">
                        <DemoCircleCard circle={circle} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-4 py-4 -my-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))' }}>
                    {finalCircles.map((circle, index) => (
                      <div key={`${circle.id}-${index}`}>
                        <DemoCircleCard circle={circle} />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Featured Jobs */}
            {type === "ALL" && (
              <section className="w-full mt-2 -mb-6 relative z-0">
                <div className="bg-[#111111] py-12 px-8 sm:px-12 text-white flex flex-col md:flex-row items-center justify-between relative overflow-hidden min-h-[220px]">
                  <img src="/dark_silk_banner_bg.jpg" className="absolute inset-0 w-full h-full object-cover opacity-80" alt="" />
                  <div className="absolute inset-0 opacity-50 mix-blend-overlay">
                    <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
                      <filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" /></filter>
                      <rect width="100%" height="100%" filter="url(#noise)" />
                    </svg>
                  </div>
                  <div className="relative z-10 flex flex-col gap-2 max-w-[60%]">
                    <p className="font-ui text-[11px] font-bold uppercase tracking-widest text-[#E5552D] mb-1">FIND YOUR NEXT ROLE IN FASHION</p>
                    <h3 className="font-editorial text-[36px] sm:text-[40px] font-normal tracking-tight leading-tight">Featured Jobs</h3>
                    <p className="font-ui text-[14px] text-[#A3A3A3] leading-relaxed mt-1">Browse curated openings at top brands, studios, and agencies - updated daily.</p>
                  </div>
                  <div className="relative z-10 mt-6 md:mt-0 shrink-0">
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
              <section className="-mb-5 relative z-0">
                {type === "ALL" && (
                  <>
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-ui text-[11px] font-semibold uppercase tracking-widest text-[#E5552D]">
                        CREATORS
                      </p>
                    </div>
                    <div className="flex items-center justify-between mb-2">
                      <h2 className="font-ui text-[14px] font-bold uppercase tracking-widest text-[#111111] flex items-center">
                        TOP VOICES
                        <Link to={`/search?q=${q}&type=people`} className="font-ui text-[12px] text-[#555555] hover:text-[#111111] underline ml-3 capitalize font-normal">View all</Link>
                      </h2>
                      <div className="flex gap-2">
                        <button onClick={() => scroll(creatorsRef, 'left')} disabled={!canScroll.creators.left} className={`size-8 rounded-full bg-white border flex items-center justify-center transition-colors ${canScroll.creators.left ? 'border-[#EAEAEA] text-[#111111] hover:bg-gray-50' : 'border-transparent text-[#D0D0D0]'}`}>
                          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
                        </button>
                        <button onClick={() => scroll(creatorsRef, 'right')} disabled={!canScroll.creators.right} className={`size-8 rounded-full bg-white border flex items-center justify-center transition-colors ${canScroll.creators.right ? 'border-[#EAEAEA] text-[#111111] hover:bg-gray-50' : 'border-transparent text-[#D0D0D0]'}`}>
                          <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
                        </button>
                      </div>
                    </div>
                  </>
                )}
                
                {type === "ALL" ? (
                  <div ref={creatorsRef} onScroll={() => handleScroll(creatorsRef, 'creators')} className="flex gap-4 overflow-x-auto snap-x hide-scrollbar scroll-smooth py-6 -my-6" style={{ scrollbarWidth: 'none' }}>
                    {finalPeople.map((person, index) => (
                      <div key={`${person.id}-${index}`} className="w-[270px] snap-start shrink-0 flex flex-col h-full">
                        <DemoCreatorCard person={person} />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid gap-4 py-4 -my-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))' }}>
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
              <section className="-mt-2 pb-0 relative z-10">
                <div className="w-full h-px bg-[#D0D0D0] mb-4 mt-0"></div>
                <div className="flex items-center justify-between mb-2">
                  <p className="font-ui text-[11px] font-semibold uppercase tracking-widest text-[#E5552D]">
                    RELATED TOPICS
                  </p>
                </div>
                <h3 className="font-editorial text-[32px] tracking-tight text-[#111111] mb-1">Explore adjacent themes</h3>
                <p className="font-ui text-[14px] text-[#737373] mb-6">Broaden your discovery with topics that are closely related to your search.</p>
                <div className="flex flex-wrap gap-2.5">
                  {["Shanghai Fashion Week", "Chinese Designers", "Beijing Street Style", "Runway Trends", "Knitwear", "Accessories", "Collections", "Emerging Brands"].map(topic => (
                    <button key={topic} className="rounded-full bg-white border border-[#EAEAEA] px-5 py-2.5 font-ui text-[13px] font-medium text-[#555555] hover:border-[#111111] transition-colors">
                      {topic}
                    </button>
                  ))}
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

// -----------------------------------------------------------------------------
// INLINE DEMO CARDS TO MATCH FIGMA SCREENSHOTS EXACTLY
// -----------------------------------------------------------------------------

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DemoPostCard({ post }: { post: any }) {
  return (
    <article className="group break-inside-avoid overflow-hidden rounded-[16px] border border-[#EAEAEA] bg-[#FAFAFA] shadow-lg flex flex-col flex-1 h-full">
      <div className="relative h-[180px] w-full shrink-0">
        <img
          src={post.coverImageUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=500&h=300&fit=crop"}
          alt=""
          className="h-full w-full object-cover"
        />
        <div className="absolute top-3 right-3 bg-[#00C365] text-white rounded-full px-2 py-0.5 text-[10px] font-bold font-ui tracking-wide flex items-center gap-1 shadow-sm">
          <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" /></svg>
          Hot
        </div>
      </div>
      <div className="p-4 flex flex-col flex-1">
        <p className="text-[11px] font-ui text-[#737373] mb-2">12 Sep 24 • 4 min read</p>
        <h3 className="font-editorial text-[20px] leading-tight text-[#111111] font-normal line-clamp-3">
          The New Minimalist Runway: 5 Trends to Know Now
        </h3>
        <div className="mt-auto pt-4 flex items-center justify-between border-t border-[#EAEAEA] border-opacity-60">
          <div className="flex items-center gap-3">
            <div className="size-6 rounded-full bg-[#3A76C4] text-white flex items-center justify-center font-ui font-bold text-[10px]">
              E
            </div>
            <div className="flex items-center gap-1 text-[#737373] text-[12px] font-ui font-medium">
              <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" /></svg>
              1.2k
            </div>
            <div className="flex items-center gap-1 text-[#737373] text-[12px] font-ui font-medium">
              <svg className="size-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              48
            </div>
          </div>
          <div className="flex items-center gap-2 text-[#737373]">
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
    <div className="bg-white rounded-[16px] border border-[#EAEAEA] shadow-lg flex flex-col h-full overflow-hidden min-h-[220px]">
      <img src="https://images.unsplash.com/photo-1483985988355-763728e1935b?w=500&h=100&fit=crop" className="h-[44px] w-full object-cover" alt="" />
      <div className="px-5 flex justify-between relative -mt-5">
        <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&h=100&fit=crop" className="size-14 rounded-full border-2 border-white object-cover shadow-sm bg-white" alt="" />
        <div className="flex items-center gap-2 mt-6 text-[#737373] text-[11px] font-ui font-medium">
          <div className="flex -space-x-1.5">
             <img src="https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=50&h=50&fit=crop" className="size-4 rounded-full border border-white" />
             <img src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=50&h=50&fit=crop" className="size-4 rounded-full border border-white" />
             <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50&h=50&fit=crop" className="size-4 rounded-full border border-white" />
          </div>
          {circle.memberCount}
          <svg className="size-3.5 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
        </div>
      </div>
      <div className="px-5 mt-4 flex-1 flex flex-col">
        <h3 className="font-editorial text-[18px] font-normal leading-tight text-[#111111]">{circle.name}</h3>
        <p className="font-ui text-[12px] text-[#737373] mt-2 line-clamp-2 leading-relaxed">{circle.description}</p>
        <div className="mt-auto pt-4 pb-4 flex justify-between items-center">
          <button className="border border-[#111111] text-[#111111] rounded-full px-5 py-1 text-[11px] font-bold font-ui uppercase tracking-wider hover:bg-[#111111] hover:text-white transition-colors">
            Join
          </button>
          <span className="font-ui text-[11px] text-[#737373]">{circle.postCount} posts</span>
        </div>
      </div>
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function DemoCreatorCard({ person }: { person: any }) {
  return (
    <div className="bg-white rounded-[16px] border border-[#EAEAEA] shadow-lg px-5 py-4 flex flex-col h-full relative">
      <div className="flex items-start">
         <img src={person.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&h=200&fit=crop"} className="size-10 rounded-full object-cover" alt="" />
      </div>
      <h3 className="font-editorial text-[18px] font-normal text-[#111111] mt-2 flex items-center gap-2">
        {person.displayName}
        <span className="bg-[#0057FF] text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">VERIFIED</span>
      </h3>
      <p className="font-ui text-[12px] text-[#737373] mt-1 line-clamp-2 leading-relaxed flex-1">
        Senior fashion editor covering Shanghai Fashion Week and the next generation of Chinese designers.
      </p>
      <div className="mt-3 flex items-center justify-between">
        <span className="font-ui text-[12px] text-[#737373]">48 followers</span>
        <button className="border border-[#111111] text-[#111111] rounded-full px-5 py-1 text-[11px] font-bold font-ui uppercase tracking-wider hover:bg-[#111111] hover:text-white transition-colors">
          Follow
        </button>
      </div>
    </div>
  );
}
