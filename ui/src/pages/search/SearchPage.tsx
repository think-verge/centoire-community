import { useState, useRef, useEffect, Fragment } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { PostDrawer } from "../../components/PostDrawer";
import { PostCard } from "../../components/PostCard";
import { useSearch } from "../../lib/api/generated/search/search";
import { useJoinCircle, useLeaveCircle } from "../../lib/api/generated/circles/circles";
import { useFollowUser, useUnfollowUser } from "../../lib/api/generated/users/users";
import type { PublicUser, Circle as CircleType } from "../../lib/api/generated/model";
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

  const shouldFetch = q.trim().length > 0 || type !== "ALL";
  const { data, isLoading } = useSearch(
    {
      q,
      type: type === "ALL" ? "all" : (type.toLowerCase() as "all" | "posts" | "people" | "circles" | "hashtags"),
    },
    { query: { enabled: shouldFetch } },
  );

  function submit(nextType: SearchType) {
    const next = new URLSearchParams();
    if (q.trim()) next.set("q", q.trim());
    if (nextType !== "ALL") next.set("type", nextType.toLowerCase());
    setParams(next, { replace: true });
  }

  const posts = data?.posts ?? [];
  const people = data?.people ?? [];
  const circles = data?.circles ?? [];
  const hashtags = data?.hashtags ?? [];

  const hasResults =
    data &&
    (posts.length > 0 ||
      people.length > 0 ||
      circles.length > 0 ||
      hashtags.length > 0);

  // Figma: Plus Jakarta Sans, SemiBold 600, 14px, uppercase, 8px gap, 16px side padding
  const pillBase =
    "rounded-full border px-3 py-[5px] sm:px-4 sm:py-[7px] font-ui text-[12px] sm:text-[13px] leading-[16px] sm:leading-[18px] uppercase tracking-normal transition-colors shrink-0 whitespace-nowrap";
  const pillIdle = "bg-white border-[#111111]/20 text-black/60 hover:border-[#111111]/60 font-semibold";
  const pillActive = "bg-[#E4572E] border-[#E4572E] text-white font-bold";

  // Horizontal rails: padding (with matching negative margin) leaves room for the
  // card shadow (0 4 10) so it is never clipped by overflow-x-auto.
  const railClass =
    "flex items-stretch gap-6 overflow-x-auto snap-x scroll-pl-3 hide-scrollbar scroll-smooth px-3 -mx-3 pt-3 -mt-3 pb-5 -mb-5";
  // The post rail needs extra bottom padding (+ matching negative margin) so the 210px three-dots
  // menu and 185px author hover card opening below never get clipped by overflow-x-auto.
  // pointer-events-none on rail container lets clicks on subsequent sections pass through,
  // while pointer-events-auto on cards/menus captures all card & menu interactions.
  const postRailClass =
    "flex items-stretch gap-6 overflow-x-auto snap-x scroll-pl-3 hide-scrollbar scroll-smooth px-3 -mx-3 pt-3 -mt-3 pb-[260px] -mb-[260px] pointer-events-none";
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
          {!q && type === "ALL" && (
            <div className="text-center py-20">
              <h1 className="font-editorial text-[36px] font-normal text-[#111111]">Search Centoire</h1>
              <p className="mt-4 text-[14px] font-ui text-[#737373]">
                Type above to discover posts, circles, people, and topics.
              </p>
            </div>
          )}

          {isLoading && (
            <div className="py-20 text-center text-[#737373] font-ui text-[14px]">
              {q ? "Generating AI insights..." : "Loading directory..."}
            </div>
          )}

          {q && data && !hasResults && !isLoading && (
            <div className="mt-10 rounded-[20px] border border-dashed border-[#EAEAEA] p-12 text-center">
              <p className="font-editorial text-2xl font-semibold text-[#111111]">No results for "{q}"</p>
              <p className="mt-2 text-sm text-[#737373] font-ui">Try a different term or browse Discover.</p>
            </div>
          )}

          {data && hasResults && (q || type !== "ALL") && !isLoading && (
            <div className="flex flex-col gap-6">

              {/* Header Area */}
              <div>
                <p className="font-ui text-[14px] font-bold leading-none uppercase tracking-wider text-[#111111]/60 mb-3">
                  {q ? "AI SEARCH RESULTS FOR" : type === "PEOPLE" ? "DIRECTORY" : "DISCOVER"}
                </p>
                <h1 className="font-editorial text-[28px] font-medium leading-none text-[#111111] tracking-normal mb-5">
                  {q ? q : type === "PEOPLE" ? "Top Voices & Creators" : type === "POSTS" ? "Latest Posts" : "Featured Communities"}
                </h1>

                {/* Source Badge under heading for ALL / POSTS / PEOPLE */}
                <div className="flex items-center gap-2 border border-[#111111]/10 rounded-full pl-0.5 pr-2 py-0.5 w-max">
                  <div className="flex -space-x-1.5">
                    <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50&h=50&fit=crop" className="size-[26px] rounded-full border border-white relative z-30 object-cover" alt="" />
                    <img src="https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=50&h=50&fit=crop" className="size-[26px] rounded-full border border-white relative z-20 object-cover" alt="" />
                    <img src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=50&h=50&fit=crop" className="size-[26px] rounded-full border border-white relative z-10 object-cover" alt="" />
                  </div>
                  <span className="font-ui text-[12px] font-medium text-[#737373]">
                    {type === "PEOPLE" ? "Fashion editors, critics, and creative contributors" : "Source: c/fashion, c/trends +4 more"}
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
              {(type === "ALL" || type === "HASHTAGS") && (
                hashtags.length > 0 ? (
                  <section className="flex flex-col gap-3">
                    <p className="font-ui text-[14px] font-bold uppercase tracking-wider text-[#111111]/60">HASHTAGS</p>
                    <div className="flex flex-wrap gap-2">
                      {hashtags.map((h) => (
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
                ) : type === "HASHTAGS" ? (
                  <div className="rounded-[20px] border border-dashed border-[#EAEAEA] p-12 text-center bg-white">
                    <p className="font-editorial text-xl font-medium text-[#111111]">No hashtags found</p>
                    <p className="mt-2 text-sm text-[#737373] font-ui">Try searching for a different keyword or explore topics.</p>
                  </div>
                ) : null
              )}

              {/* Related Posts */}
              {(type === "ALL" || type === "POSTS") && (
                posts.length > 0 ? (
                  <section className="flex flex-col gap-6 relative z-30">
                    {type === "ALL" && <div className="w-full h-px bg-[#D4D4D4] relative z-0"></div>}
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
                        <div ref={postsRef} onScroll={() => handleScroll(postsRef, 'posts')} className={postRailClass} style={{ scrollbarWidth: 'none' }}>
                          {posts.map((post) => (
                            <div key={post.id} className={`${railItemClass} ${stretchCard} relative hover:z-40 pointer-events-auto`}>
                              <PostCard post={post} onOpenPost={(p) => setSelectedSlug(p.slug)} authorPlacement="bottom" />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className={`${gridClass} !gap-x-6 !gap-y-4`} style={gridStyle}>
                          {posts.map((post) => (
                            <div key={post.id} className={`flex flex-col ${stretchCard} relative hover:z-40`}>
                              <PostCard post={post} onOpenPost={(p) => setSelectedSlug(p.slug)} authorPlacement="bottom" />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>
                ) : type === "POSTS" ? (
                  <div className="rounded-[20px] border border-dashed border-[#EAEAEA] p-12 text-center bg-white">
                    <p className="font-editorial text-xl font-medium text-[#111111]">No posts found</p>
                    <p className="mt-2 text-sm text-[#737373] font-ui">Try a different search term or check all results.</p>
                  </div>
                ) : null
              )}

              {/* Circles */}
              {(type === "ALL" || type === "CIRCLES") && (
                circles.length > 0 ? (
                  <section className="flex flex-col gap-6 relative z-20">
                    {type === "ALL" && <div className="w-full h-px bg-[#D4D4D4] relative z-0"></div>}
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
                          {circles.map((circle, index) => (
                            <div key={`${circle.id}-${index}`} className={`${railItemClass} h-auto`}>
                              <DemoCircleCard circle={circle} />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className={gridClass} style={gridStyle}>
                          {circles.map((circle, index) => (
                            <div key={`${circle.id}-${index}`}>
                              <DemoCircleCard circle={circle} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>
                ) : type === "CIRCLES" ? (
                  <div className="rounded-[20px] border border-dashed border-[#EAEAEA] p-12 text-center bg-white">
                    <p className="font-editorial text-xl font-medium text-[#111111]">No circles found</p>
                    <p className="mt-2 text-sm text-[#737373] font-ui">Try searching for other fashion disciplines or communities.</p>
                  </div>
                ) : null
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
              {(type === "ALL" || type === "PEOPLE") && (
                people.length > 0 ? (
                  <section className="flex flex-col gap-4 relative z-10">
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
                        {people.map((person, index) => (
                          <div key={`${person.id}-${index}`} className={`${railItemClass} h-auto`}>
                            <DemoCreatorCard person={person} />
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className={gridClass} style={gridStyle}>
                        {people.map((person, index) => (
                          <div key={`${person.id}-${index}`} className="flex flex-col h-full">
                            <DemoCreatorCard person={person} />
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                ) : type === "PEOPLE" ? (
                  <div className="rounded-[20px] border border-dashed border-[#EAEAEA] p-12 text-center bg-white">
                    <p className="font-editorial text-xl font-medium text-[#111111]">No creators or people found</p>
                    <p className="mt-2 text-sm text-[#737373] font-ui">Try searching by creator name or handle.</p>
                  </div>
                ) : null
              )}

              {/* Related Topics */}
              {type === "ALL" && (
                <section className="flex flex-col gap-6 relative z-0">
                  <div className="w-full h-px bg-[#D4D4D4] relative z-0"></div>
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
// DYNAMIC INTERACTIVE SEARCH CARDS
// -----------------------------------------------------------------------------

function DemoCircleCard({ circle }: { circle: CircleType }) {
  const queryClient = useQueryClient();
  const [isJoined, setIsJoined] = useState<boolean>(Boolean(circle.viewerRole));
  const [memberCount, setMemberCount] = useState<number>(circle.memberCount ?? 0);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    setIsJoined(Boolean(circle.viewerRole));
    setMemberCount(circle.memberCount ?? 0);
  }, [circle.viewerRole, circle.memberCount]);

  const joinMutation = useJoinCircle({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ["search"] });
        void queryClient.invalidateQueries({ queryKey: ["circles"] });
      },
      onError: () => {
        setIsJoined(false);
        setMemberCount((prev) => Math.max(0, prev - 1));
      },
    },
  });

  const leaveMutation = useLeaveCircle({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ["search"] });
        void queryClient.invalidateQueries({ queryKey: ["circles"] });
      },
      onError: () => {
        setIsJoined(true);
        setMemberCount((prev) => prev + 1);
      },
    },
  });

  const handleToggleJoin = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isJoined) {
      setIsJoined(false);
      setMemberCount((prev) => Math.max(0, prev - 1));
      leaveMutation.mutate({ slug: circle.slug });
    } else {
      setIsJoined(true);
      setMemberCount((prev) => prev + 1);
      joinMutation.mutate({ slug: circle.slug });
    }
  };

  const handleShare = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = `${window.location.origin}/c/${circle.slug}`;
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const circleName = circle.name?.startsWith("c/") ? circle.name : `c/${circle.name || "Community"}`;
  const memberLabel =
    memberCount >= 1000
      ? `${(memberCount / 1000).toFixed(1)}k`
      : `${memberCount}`;

  const weeklyVisitors =
    memberCount >= 1000
      ? `${(memberCount / 500).toFixed(1)}k weekly visitors`
      : `${Math.max(12, memberCount * 3 + 7)} weekly visitors`;

  const circleInitial = (circle.name?.replace(/^c\//, "") || "C").charAt(0).toUpperCase();

  const defaultMemberAvatars = [
    "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=50&h=50&fit=crop",
    "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=50&h=50&fit=crop",
    "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50&h=50&fit=crop",
  ];
  const displayMemberAvatars =
    circle.memberAvatars && circle.memberAvatars.length > 0
      ? circle.memberAvatars.slice(0, 3)
      : defaultMemberAvatars;

  return (
    <div
      className="bg-white rounded-[16px] border border-[#111111]/10 flex flex-col h-full overflow-hidden transition-shadow duration-300"
      style={{ boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.1)" }}
    >
      <div className="relative h-[36px] w-full bg-[#1A1A1A]">
        {circle.coverImageUrl ? (
          <img
            src={circle.coverImageUrl}
            className="h-full w-full object-cover"
            alt=""
          />
        ) : (
          <div className="h-full w-full bg-gradient-to-r from-[#2B2D42] via-[#4A4E69] to-[#22223B]" />
        )}
      </div>

      <div className="px-4 flex justify-between relative -mt-5">
        <Link to={`/c/${circle.slug}`}>
          {circle.avatarUrl ? (
            <img
              src={circle.avatarUrl}
              className="size-14 rounded-full border-2 border-white object-cover shadow-sm bg-white"
              alt=""
            />
          ) : (
            <div className="size-14 rounded-full border-2 border-white bg-[#111111] text-white flex items-center justify-center font-editorial text-xl font-bold shadow-sm">
              {circleInitial}
            </div>
          )}
        </Link>
        <div className="flex items-center gap-3 mt-5 text-[#111111]/60 text-[12px] font-ui font-medium">
          <div className="flex items-center gap-1.5 border border-[#EAEAEA] rounded-full pl-0.5 pr-2.5 py-0.5 bg-white">
            <div className="flex -space-x-1.5">
              {displayMemberAvatars.map((av, i) => (
                <img
                  key={i}
                  src={av}
                  className="size-4 rounded-full border border-white object-cover"
                  alt=""
                />
              ))}
            </div>
            <span>{memberLabel}</span>
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={handleShare}
              title="Share circle"
              className="p-1 -m-1 inline-flex items-center justify-center"
            >
              <svg
                className="size-[18px] stroke-[#111111]/60 hover:stroke-[#111111] transition-colors cursor-pointer"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z"
                />
              </svg>
            </button>
            {copied && (
              <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-[#111111] text-white text-[10px] px-2 py-0.5 rounded shadow whitespace-nowrap z-20">
                Copied!
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="px-4 mt-3 flex-1 flex flex-col">
        <Link to={`/c/${circle.slug}`}>
          <h3 className="font-editorial text-[18px] font-semibold leading-none text-[#111111] hover:underline">
            {circleName}
          </h3>
        </Link>
        <p className="font-ui text-[14px] text-[#111111]/60 mt-2 line-clamp-3 leading-[20px]">
          {circle.description ||
            "A curated community for fashion discussions, collections, and creative critique."}
        </p>
        <div className="mt-auto pt-4 pb-4 flex justify-between items-center">
          <button
            type="button"
            onClick={handleToggleJoin}
            disabled={joinMutation.isPending || leaveMutation.isPending}
            className={`rounded-full w-[81px] h-[28px] flex items-center justify-center text-[12px] font-semibold font-ui transition-all ${
              isJoined
                ? "border border-[#111111] bg-[#111111] text-white hover:bg-black/85"
                : "border border-[#111111]/60 text-[#111111] bg-white hover:bg-black/5"
            }`}
          >
            {isJoined ? "Joined" : "Join"}
          </button>
          <span className="font-ui text-[12px] text-[#111111]/60">
            {weeklyVisitors}
          </span>
        </div>
      </div>
    </div>
  );
}

function DemoCreatorCard({ person }: { person: PublicUser }) {
  const queryClient = useQueryClient();
  const [isFollowing, setIsFollowing] = useState<boolean>(false);
  const [followerCount, setFollowerCount] = useState<number>(person.followerCount ?? 0);

  useEffect(() => {
    setFollowerCount(person.followerCount ?? 0);
  }, [person.followerCount]);

  const followMutation = useFollowUser({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ["search"] });
        void queryClient.invalidateQueries({ queryKey: ["users"] });
      },
      onError: () => {
        setIsFollowing(false);
        setFollowerCount((prev) => Math.max(0, prev - 1));
      },
    },
  });

  const unfollowMutation = useUnfollowUser({
    mutation: {
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: ["search"] });
        void queryClient.invalidateQueries({ queryKey: ["users"] });
      },
      onError: () => {
        setIsFollowing(true);
        setFollowerCount((prev) => prev + 1);
      },
    },
  });

  const handleToggleFollow = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (isFollowing) {
      setIsFollowing(false);
      setFollowerCount((prev) => Math.max(0, prev - 1));
      unfollowMutation.mutate({ id: person.id });
    } else {
      setIsFollowing(true);
      setFollowerCount((prev) => prev + 1);
      followMutation.mutate({ id: person.id });
    }
  };

  const initial = (person.displayName || "C").charAt(0).toUpperCase();

  return (
    <div
      className="bg-white rounded-[16px] border border-[#111111]/10 flex flex-col h-full relative px-4 py-4 transition-shadow duration-300"
      style={{ boxShadow: "0px 4px 10px rgba(0, 0, 0, 0.06)" }}
    >
      <div className="flex items-start">
        <Link to={person.handle ? `/u/${person.handle}` : "#"}>
          {person.avatarUrl ? (
            <img
              src={person.avatarUrl}
              className="size-10 rounded-full object-cover"
              alt=""
            />
          ) : (
            <div className="size-10 rounded-full bg-[#3A76C4] flex items-center justify-center text-white text-xs font-semibold">
              {initial}
            </div>
          )}
        </Link>
      </div>
      <h3 className="font-editorial text-[18px] font-normal text-[#111111] mt-2 flex items-center gap-2">
        <Link
          to={person.handle ? `/u/${person.handle}` : "#"}
          className="hover:underline"
        >
          {person.displayName}
        </Link>
        {person.reputation > 0 || person.followerCount > 100 ? (
          <span className="bg-[#0044CC] text-white text-[10px] font-ui font-bold px-2 py-px rounded-full uppercase tracking-wider">
            VERIFIED
          </span>
        ) : null}
      </h3>
      <p className="font-ui text-[12px] text-[#111111]/60 mt-1 line-clamp-3 leading-[16px] flex-1">
        {person.bio || "Fashion contributor and creative voice."}
      </p>
      <div className="mt-4 flex items-center justify-between">
        <span className="font-ui text-[12px] text-[#111111]/60">
          {followerCount} {followerCount === 1 ? "follower" : "followers"}
        </span>
        <button
          type="button"
          onClick={handleToggleFollow}
          disabled={followMutation.isPending || unfollowMutation.isPending}
          className={`rounded-full w-[81px] h-[28px] flex items-center justify-center text-[12px] font-semibold font-ui transition-all ${
            isFollowing
              ? "border border-[#111111] bg-[#111111] text-white hover:bg-black/85"
              : "border border-[#111111]/60 text-[#111111] bg-white hover:bg-black/5"
          }`}
        >
          {isFollowing ? "Following" : "Follow"}
        </button>
      </div>
    </div>
  );
}
