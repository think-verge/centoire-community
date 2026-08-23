import Anthropic from "@anthropic-ai/sdk";
import { env } from "../config/env.js";

const MODEL = "claude-haiku-4-5";

let client: Anthropic | null = null;
let warnedMissingKey = false;

function getClient(): Anthropic | null {
  if (!env.ANTHROPIC_API_KEY) {
    if (!warnedMissingKey) {
      console.log("[region] ANTHROPIC_API_KEY not set — skipping country inference");
      warnedMissingKey = true;
    }
    return null;
  }
  if (!client) client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return client;
}

const TAG_COUNTRY_TOOL: Anthropic.Tool = {
  name: "tag_country",
  description:
    "Record the single country a piece of content is most clearly about, if any.",
  input_schema: {
    type: "object",
    properties: {
      country: {
        type: ["string", "null"],
        description:
          "ISO 3166-1 alpha-2 country code (e.g. 'CN', 'US', 'FR'), or null if the content isn't clearly tied to one country.",
      },
    },
    required: ["country"],
  },
};

export async function inferCountry(input: { title: string; excerpt: string }): Promise<string | null> {
  const anthropic = getClient();
  if (!anthropic) return null;

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 512,
      tools: [TAG_COUNTRY_TOOL],
      tool_choice: { type: "tool", name: "tag_country" },
      messages: [
        {
          role: "user",
          content: `Title: ${input.title}\nExcerpt: ${input.excerpt}`,
        },
      ],
    });

    const toolUse = response.content.find(
      (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
    );
    const country = (toolUse?.input as { country?: string | null } | undefined)?.country;
    if (!country || !/^[A-Za-z]{2}$/.test(country)) return null;
    return country.toUpperCase();
  } catch (err) {
    console.error("[region] country inference failed:", err);
    return null;
  }
}
