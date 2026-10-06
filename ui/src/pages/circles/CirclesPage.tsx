import { useState, useRef } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  getListCirclesQueryKey,
  useJoinCircle,
  useLeaveCircle,
  useListCircles,
} from "../../lib/api/generated/circles/circles";
import type { Circle } from "../../lib/api/generated/model";

export function CirclesPage() {
  const [query, setQuery] = useState("");
  const { data: circles, isLoading } = useListCircles(query ? { q: query } : undefined);
  const [filter, setFilter] = useState("ALL");
  const filters = ["ALL", "RECOMMENDED", "FASHION", "ART & DESIGN", "TECHNOLOGY"];

  // Mock categorizations for demo by duplicating the array to have enough items
  const safeCircles = circles || [];
  const extendedCircles = [...safeCircles, ...safeCircles, ...safeCircles];
  
  const recommended = extendedCircles.slice(0, 8);
  const fashion = extendedCircles.slice(2, 10);
  const artAndDesign = extendedCircles.slice(4, 12);
  const technology = extendedCircles.slice(6, 14);

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
          {filters.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-5 py-2 font-ui text-[13px] font-semibold uppercase tracking-wider transition-colors ${filter === f
                  ? "bg-[#E5552D] text-white border-[#E5552D]"
                  : "bg-white text-[#8A8A8A] border-[#EAEAEA] hover:border-[#999999]"
                }`}
            >
              {f}
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

      {!isLoading && (
        <div className="mt-6 flex flex-col gap-8 pb-12">
          <CircleCarousel title="RECOMMENDED FOR YOU" circles={recommended} />
          <CircleCarousel title="FASHION" circles={fashion} />

          <JobsPromoBanner />

          <CircleCarousel title="ART & DESIGN" circles={artAndDesign} />
          <CircleCarousel title="TECHNOLOGY" circles={technology} />
        </div>
      )}

      {circles?.length === 0 && (
        <div className="mt-10 rounded-xl border border-dashed border-[#EAEAEA] p-12 text-center">
          <p className="font-editorial text-2xl font-medium text-[#111111]">No circles found</p>
          <p className="mt-2 text-[14px] text-[#5A5A5A] font-ui">Start the one you're looking for.</p>
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
        {circles.map((circle, index) => (
          <div key={`${circle.id}-${index}`} className="snap-start shrink-0">
            <CircleCard circle={circle} index={index} />
          </div>
        ))}
      </div>
    </div>
  );
}

function CircleCard({ circle, index = 0 }: { circle: Circle; index?: number }) {
  const queryClient = useQueryClient();
  const [joined, setJoined] = useState(Boolean(circle.viewerRole));
  const [members, setMembers] = useState(circle.memberCount);
  const join = useJoinCircle();
  const leave = useLeaveCircle();

  function toggle() {
    if (joined) {
      setJoined(false);
      setMembers((n) => Math.max(0, n - 1));
      leave.mutate(
        { slug: circle.slug },
        { onError: () => void queryClient.invalidateQueries({ queryKey: getListCirclesQueryKey() }) },
      );
    } else {
      setJoined(true);
      setMembers((n) => n + 1);
      join.mutate({ slug: circle.slug });
    }
  }

  const dummyAvatars = [
    "https://i.pravatar.cc/100?img=12",
    "https://i.pravatar.cc/100?img=33",
    "https://i.pravatar.cc/100?img=47",
    "https://i.pravatar.cc/100?img=28",
  ];

  const getStaticImages = (name: string) => {
    if (name.includes("Denim")) {
      return {
        cover: "https://images.unsplash.com/photo-1576995853123-5a10305d93c0?q=80&w=600&auto=format&fit=crop", // More reliable Denim texture
        avatar: "https://images.unsplash.com/photo-1582213782179-e0d53f98f2ca?q=80&w=200&auto=format&fit=crop"
      };
    }
    if (name.includes("Lab") || name.includes("Knit")) {
      return {
        cover: "https://images.unsplash.com/photo-1558769132-cb1aea458c5e?q=80&w=600&auto=format&fit=crop", // Reliable texture
        avatar: "https://images.unsplash.com/photo-1544441893-675973e31985?q=80&w=200&auto=format&fit=crop"
      };
    }
    if (name.includes("Indie")) {
      return {
        cover: "https://images.unsplash.com/photo-1445205170230-053b83016050?q=80&w=600&auto=format&fit=crop",
        avatar: "https://images.unsplash.com/photo-1472214103451-9374bd1c798e?q=80&w=200&auto=format&fit=crop"
      };
    }
    return {
      cover: circle.coverImageUrl || "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=600&auto=format&fit=crop",
      avatar: circle.avatarUrl || "https://images.unsplash.com/photo-1512436991641-6745cdb1723f?q=80&w=200&auto=format&fit=crop"
    };
  };

  const images = getStaticImages(circle.name);

  const mockContent = [
    { name: "Mindful Living", description: "Share mindfulness tips, meditation routines, and self-care practices for everyday balance.", members: "18.4k", visitors: "2.1k weekly visitors" },
    { name: "Creative Writing", description: "Share stories, poems, and writing prompts with fellow readers and aspiring authors.", members: "12.2k", visitors: "1.5k weekly visitors" },
    { name: "Photography", description: "Share and discuss photography techniques, gear recommendations, and favorite shots.", members: "34.5k", visitors: "4.2k weekly visitors" },
    { name: "Music Lovers", description: "Discover and discuss music across genres, playlists, and emerging artists.", members: "8.9k", visitors: "1.1k weekly visitors" },
    { name: "Book Club", description: "Discuss latest reads, book reviews, and author interviews.", members: "45.1k", visitors: "5.8k weekly visitors" },
  ];
  const content = mockContent[index % mockContent.length];

  return (
    <div className="flex flex-col rounded-[20px] border border-[#EAEAEA] bg-white overflow-hidden shadow-[0_4px_16px_rgba(0,0,0,0.06)] hover:shadow-lg transition-shadow w-[275px] h-[240px]">
      <div className="h-[32px] w-full bg-[#F5F5F5] relative shrink-0">
        <img src={images.cover} alt="" className="w-full h-full object-cover" />

        <div className="absolute -bottom-9 left-4 size-[60px] rounded-full bg-[#111111] overflow-hidden flex items-center justify-center shadow-sm">
          <img src={images.avatar} alt="" className="w-full h-full object-cover" />
        </div>

        <div className="absolute -bottom-9 right-4 flex items-center gap-2">
          <div className="flex items-center gap-2 bg-transparent rounded-full border border-[#EAEAEA] pl-0.5 pr-2.5 py-0.5">
            <div className="flex -space-x-1.5">
              {dummyAvatars.map((url, i) => (
                <img key={i} src={url} alt="" className="size-[18px] rounded-full border-[1.5px] border-white relative z-10 bg-white object-cover" />
              ))}
            </div>
            <span className="font-ui text-[11px] font-medium text-[#555555]">
              {members}
            </span>
          </div>
          <button className="text-[#8A8A8A] hover:text-[#111111] transition-colors">
            <svg className="size-[22px]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" /></svg>
          </button>
        </div>
      </div>

      <div className="px-4 pt-12 pb-4 flex flex-col flex-1">
        <Link to={`/c/${circle.slug}`} className="min-w-0">
          <h2 className="font-editorial text-[19px] font-bold text-[#111111] hover:text-[#E5552D] transition-colors truncate">
            {content.name}
          </h2>
        </Link>
        <p className="mt-1.5 text-[14px] font-ui text-[#737373] leading-snug line-clamp-3 min-h-[64px]">
          {content.description}
        </p>

        <div className="mt-auto pt-2 flex items-center justify-between gap-2">
          <button
            onClick={toggle}
            className={`px-6 py-1 rounded-full font-ui text-[13px] font-semibold transition-colors border shrink-0 ${joined
              ? "bg-[#E5552D] text-white border-transparent hover:opacity-90"
              : "bg-white text-[#111111] border-[#111111] hover:bg-[#F5F5F5]"
              }`}
          >
            {joined ? "Joined" : "Join"}
          </button>
          <span className="font-ui text-[14px] text-[#737373] truncate">
            {content.visitors}
          </span>
        </div>
      </div>
    </div>
  );
}

function JobsPromoBanner() {
  return (
    <div className="-mx-4 sm:-mx-8 w-[calc(100%+2rem)] sm:w-[calc(100%+4rem)] bg-[#111111] text-white py-10 px-8 sm:px-16 overflow-hidden relative my-2">
      <img src="/dark_silk_banner_bg.jpg" className="absolute inset-0 w-full h-full object-cover opacity-80" alt="" />
      <div className="absolute inset-0 opacity-50 mix-blend-overlay">
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
          <filter id="noise"><feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="3" stitchTiles="stitch" /></filter>
          <rect width="100%" height="100%" filter="url(#noise)" />
        </svg>
      </div>

      <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 max-w-[1400px] mx-auto">
        <div>
          <p className="font-ui text-[12px] font-bold uppercase tracking-[0.15em] text-white mb-2.5">RECOMMENDED FOR YOU</p>
          <h2 className="font-editorial text-[36px] sm:text-[44px] font-normal leading-tight text-white tracking-tight">Jobs we think you'll love</h2>
        </div>
        <div className="flex items-center gap-7">
          <button className="font-ui text-[15px] font-medium text-white hover:text-[#CCCCCC] underline underline-offset-[6px] decoration-white decoration-[1.5px]">Post a Job</button>
          <button className="rounded-full bg-[#E5552D] text-white font-ui text-[13px] font-bold uppercase tracking-wider px-7 py-3 transition-colors hover:bg-[#CC4824] flex items-center gap-2">
            EXPLORE JOBS
            <svg className="size-[20px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12h15m0 0l-6-6m6 6l-6 6" />
            </svg>
          </button>
        </div>
      </div>

      <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-[1400px] mx-auto">
        {[
          { company: "ATELIER VOSS", title: "Senior Knitwear Designer", location: "Copenhagen (Hybrid)", type: "Full-Time" },
          { company: "LUMEN STUDIO", title: "Textile Sourcing Lead", location: "Paris (On-site)", type: "Contract" },
          { company: "CENTOIRE COLLECTIVE", title: "Visual Merchandiser", location: "New York (On-site)", type: "Full-Time" }
        ].map((job, i) => (
          <div key={i} className="bg-white text-[#111111] p-5 rounded-none flex flex-col justify-between min-h-[130px] shadow-lg">
            <div>
              <p className="font-ui text-[13px] font-bold uppercase tracking-wider text-[#E5552D] mb-1.5">{job.company}</p>
              <h3 className="font-editorial text-[18px] font-medium leading-snug tracking-tight text-[#111111]">{job.title}</h3>
            </div>
            <div className="mt-5 flex items-center justify-between font-ui text-[12px]">
              <div className="flex items-center gap-1.5 text-[#5A5A5A]">
                <svg className="size-[14px] text-[#8A8A8A]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                {job.location}
              </div>
              <span className="bg-[#F5F5F5] px-2.5 py-1 rounded-none text-[11px] font-bold text-[#8A8A8A] uppercase tracking-wide">{job.type}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}


