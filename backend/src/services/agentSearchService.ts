import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";
import { CATEGORY_SUBCATEGORIES, POST_CATEGORIES, type PostCategory } from "../config/categoryTaxonomy.js";
import { Tag } from "../models/Tag.js";
import { ApiError } from "../utils/api-error.js";

const MODEL = "claude-haiku-4-5";

export interface ResolvedFilters {
  category?: PostCategory;
  subcategory?: string;
  tagSlug?: string;
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
      tagSlug: {
        type: ["string", "null"],
        description: "The single best-matching tag slug from the provided tag list, or null if none clearly applies.",
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
    required: ["category", "subcategory", "tagSlug", "country", "q", "sort"],
  },
};

function buildSystemPrompt(tags: { name: string; slug: string }[]): string {
  const categoryLines = POST_CATEGORIES.map(
    (category) => `- ${category}: ${CATEGORY_SUBCATEGORIES[category].join(", ")}`,
  ).join("\n");
  const tagLines = tags.map((t) => `${t.slug} (${t.name})`).join(", ");
  return [
    "You turn a user's natural-language content request into structured filters for a fashion/lifestyle news platform.",
    "Only use categories, subcategories, and tag slugs from the lists below — never invent new ones.",
    "",
    "Categories and their subcategories:",
    categoryLines,
    "",
    "Known tag slugs:",
    tagLines,
    "",
    "Call apply_search_filters exactly once with your best interpretation.",
  ].join("\n");
}

export async function interpretQuery(query: string): Promise<ResolvedFilters> {
  const anthropic = getClient();
  const tags = await Tag.find().select("name slug").lean();

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 512,
    system: buildSystemPrompt(tags.map((t) => ({ name: t.name, slug: t.slug }))),
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
    tagSlug?: string | null;
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
  const knownSlugs = new Set(tags.map((t) => t.slug));
  const tagSlug = input.tagSlug && knownSlugs.has(input.tagSlug) ? input.tagSlug : undefined;

  return {
    category,
    subcategory,
    tagSlug,
    country,
    q: input.q ?? undefined,
    sort: input.sort ?? undefined,
  };
}
