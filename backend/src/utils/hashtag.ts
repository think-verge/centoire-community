/** Hashtag rules shared by every code path that creates or matches one. */
export const MIN_HASHTAG_LENGTH = 2;
export const MAX_HASHTAG_LENGTH = 30;
export const MAX_POST_HASHTAGS = 5;
export const MAX_CIRCLE_HASHTAGS = 5;
export const MAX_SOURCE_HASHTAGS = 5;

/**
 * Canonical form of a hashtag: no leading #, lowercase, letters/digits/underscore only.
 * "#Pattern Making" -> "patternmaking". Returns null when nothing valid is left.
 */
export function normalizeHashtag(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const name = input
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_]/gu, "");
  if (name.length < MIN_HASHTAG_LENGTH || name.length > MAX_HASHTAG_LENGTH) return null;
  if (/^[\p{N}_]+$/u.test(name)) return null; // "123" or "___" read as numbers, not topics
  return name;
}

/** Same cleaning as {@link normalizeHashtag} but without the length floor, for as-you-type prefixes. */
export function normalizePrefix(input: unknown): string {
  if (typeof input !== "string") return "";
  return input
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_]/gu, "")
    .slice(0, MAX_HASHTAG_LENGTH);
}

/** Normalizes, drops invalid values, de-duplicates (keeping order) and caps the result. */
export function normalizeHashtags(inputs: readonly unknown[], max = Number.POSITIVE_INFINITY): string[] {
  const seen = new Set<string>();
  for (const input of inputs) {
    const name = normalizeHashtag(input);
    if (name) seen.add(name);
    if (seen.size >= max) break;
  }
  return [...seen];
}

export function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Hashtags added to / removed from a post when its list changes (used to keep counts exact). */
export function diffHashtags(before: readonly string[], after: readonly string[]) {
  const b = new Set(before);
  const a = new Set(after);
  return {
    added: [...a].filter((n) => !b.has(n)),
    removed: [...b].filter((n) => !a.has(n)),
  };
}
