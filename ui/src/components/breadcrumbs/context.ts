import { createContext } from "react";
import type { Crumb, PageCrumbs } from "../../lib/breadcrumbs";

export interface Registered extends PageCrumbs {
  /** Overrides apply only to the URL that registered them, so a stale one can never leak onto the next page. */
  path: string;
}

export interface BreadcrumbsApi {
  set: (value: Registered | null) => void;
}

export const SetterContext = createContext<BreadcrumbsApi | null>(null);
export const TrailContext = createContext<Crumb[]>([]);
