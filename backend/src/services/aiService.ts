import { env } from "../config/env.js";

export async function fireAiProcessing(
  postId: string,
  opts: { origin: string; url?: string; content?: string },
): Promise<void> {
  if (!env.ENABLE_AI_PROCESSING) {
    console.log(`[ai] processing disabled â€” skipping post ${postId}`);
    return;
  }
  try {
    await fetch(`${env.AI_SERVICE_URL}/v1/process-post`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, ...opts }),
    });
  } catch {
    // fire-and-forget â€” failures are non-critical
  }
}

export async function fireEmbedding(
  postId: string,
  opts: {
    title: string;
    excerpt: string;
    aiSummary?: string;
    hashtags?: string[];
    circleName?: string;
    authorHandle?: string;
    origin: string;
    contentText?: string;
  },
): Promise<void> {
  if (!env.ENABLE_AI_PROCESSING) {
    console.log(`[embed-trigger] AI processing disabled — skipping embed for post ${postId}`);
    return;
  }
  try {
    await fetch(`${env.AI_SERVICE_URL}/v1/embed-post`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, ...opts }),
    });
  } catch (err) {
    // fire-and-forget — failures are non-critical
    console.error(`[embed-trigger] failed to fire embedding for post ${postId}:`, err);
  }
}
