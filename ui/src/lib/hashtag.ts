/**
 * Client-side mirror of backend/src/utils/hashtag.ts so the UI can show the exact name that will be
 * stored ("Pattern Making" -> #patternmaking) before the server round-trip. The server stays the authority.
 */
export const MIN_HASHTAG_LENGTH = 2;
export const MAX_HASHTAG_LENGTH = 30;
export const MAX_POST_HASHTAGS = 5;

export function cleanHashtag(input: string): string {
  return input
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_]/gu, "")
    .slice(0, MAX_HASHTAG_LENGTH);
}

/** Valid, storable hashtag name, or null. */
export function toHashtag(input: string): string | null {
  const name = cleanHashtag(input);
  if (name.length < MIN_HASHTAG_LENGTH) return null;
  if (/^[\p{N}_]+$/u.test(name)) return null;
  return name;
}

/** "1.2k", "3.4M": compact usage counts like Instagram. */
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) return `${trim(n / 1000)}k`;
  return `${trim(n / 1_000_000)}M`;
}

function trim(x: number): string {
  return (x >= 10 ? Math.round(x) : Math.round(x * 10) / 10).toString();
}

export function postsLabel(count: number): string {
  if (count === 0) return "New";
  return `${formatCount(count)} ${count === 1 ? "post" : "posts"}`;
}
