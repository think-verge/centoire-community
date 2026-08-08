import { Post } from "../models/Post.js";
import type { PostCategory } from "../config/categoryTaxonomy.js";

interface SubcategoryRule {
  category: PostCategory;
  subcategory: string;
  keywords: string[];
}

// Heuristic only — matches free-text signals (AI-suggested tags, populated tag names,
// the AI agent's content-format category) against a static keyword table. This backs
// an admin-triggered backfill pass over already-ingested posts, not a live pipeline;
// the AI agent's own category field is a content-format classifier (news/opinion/etc.),
// not a topical vertical, so it can't be remapped directly — hence this separate table.
const RULES: SubcategoryRule[] = [
  { category: "fashion", subcategory: "Fashion News", keywords: ["fashion news", "appointment", "launch"] },
  { category: "fashion", subcategory: "Design & Creative", keywords: ["illustration", "pattern making", "footwear design", "creative direction"] },
  { category: "fashion", subcategory: "Runway & Fashion Weeks", keywords: ["runway", "fashion week", "catwalk"] },
  { category: "fashion", subcategory: "Brands & Luxury", keywords: ["luxury", "heritage", "couture"] },
  { category: "fashion", subcategory: "Retail & Commerce", keywords: ["retail", "e-commerce", "supply chain", "shopping"] },
  { category: "fashion", subcategory: "Textiles & Materials", keywords: ["textile", "fabric", "denim", "knitwear", "leather"] },
  { category: "fashion", subcategory: "Sustainability", keywords: ["sustainability", "sustainable", "circular fashion"] },
  { category: "fashion", subcategory: "Consumer & Trends", keywords: ["street style", "streetwear", "vintage", "trend"] },
  { category: "fashion", subcategory: "Startups & Innovation", keywords: ["startup", "funding round"] },

  { category: "beauty", subcategory: "Beauty News", keywords: ["beauty news"] },
  { category: "beauty", subcategory: "Skincare", keywords: ["skincare", "skin care"] },
  { category: "beauty", subcategory: "Makeup", keywords: ["makeup", "cosmetics"] },
  { category: "beauty", subcategory: "Hair", keywords: ["haircare", "hair care", "hairstyling"] },
  { category: "beauty", subcategory: "Fragrance", keywords: ["fragrance", "perfume"] },
  { category: "beauty", subcategory: "Wellness & Grooming", keywords: ["grooming"] },
  { category: "beauty", subcategory: "Beauty Technology", keywords: ["beauty tech", "beauty technology"] },

  { category: "lifestyle", subcategory: "Design & Interiors", keywords: ["interior design", "architecture"] },
  { category: "lifestyle", subcategory: "Travel & Hospitality", keywords: ["travel", "hotel", "hospitality"] },
  { category: "lifestyle", subcategory: "Culture", keywords: ["culture", "entertainment"] },
  { category: "lifestyle", subcategory: "Wellness", keywords: ["wellness"] },

  { category: "ai_technology", subcategory: "AI in Fashion", keywords: ["generative ai", "artificial intelligence", "fashion tech", "techwear"] },
  { category: "ai_technology", subcategory: "Design Technology", keywords: ["3d design", "digital sampling", "virtual prototyping"] },
  { category: "ai_technology", subcategory: "Retail Technology", keywords: ["retail tech", "clienteling"] },
  { category: "ai_technology", subcategory: "E-commerce Technology", keywords: ["conversational commerce", "visual search"] },
  { category: "ai_technology", subcategory: "Sustainability Technology", keywords: ["traceability", "carbon tracking"] },

  { category: "business_intelligence", subcategory: "Luxury", keywords: ["luxury group"] },
  { category: "business_intelligence", subcategory: "Markets", keywords: ["market report", "macro"] },
  { category: "business_intelligence", subcategory: "Reports & Forecasts", keywords: ["forecast", "state of fashion"] },
  { category: "business_intelligence", subcategory: "Fashion Business", keywords: ["business strategy", "leadership"] },
];

function matchesKeyword(haystack: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(haystack);
}

export interface CategorySuggestion {
  category: PostCategory;
  subcategory: string;
}

export function suggestCategory(signals: string[]): CategorySuggestion | null {
  const haystack = signals.filter(Boolean).join(" ").toLowerCase();
  if (!haystack) return null;
  for (const rule of RULES) {
    if (rule.keywords.some((kw) => matchesKeyword(haystack, kw))) {
      return { category: rule.category, subcategory: rule.subcategory };
    }
  }
  return null;
}

export interface BackfillResult {
  scanned: number;
  updated: number;
}

/** Admin-triggered, one-off pass — not run automatically on ingestion. */
export async function backfillUncategorizedPosts(limit = 500): Promise<BackfillResult> {
  const posts = await Post.find({ category: { $exists: false } })
    .limit(limit)
    .populate("tags", "name");

  let updated = 0;
  for (const post of posts) {
    const tagNames = (post.tags as unknown as Array<{ name?: string }>).map((t) => t.name ?? "");
    const suggestion = suggestCategory([...(post.aiTags ?? []), post.aiCategory ?? "", ...tagNames]);
    if (!suggestion) continue;
    post.category = suggestion.category;
    post.subcategory = suggestion.subcategory;
    await post.save();
    updated += 1;
  }

  return { scanned: posts.length, updated };
}
