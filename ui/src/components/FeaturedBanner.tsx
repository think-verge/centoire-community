import { Link } from "react-router-dom";

export function FeaturedBanner() {
  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-6 rounded-none bg-[#111111] px-6 sm:px-[120px] py-12 sm:py-[64px] relative overflow-hidden">
      {/* Background image overlay */}
      <img src="/dark_silk_banner_bg.jpg" className="absolute inset-0 w-full h-full object-cover opacity-80 z-0 pointer-events-none" alt="" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/80 to-transparent pointer-events-none z-0" />
      <div className="min-w-0 relative z-10">
        <p className="font-ui text-[12px] font-bold uppercase tracking-wider text-[#E4572E] mb-2">
          FIND YOUR NEXT ROLE IN FASHION
        </p>
        <h2 className="font-editorial text-[40px] font-normal text-white leading-none mb-3">
          Featured Jobs
        </h2>
        <p className="font-ui text-[14px] text-[#D4D4D4]">
          Browse curated openings at top brands, studios, and agencies-updated daily.
        </p>
      </div>
      <Link
        to="/exclusive/jobs"
        className="shrink-0 rounded-full bg-[#E4572E] px-8 py-3.5 font-ui text-[14px] font-bold uppercase tracking-widest text-white hover:bg-[#c94924] transition-colors relative z-10 flex items-center gap-2"
      >
        VIEW JOBS
        <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
      </Link>
    </div>
  );
}
