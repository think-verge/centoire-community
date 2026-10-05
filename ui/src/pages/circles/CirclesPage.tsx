import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListCirclesQueryKey,
  useJoinCircle,
  useLeaveCircle,
  useListCircles,
} from "../../lib/api/generated/circles/circles";
import { useListTags } from "../../lib/api/generated/tags/tags";
import type { Circle } from "../../lib/api/generated/model";

const MAX_TAG_PILLS = 8;

function useDebounced<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

export function CirclesPage() {
  const [query, setQuery] = useState("");
  const [tagSlug, setTagSlug] = useState<string | null>(null);
  const debouncedQuery = useDebounced(query.trim(), 300);

  const { data: tags } = useListTags();
  const params = {
    ...(debouncedQuery ? { q: debouncedQuery } : {}),
    ...(tagSlug ? { tag: tagSlug } : {}),
  };
  const { data: circles, isLoading, isError } = useListCircles(
    Object.keys(params).length ? params : undefined,
  );

  const pills = (tags ?? []).slice(0, MAX_TAG_PILLS);
  const yours = (circles ?? []).filter((c) => c.viewerRole);
  const filtering = Boolean(debouncedQuery || tagSlug);
  const activeTag = pills.find((t) => t.slug === tagSlug);
  const heading = debouncedQuery
    ? `RESULTS FOR "${debouncedQuery}"`
    : activeTag
      ? activeTag.name.toUpperCase()
      : "POPULAR CIRCLES";

  return (
    <div className="px-4 py-8 sm:px-8 max-w-[1400px] mx-auto w-full">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-editorial text-[32px] sm:text-[36px] font-bold text-[#111111] leading-tight">Circles</h1>
          <p className="mt-1 text-[#5A5A5A] font-ui text-[14px]">
            Discover communities and join the conversations that matter.
          </p>
        </div>
        <Link
          to="/circles/new"
          className="rounded-full bg-[#E5552D]/10 text-[#E5552D] font-ui text-[13px] font-bold uppercase tracking-wider px-6 py-2.5 transition-colors hover:bg-[#E5552D]/20 flex items-center gap-1"
        >
          <span className="text-[26px] font-medium leading-[0] mt-[-5px]">+</span> CREATE CIRCLE
        </Link>
      </div>

      <div className="mt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {[{ slug: null, name: "All" }, ...pills].map((t) => (
            <button
              key={t.slug ?? "all"}
              onClick={() => setTagSlug(t.slug)}
              className={`rounded-full border px-5 py-2 font-ui text-[13px] font-semibold uppercase tracking-wider transition-colors ${
                tagSlug === t.slug
                  ? "bg-[#E5552D] text-white border-[#E5552D]"
                  : "bg-white text-[#8A8A8A] border-[#EAEAEA] hover:border-[#999999]"
              }`}
            >
              {t.name}
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-auto sm:min-w-[340px]">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-[#8A8A8A]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search circles..."
            className="w-full rounded-full border border-[#EAEAEA] bg-white pl-10 pr-4 py-2 font-ui text-[13px] placeholder:text-[#8A8A8A] focus:border-[#999999] focus:outline-none transition-colors"
          />
        </div>
      </div>

      {isLoading && <p className="mt-12 text-[#8A8A8A] font-ui text-sm">Loading circles...</p>}
      {isError && (
        <p className="mt-12 text-crimson font-ui text-sm">Couldn't load circles. Please try again.</p>
      )}

      {!isLoading && !isError && (
        <div className="mt-6 flex flex-col gap-8 pb-12">
          {!filtering && <CircleCarousel title="YOUR CIRCLES" circles={yours} />}

          {circles && circles.length > 0 && (
            <section>
              <h3 className="mb-3 font-ui text-[16px] font-black uppercase tracking-wider text-[#111111]">
                {heading}
              </h3>
              <div className="flex flex-wrap gap-4">
                {circles.map((circle) => (
                  <CircleCard key={circle.id} circle={circle} />
                ))}
              </div>
            </section>
          )}

          {circles?.length === 0 && (
            <div className="rounded-xl border border-dashed border-[#EAEAEA] p-12 text-center">
              <p className="font-editorial text-2xl font-medium text-[#111111]">No circles found</p>
              <p className="mt-2 text-[14px] text-[#5A5A5A] font-ui">
                Start the one you're looking for.
              </p>
              <Link
                to="/circles/new"
                className="mt-4 inline-block font-ui text-[13px] font-bold text-[#E5552D] hover:underline"
              >
                Create a circle
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function CircleCarousel({ title, circles }: { title: string; circles: Circle[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const scrollAmount = 600;
      scrollRef.current.scrollBy({ left: direction === "left" ? -scrollAmount : scrollAmount, behavior: "smooth" });
    }
  };

  if (!circles || circles.length === 0) return null;

  return (
    <div className="w-full relative">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-ui text-[16px] font-black uppercase tracking-wider text-[#111111]">
          {title}
        </h3>
        <div className="flex items-center gap-2 text-[#555555]">
          <button onClick={() => scroll("left")} className="hover:text-[#111111] transition-colors p-1">
            <svg className="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button onClick={() => scroll("right")} className="hover:text-[#111111] transition-colors p-1">
            <svg className="size-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x snap-mandatory"
      >
        {circles.map((circle) => (
          <div key={circle.id} className="snap-start shrink-0">
            <CircleCard circle={circle} />
          </div>
        ))}
      </div>
    </div>
  );
}

function CircleCard({ circle }: { circle: Circle }) {
  const queryClient = useQueryClient();
  const [joined, setJoined] = useState(Boolean(circle.viewerRole));
  const [members, setMembers] = useState(circle.memberCount);
  const [copied, setCopied] = useState(false);
  const join = useJoinCircle();
  const leave = useLeaveCircle();

  // Re-sync when the list refetches with fresh server state.
  useEffect(() => {
    setJoined(Boolean(circle.viewerRole));
    setMembers(circle.memberCount);
  }, [circle.viewerRole, circle.memberCount]);

  const rollback = () => void queryClient.invalidateQueries({ queryKey: getListCirclesQueryKey() });

  function toggle() {
    if (joined) {
      setJoined(false);
      setMembers((n) => Math.max(0, n - 1));
      leave.mutate({ slug: circle.slug }, { onError: rollback });
    } else {
      setJoined(true);
      setMembers((n) => n + 1);
      join.mutate({ slug: circle.slug }, { onError: rollback });
    }
  }

  async function share() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/c/${circle.slug}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable (insecure context); nothing to do
    }
  }

  return (
    <div className="flex flex-col rounded-[20px] border border-[#EAEAEA] bg-white overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.06)] hover:shadow-lg transition-shadow w-[275px] h-[240px]">
      <div className="h-[32px] w-full bg-gradient-to-r from-[#EAEAEA] to-[#F5F5F5] relative shrink-0">
        {circle.coverImageUrl && (
          <img src={circle.coverImageUrl} alt="" className="w-full h-full object-cover" />
        )}

        <div className="absolute -bottom-9 left-4 size-[60px] rounded-full bg-[#111111] overflow-hidden flex items-center justify-center shadow-sm">
          {circle.avatarUrl ? (
            <img src={circle.avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="font-editorial text-[24px] font-bold text-white">
              {circle.name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <div className="absolute -bottom-9 right-4 flex items-center gap-2">
          <div className="flex items-center gap-1.5 bg-transparent rounded-full border border-[#EAEAEA] px-2.5 py-0.5">
            <svg className="size-3.5 text-[#8A8A8A]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="1.8"><path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            <span className="font-ui text-[11px] font-medium text-[#555555]">{formatCount(members)}</span>
          </div>
          <button
            onClick={share}
            aria-label={copied ? "Link copied" : "Copy circle link"}
            title={copied ? "Link copied" : "Copy circle link"}
            className="text-[#8A8A8A] hover:text-[#111111] transition-colors"
          >
            <svg className="size-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
          </button>
        </div>
      </div>

      <div className="px-4 pt-12 pb-4 flex flex-col flex-1">
        <Link to={`/c/${circle.slug}`} className="min-w-0">
          <h2 className="font-editorial text-[19px] font-bold text-[#111111] hover:text-[#E5552D] transition-colors truncate">
            {circle.name}
          </h2>
        </Link>
        <p className="mt-1.5 text-[14px] font-ui text-[#737373] leading-snug line-clamp-3 min-h-[64px]">
          {circle.description}
        </p>

        <div className="mt-auto pt-2 flex items-center justify-between gap-2">
          <button
            onClick={toggle}
            disabled={circle.viewerRole === "owner"}
            title={circle.viewerRole === "owner" ? "Owners can't leave their circle" : undefined}
            className={`px-6 py-1 rounded-full font-ui text-[13px] font-semibold transition-colors border shrink-0 disabled:opacity-60 ${
              joined
                ? "bg-[#E5552D] text-white border-transparent hover:opacity-90"
                : "bg-white text-[#111111] border-[#111111] hover:bg-[#F5F5F5]"
            }`}
          >
            {joined ? "Joined" : "Join"}
          </button>
          <span className="font-ui text-[14px] text-[#737373] truncate">
            {circle.postCount} {circle.postCount === 1 ? "post" : "posts"}
          </span>
        </div>
      </div>
    </div>
  );
}

function formatCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, "")}k` : String(n);
}
