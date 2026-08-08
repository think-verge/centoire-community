export const POST_CATEGORIES = [
  "fashion",
  "beauty",
  "lifestyle",
  "ai_technology",
  "business_intelligence",
] as const;

export type PostCategory = (typeof POST_CATEGORIES)[number];

export const CATEGORY_SUBCATEGORIES: Record<PostCategory, string[]> = {
  fashion: [
    "Fashion News",
    "Design & Creative",
    "Runway & Fashion Weeks",
    "Brands & Luxury",
    "Retail & Commerce",
    "Textiles & Materials",
    "Sustainability",
    "Consumer & Trends",
    "Startups & Innovation",
  ],
  beauty: [
    "Beauty News",
    "Skincare",
    "Makeup",
    "Hair",
    "Fragrance",
    "Wellness & Grooming",
    "Beauty Technology",
    "Beauty Intelligence",
  ],
  lifestyle: [
    "Wellness",
    "Design & Interiors",
    "Travel & Hospitality",
    "Culture",
    "Modern Living",
    "Lifestyle Intelligence",
  ],
  ai_technology: [
    "AI in Fashion",
    "Design Technology",
    "Retail Technology",
    "E-commerce Technology",
    "Marketing Technology",
    "Supply Chain Technology",
    "Sustainability Technology",
    "AI & Tech Tools Directory",
  ],
  business_intelligence: [
    "Fashion Business",
    "Luxury",
    "Markets",
    "Consumer Intelligence",
    "Brand Intelligence",
    "Technology Intelligence",
    "Trend Intelligence",
    "Reports & Forecasts",
  ],
};

export function isPostCategory(value: unknown): value is PostCategory {
  return typeof value === "string" && (POST_CATEGORIES as readonly string[]).includes(value);
}

export function isValidSubcategory(category: PostCategory, subcategory: string): boolean {
  return CATEGORY_SUBCATEGORIES[category].includes(subcategory);
}
