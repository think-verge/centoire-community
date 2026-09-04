import { Link } from "react-router-dom";

export function FeaturedBanner() {
  return (
    <div className="my-8 flex items-center justify-between gap-6 rounded-2xl bg-[#111] px-8 py-6">
      <div className="min-w-0">
        <p className="font-ui text-[10px] font-semibold uppercase tracking-widest text-white/50">
          Find your next role in fashion &amp; design
        </p>
        <h2 className="font-editorial mt-1 text-3xl italic text-white">Featured Jobs</h2>
        <p className="mt-1 font-ui text-sm text-white/60">
          Browse curated openings at top brands, studios, and agencies — updated weekly.
        </p>
      </div>
      <Link
        to="/exclusive/jobs"
        className="shrink-0 rounded-lg bg-[var(--color-coral)] px-6 py-2.5 font-ui text-sm font-bold text-white hover:opacity-90 transition-opacity"
      >
        View Jobs →
      </Link>
    </div>
  );
}
