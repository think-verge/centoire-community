import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AvatarBubble } from "../../components/AppShell";
import { PostCard } from "../../components/PostCard";
import { CircleCard } from "../../pages/circles/CirclesPage";
import { PostDrawer } from "../../components/PostDrawer";
import { useSearch } from "../../lib/api/generated/search/search";
import type { PostCard as PostCardType } from "../../lib/api/generated/model";

const TYPES = ["ALL", "PEOPLE", "POSTS", "CIRCLES"] as const;
type SearchType = (typeof TYPES)[number];

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") ?? "";
  // Map lowercase from URL to uppercase for our UI, default to ALL
  const paramType = params.get("type")?.toUpperCase() as SearchType | undefined;
  const type = paramType && TYPES.includes(paramType) ? paramType : "ALL";
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const { data, isLoading } = useSearch(
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

  return (
    <div className="flex flex-col min-h-screen">
      {/* Top filter row */}
      <div className="sticky top-[56px] z-30 bg-white border-b border-[#EAEAEA] px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {TYPES.map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => submit(value)}
              className={`rounded-full px-5 py-1.5 font-ui text-[12px] font-bold uppercase tracking-wider transition-colors border ${
                type === value
                  ? "bg-[#E5552D] border-[#E5552D] text-white"
                  : "bg-white border-[#EAEAEA] text-[#555555] hover:border-[#111111]"
              }`}
            >
              {value}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 hidden sm:flex">
          <button className="rounded-full border border-[#EAEAEA] bg-white text-[#555555] px-4 py-1.5 flex items-center gap-1.5 font-ui text-[11px] font-bold uppercase tracking-wider hover:border-[#111111]">
            FILTERS
            <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
          </button>
          <button className="rounded-full border border-[#EAEAEA] bg-white text-[#555555] px-4 py-1.5 flex items-center gap-1.5 font-ui text-[11px] font-bold uppercase tracking-wider hover:border-[#111111]">
            ALL TIME
            <svg className="size-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
          </button>
        </div>
      </div>

      <div className="flex-1 max-w-[900px] w-full mx-auto px-5 py-10">
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
            <div>
              <p className="font-ui text-[12px] font-bold uppercase tracking-wider text-[#555555] mb-2.5">
                AI SEARCH RESULTS FOR
              </p>
              <h1 className="font-editorial text-[36px] font-normal leading-tight text-[#111111] tracking-tight mb-6">
                {q}
              </h1>

              {/* AI Generated Content Block */}
              {type === "ALL" && (
                <div className="flex flex-col gap-5">
                  <div className="flex items-center gap-2">
                    <div className="flex -space-x-1.5">
                      <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=50&h=50&fit=crop" className="size-6 rounded-full border-2 border-white relative z-30 object-cover" />
                      <img src="https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=50&h=50&fit=crop" className="size-6 rounded-full border-2 border-white relative z-20 object-cover" />
                      <img src="https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=50&h=50&fit=crop" className="size-6 rounded-full border-2 border-white relative z-10 object-cover" />
                    </div>
                    <span className="font-ui text-[12px] font-medium text-[#737373]">
                      Source: c/fashion, c/trends + 4 more
                    </span>
                  </div>

                  <p className="font-ui text-[14px] text-[#333333] leading-[1.6]">
                    In 2026, the paradigm is shifting. By using advanced algorithmic looms, designers are combining traditional coarse flax weaves with incredibly high-density structural wefts. As the season progressed, runway presentations in Shanghai and Beijing emphasized movement, texture, and a new kind of <span className="text-[#3A76C4] font-medium cursor-pointer hover:underline">technical luxury</span>.
                  </p>

                  <div className="border-l-[3px] border-[#EAEAEA] pl-5 py-1">
                    <div className="flex justify-between items-start gap-4">
                      <div>
                        <p className="font-ui text-[12px] text-[#737373] mb-1.5">
                          Sourced from: <span className="text-[#3A76C4] cursor-pointer hover:underline">Structural Wefts Circle</span>
                        </p>
                        <p className="font-editorial italic text-[16px] text-[#555555]">
                          "The heavy, architectural drape is intentional — it breathes without losing shape."
                        </p>
                        <p className="font-ui text-[12px] text-[#737373] mt-2">
                          Quoted by: <span className="text-[#3A76C4] font-medium cursor-pointer hover:underline">Maya Chen</span>
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <span className="font-ui text-[12px] text-[#A3A3A3]">
                          125 contributors
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <button className="font-ui text-[11px] font-bold uppercase tracking-wider text-[#E5552D] hover:opacity-80 flex items-center gap-1">
                      <svg className="size-[14px]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" /></svg>
                      SEE MORE
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Related Posts */}
            {(type === "ALL" || type === "POSTS") && data.posts.length > 0 && (
              <section>
                {type === "ALL" && (
                  <div className="flex items-center justify-between mb-4">
                    <p className="font-ui text-[10px] font-semibold uppercase tracking-widest text-[#555555]">
                      RELATED POSTS
                    </p>
                  </div>
                )}
                {type === "ALL" && (
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="font-ui text-[14px] font-bold uppercase tracking-widest text-[#111111]">
                      RECOMMENDED FOR YOU
                    </h2>
                    <Link to={`/search?q=${q}&type=posts`} className="font-ui text-[12px] text-[#8A8A8A] hover:text-[#111111] underline">View all</Link>
                  </div>
                )}
                
                <div className={`grid gap-4 ${type === "ALL" ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1"}`}>
                  {data.posts.map((post) => (
                    <PostCard
                      key={post.id}
                      post={post}
                      onOpenPost={(p: PostCardType) => setSelectedSlug(p.slug)}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* Circles */}
            {(type === "ALL" || type === "CIRCLES") && data.circles.length > 0 && (
              <section>
                {type === "ALL" && (
                  <div className="flex items-center justify-between mb-4 mt-4">
                    <p className="font-ui text-[10px] font-semibold uppercase tracking-widest text-[#555555]">
                      CIRCLES
                    </p>
                  </div>
                )}
                {type === "ALL" && (
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="font-ui text-[14px] font-bold uppercase tracking-widest text-[#111111]">
                      RECOMMENDED FOR YOU
                    </h2>
                    <Link to={`/search?q=${q}&type=circles`} className="font-ui text-[12px] text-[#8A8A8A] hover:text-[#111111] underline">View all</Link>
                  </div>
                )}
                <div className="grid gap-4 grid-cols-1 md:grid-cols-3">
                  {data.circles.map((circle) => (
                    <CircleCard key={circle.id} circle={circle} />
                  ))}
                </div>
              </section>
            )}

            {/* People */}
            {(type === "ALL" || type === "PEOPLE") && data.people.length > 0 && (
              <section>
                {type === "ALL" && (
                  <div className="flex items-center justify-between mb-4 mt-4">
                    <p className="font-ui text-[10px] font-semibold uppercase tracking-widest text-[#555555]">
                      PEOPLE
                    </p>
                  </div>
                )}
                {type === "ALL" && (
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="font-ui text-[14px] font-bold uppercase tracking-widest text-[#111111]">
                      RECOMMENDED FOR YOU
                    </h2>
                    <Link to={`/search?q=${q}&type=people`} className="font-ui text-[12px] text-[#8A8A8A] hover:text-[#111111] underline">View all</Link>
                  </div>
                )}
                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  {data.people.map((person) => (
                    <Link
                      key={person.id}
                      to={person.handle ? `/u/${person.handle}` : "#"}
                      className="flex items-center gap-3 rounded-[12px] border border-[#EAEAEA] bg-white p-4 hover:shadow-lg transition-shadow"
                    >
                      <AvatarBubble name={person.displayName} url={person.avatarUrl} size="size-12" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-ui font-bold text-[#111111] text-[14px]">{person.displayName}</p>
                        <p className="text-xs font-ui text-[#737373] mt-0.5">
                          {person.handle && `@${person.handle}`}
                        </p>
                      </div>
                      <div className="shrink-0">
                        <button className="border border-[#E5552D] text-[#E5552D] rounded-full px-3 py-1 text-[11px] font-bold font-ui uppercase tracking-wider hover:bg-[#E5552D] hover:text-white transition-colors">
                          Follow
                        </button>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

          </div>
        )}
      </div>

      {selectedSlug && (
        <PostDrawer slug={selectedSlug} onClose={() => setSelectedSlug(null)} />
      )}
    </div>
  );
}
