import { createHash } from "node:crypto";

const TRACKING_PARAMS = /^(utm_|fbclid|gclid|mc_|ref$|ref_)/;

/** Normalize a URL (strip tracking params, hash, trailing slash) then sha256 it. */
export function canonicalUrlHash(rawUrl: string): string {
  let normalized = rawUrl.trim();
  try {
    const url = new URL(rawUrl);
    url.hash = "";
    const params = [...url.searchParams.keys()];
    for (const key of params) {
      if (TRACKING_PARAMS.test(key.toLowerCase())) url.searchParams.delete(key);
    }
    url.hostname = url.hostname.toLowerCase();
    normalized = url.toString().replace(/\/$/, "");
  } catch {
    // keep raw string when it isn't a valid URL
  }
  return createHash("sha256").update(normalized).digest("hex");
}
