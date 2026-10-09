/**
 * Curated hashtags. `featured` ones are shown to new users in onboarding; the rest make the typeahead
 * useful from day one. Used by scripts/seed.ts and scripts/migrate-tags-to-hashtags.ts.
 * Names are normalized (no #, no spaces): see utils/hashtag.ts.
 */
export interface SeedHashtag {
  name: string;
  featured?: boolean;
}

export const SEED_HASHTAGS: SeedHashtag[] = [
  { name: "streetwear", featured: true },
  { name: "couture", featured: true },
  { name: "menswear", featured: true },
  { name: "womenswear", featured: true },
  { name: "techwear" },
  { name: "vintage", featured: true },
  { name: "bridal" },
  { name: "accessories" },
  { name: "sneakers", featured: true },
  { name: "textiles", featured: true },
  { name: "knitwear", featured: true },
  { name: "denim", featured: true },
  { name: "patternmaking", featured: true },
  { name: "footweardesign" },
  { name: "embroidery" },
  { name: "sustainability", featured: true },
  { name: "supplychain" },
  { name: "retail" },
  { name: "fashiontech", featured: true },
  { name: "branding", featured: true },
  { name: "runway", featured: true },
  { name: "streetstyle", featured: true },
  { name: "fashionhistory" },
  { name: "editorial", featured: true },
  { name: "art", featured: true },
  { name: "design", featured: true },
  { name: "architecture" },
  { name: "beauty", featured: true },
  { name: "luxury", featured: true },
  { name: "photography", featured: true },
  { name: "technology" },
  { name: "ootd", featured: true },
  { name: "slowfashion", featured: true },
  { name: "lookbook", featured: true },
  { name: "thrifting" },
  { name: "upcycling" },
  { name: "fashionweek" },
  { name: "minimalism" },
  { name: "moodboard" },
  { name: "fashionillustration" },
];

export const FEATURED_HASHTAG_NAMES = new Set(SEED_HASHTAGS.filter((h) => h.featured).map((h) => h.name));
