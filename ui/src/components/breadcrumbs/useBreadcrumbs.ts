import { useContext, useEffect } from "react";
import { useLocation } from "react-router-dom";
import type { Crumb, PageCrumbs } from "../../lib/breadcrumbs";
import { SetterContext, TrailContext } from "./context";

export function useTrail(): Crumb[] {
  return useContext(TrailContext);
}

/**
 * Lets a page refine its breadcrumb once its data is loaded. Pass `null`/`undefined` while loading
 * to keep the route-table default. The override is cleared automatically when the page unmounts.
 *
 *   useBreadcrumbs(post ? { parents: [{ label: "Circles", to: "/circles" }], label: post.title } : null);
 */
export function useBreadcrumbs(override: PageCrumbs | null | undefined): void {
  const api = useContext(SetterContext);
  const { pathname } = useLocation();
  // Serialized so callers can pass a fresh object literal every render without causing update loops.
  const key = override ? JSON.stringify(override) : "";

  useEffect(() => {
    if (!api) return;
    api.set(key ? { ...(JSON.parse(key) as PageCrumbs), path: pathname } : null);
    return () => api.set(null);
  }, [api, key, pathname]);
}
