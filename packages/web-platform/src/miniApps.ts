import type { MiniAppId } from "@centoire/contracts";

export interface MiniAppDefinition {
  id: MiniAppId;
  label: string;
  /** Shown while the app has no URL configured. */
  comingSoonPath: string;
  banner?: {
    eyebrow: string;
    title: string;
    body: string;
    cta: string;
  };
}

/** Static description of every mini app; URLs are supplied per environment by each host app. */
export const MINI_APPS: Record<MiniAppId, MiniAppDefinition> = {
  jobs: {
    id: "jobs",
    label: "Jobs",
    comingSoonPath: "/exclusive/jobs",
    banner: {
      eyebrow: "Find your next role in fashion & design",
      title: "Featured Jobs",
      body: "Browse curated openings at top brands, studios, and agencies — updated weekly.",
      cta: "View Jobs",
    },
  },
  "ai-tools": { id: "ai-tools", label: "AI & Industry Tools", comingSoonPath: "/exclusive/ai-tools" },
  certification: { id: "certification", label: "Certification", comingSoonPath: "/exclusive/certification" },
  startups: { id: "startups", label: "Startup / Investors", comingSoonPath: "/exclusive/startups" },
  research: { id: "research", label: "Research", comingSoonPath: "/exclusive/research" },
  buyers: { id: "buyers", label: "Buyer / Manufactures", comingSoonPath: "/exclusive/buyers" },
};

export type MiniAppUrls = Partial<Record<MiniAppId, string | undefined>>;

export interface ResolvedMiniApp extends MiniAppDefinition {
  /** Absolute URL of the live app, or null while it is "coming soon". */
  url: string | null;
}

export function resolveMiniApps(urls: MiniAppUrls): ResolvedMiniApp[] {
  return (Object.values(MINI_APPS) as MiniAppDefinition[]).map((app) => ({
    ...app,
    url: urls[app.id]?.trim() ? (urls[app.id] as string).replace(/\/$/, "") : null,
  }));
}

/** Adds UTM params so mini-app analytics can attribute traffic coming from the main app. */
export function withUtm(url: string, medium: string, campaign: string): string {
  const u = new URL(url);
  u.searchParams.set("utm_source", "centoire");
  u.searchParams.set("utm_medium", medium);
  u.searchParams.set("utm_campaign", campaign);
  return u.toString();
}
