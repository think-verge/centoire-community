/** Whether a nav item's `to` (which may carry query params, e.g. "/discover?sort=trending"
 *  or "/category/fashion?subcategory=Skincare") matches the current location. Plain NavLink
 *  active-matching only looks at pathname, so items that share a pathname but differ by query
 *  (Trending vs Latest, "All Fashion" vs a specific subcategory) need this instead. */
export function isNavItemActive(to: string, pathname: string, search: string): boolean {
  const [path, queryString] = to.split("?");
  if (path !== pathname) return false;

  const toParams = new URLSearchParams(queryString ?? "");
  const locParams = new URLSearchParams(search);
  for (const [key, value] of toParams) {
    if (locParams.get(key) !== value) return false;
  }
  // An item with no query params (e.g. "All Fashion") is only active when the location
  // also carries none of the params this family of items distinguishes on.
  if (toParams.size === 0 && (locParams.has("sort") || locParams.has("subcategory"))) {
    return false;
  }
  return true;
}
