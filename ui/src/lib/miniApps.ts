import { resolveMiniApps, withUtm, type ResolvedMiniApp } from "@centoire/web-platform";

/** Mini apps with their per-environment URLs. Add each app's VITE_*_URL here as it launches. */
export const miniApps: ResolvedMiniApp[] = resolveMiniApps({
  jobs: import.meta.env.VITE_JOBS_URL,
});

/** Origins a login `returnTo` may point at (the live mini apps only). */
export const ALLOWED_RETURN_ORIGINS: string[] = miniApps.flatMap((app) =>
  app.url ? [new URL(app.url).origin] : [],
);

export function miniAppHref(app: ResolvedMiniApp, medium: string): string | null {
  return app.url ? withUtm(app.url, medium, app.id) : null;
}
