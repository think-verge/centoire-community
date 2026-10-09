import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { CATEGORY_SUBCATEGORIES, POST_CATEGORIES, type PostCategory } from "../config/categoryTaxonomy.js";
import * as hashtagService from "./hashtagService.js";
import { ApiError } from "../utils/api-error.js";

const MODEL = "claude-haiku-4-5";

export interface ResolvedFilters {
  category?: PostCategory;
  subcategory?: string;
  hashtag?: string;
  country?: string;
  q?: string;
  sort?: "trending" | "new";
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!env.ANTHROPIC_API_KEY) {
    throw new ApiError(503, "AI search is not configured — missing ANTHROPIC_API_KEY");
  }
  if (!client) client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}

const APPLY_FILTERS_TOOL: Anthropic.Tool = {
  name: "apply_search_filters",
  description: "Translate a natural-language content request into structured post filters.",
  input_schema: {
    type: "object",
    properties: {
      category: {
        type: ["string", "null"],
        enum: [...POST_CATEGORIES, null],
        description: "The single best-matching top-level category, or null if none clearly applies.",
      },
      subcategory: {
        type: ["string", "null"],
        description: "A subcategory of the chosen category (must be one of that category's known subcategories), or null.",
      },
      hashtag: {
        type: ["string", "null"],
        description: "The single best-matching hashtag (no #) from the provided hashtag list, or null if none clearly applies.",
      },
      country: {
        type: ["string", "null"],
        description: "ISO 3166-1 alpha-2 country code if the request names a specific country/place, or null.",
      },
      q: {
        type: ["string", "null"],
        description: "Any remaining free-text search terms (brand names, style descriptors, topics) not captured by the fields above, or null.",
      },
      sort: {
        type: ["string", "null"],
        enum: ["trending", "new", null],
        description: "'trending' if the request implies popularity/what's hot, 'new' if it implies most recent, otherwise null.",
      },
    },
    required: ["category", "subcategory", "hashtag", "country", "q", "sort"],
  },
};

function buildSystemPrompt(hashtags: string[]): string {
  const categoryLines = POST_CATEGORIES.map(
    (category) => `- ${category}: ${CATEGORY_SUBCATEGORIES[category].join(", ")}`,
  ).join("\n");
  const tagLines = hashtags.map((h) => `#${h}`).join(", ");
  return [
    "You turn a user's natural-language content request into structured filters for a fashion/lifestyle news platform.",
    "Only use categories, subcategories, and hashtags from the lists below — never invent new ones.",
    "",
    "Categories and their subcategories:",
    categoryLines,
    "",
    "Popular hashtags:",
    tagLines,
    "",
    "Call apply_search_filters exactly once with your best interpretation.",
  ].join("\n");
}

export async function interpretQuery(query: string): Promise<ResolvedFilters> {
  const anthropic = getClient();
  // The hashtag set is open-ended, so only offer the most-used ones to the model.
  const popular = await hashtagService.search({ limit: 20 });
  const featured = await hashtagService.search({ limit: 20, featured: true });
  const hashtags = [...new Set([...featured, ...popular].map((h) => h.name))];

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: buildSystemPrompt(hashtags),
    tools: [APPLY_FILTERS_TOOL],
    tool_choice: { type: "tool", name: "apply_search_filters" },
    messages: [{ role: "user", content: query }],
  });

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
  );
  const input = (toolUse?.input ?? {}) as {
    category?: string | null;
    subcategory?: string | null;
    hashtag?: string | null;
    country?: string | null;
    q?: string | null;
    sort?: "trending" | "new" | null;
  };

  const category = (POST_CATEGORIES as readonly string[]).includes(input.category ?? "")
    ? (input.category as PostCategory)
    : undefined;
  const subcategory =
    category && input.subcategory && CATEGORY_SUBCATEGORIES[category].includes(input.subcategory)
      ? input.subcategory
      : undefined;
  const country =
    input.country && /^[A-Za-z]{2}$/.test(input.country) ? input.country.toUpperCase() : undefined;
  const [hashtag] = input.hashtag ? await hashtagService.filterExisting([input.hashtag]) : [];

  return {
    category,
    subcategory,
    hashtag,
    country,
    q: input.q ?? undefined,
    sort: input.sort ?? undefined,
  };
}
