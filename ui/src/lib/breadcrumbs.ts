import { matchPath } from "react-router-dom";
import { CATEGORY_LABELS, isPostCategory } from "./categoryTaxonomy";

/** One step of a trail. A crumb without `to` is the current page (not a link). */
export interface Crumb {
  label: string;
  to?: string;
}

/**
 * What a page can say about its own place in the hierarchy once its data has loaded:
 * the real parents (a post knows its circle) and/or a real title (the circle's name).
 */
export interface PageCrumbs {
  /** Replaces the parents derived from the route table, e.g. [Circles, "Centoire Community"] for a post. */
  parents?: Crumb[];
  /** Replaces the page's own label, e.g. the post title. */
  label?: string;
}

type Params = Record<string, string | undefined>;

interface RouteNode {
  /** react-router path pattern this node describes. */
  pattern: string;
  label: string | ((params: Params) => string);
  /** Pattern of the parent page. It must have no params, because it becomes a link. */
  parent?: string;
}

export const HOME: Crumb = { label: "Home", to: "/feed" };

/**
 * The page hierarchy, declared once. Adding a page to the trail system is one line here; pages whose
 * title or parents depend on loaded data additionally call `useBreadcrumbs` (see BreadcrumbsContext).
 * Order matters only where patterns overlap, so list specific patterns before general ones.
 */
export const ROUTE_TREE: RouteNode[] = [
  { pattern: "/following", label: "Following" },
  { pattern: "/discover", label: "Discover" },
  {
    pattern: "/category/:category",
    label: (p) => (p.category && isPostCategory(p.category) ? CATEGORY_LABELS[p.category] : "Category"),
  },
  { pattern: "/circles/new", label: "New circle", parent: "/circles" },
  { pattern: "/circles", label: "Circles" },
  { pattern: "/c/:slug", label: "Circle", parent: "/circles" },
  { pattern: "/p/:slug", label: "Post" },
  { pattern: "/hashtag/:name", label: (p) => `#${p.name ?? ""}` },
  { pattern: "/u/:handle", label: (p) => `@${p.handle ?? ""}` },
  { pattern: "/bookmarks", label: "Bookmarks" },
  { pattern: "/drafts", label: "Drafts" },
  { pattern: "/compose/:id", label: "Edit draft", parent: "/drafts" },
  { pattern: "/compose", label: "New post" },
  { pattern: "/search", label: "Search" },
  { pattern: "/settings", label: "Settings" },
  { pattern: "/moderation", label: "Moderation" },
  { pattern: "/admin/sources", label: "Sources" },
  { pattern: "/admin/invites", label: "Invite members" },
  { pattern: "/exclusive/ai-tools", label: "AI & Industry Tools" },
  { pattern: "/exclusive/jobs", label: "Jobs" },
  { pattern: "/exclusive/certification", label: "Certification" },
  { pattern: "/exclusive/startups", label: "Startup / Investors" },
  { pattern: "/exclusive/research", label: "Research" },
  { pattern: "/exclusive/buyers", label: "Buyer / Manufacturers" },
];

function findNode(pattern: string): RouteNode | undefined {
  return ROUTE_TREE.find((n) => n.pattern === pattern);
}

const labelOf = (node: RouteNode, params: Params) => (typeof node.label === "function" ? node.label(params) : node.label);

/** Parents declared in the route table (nearest last), guarded against accidental cycles. */
function tableParents(node: RouteNode): Crumb[] {
  const parents: Crumb[] = [];
  const seen = new Set<string>([node.pattern]);
  let current = node.parent ? findNode(node.parent) : undefined;
  while (current && !seen.has(current.pattern)) {
    seen.add(current.pattern);
    parents.unshift({ label: labelOf(current, {}), to: current.pattern });
    current = current.parent ? findNode(current.parent) : undefined;
  }
  return parents;
}

/**
 * The full trail for a URL, always starting at Home and ending at the current page.
 * Returns [] for pages that are themselves the top level (the feed) or unknown, so nothing renders.
 */
export function buildTrail(pathname: string, override?: PageCrumbs | null): Crumb[] {
  for (const node of ROUTE_TREE) {
    const match = matchPath({ path: node.pattern, end: true }, pathname);
    if (!match) continue;
    const parents = override?.parents ?? tableParents(node);
    return [HOME, ...parents, { label: override?.label ?? labelOf(node, match.params as Params) }];
  }
  return [];
}
