import type { PostCardDiscovery } from "../lib/api/generated/model";

/** How long after `from` something happened, as "40 min" / "3 h" / "2 d". */
function gap(from: string, to: string): string {
  const minutes = Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60_000));
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 48 * 60) return `${Math.round(minutes / 60)} h`;
  return `${Math.round(minutes / 1440)} d`;
}

function when(iso: string): string {
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/**
 * The discovery engine's evidence for a story waiting for review: how many websites carry it,
 * who published first, and how it spread. Shown on moderation cards so an editor can judge
 * whether it's real and worth surfacing.
 */
export function DiscoveryEvidence({ discovery }: { discovery: NonNullable<PostCardDiscovery> }) {
  const first = discovery.firstPublished;
  const others = discovery.spread.filter((s) => s.name !== first?.name);
  return (
    <div className="mt-3 rounded-lg border border-line bg-cream/60 px-3 py-2 text-xs text-ink-soft">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="rounded-full bg-gold-tint px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gold">
          Discovery
        </span>
        {discovery.category && (
          <span className="rounded-full bg-paper px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink">
            {discovery.category}
          </span>
        )}
        <span className="font-semibold text-ink">
          {discovery.websiteCount} {discovery.websiteCount === 1 ? "website" : "websites"}
        </span>
        <span>· {discovery.articleCount} articles</span>
        {discovery.markets.length > 0 && <span>· seen in {discovery.markets.join(", ")}</span>}
      </div>
      {first && (
        <p className="mt-1">
          First:{" "}
          {first.url ? (
            <a
              href={first.url}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-ink underline decoration-line underline-offset-2"
              onClick={(e) => e.stopPropagation()}
            >
              {first.name}
            </a>
          ) : (
            <span className="font-medium text-ink">{first.name}</span>
          )}{" "}
          {when(first.at)}
          {discovery.engineSawAt && <span> · engine saw it {gap(first.at, discovery.engineSawAt)} later</span>}
        </p>
      )}
      {others.length > 0 && first && (
        <p className="mt-1 line-clamp-2">
          Then:{" "}
          {others
            .slice(0, 8)
            .map((s) => `${s.name} (+${gap(first.at, s.firstAt)})`)
            .join(", ")}
          {others.length > 8 && ` and ${others.length - 8} more`}
        </p>
      )}
    </div>
  );
}
