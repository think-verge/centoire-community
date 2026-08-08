import { env } from "../config/env.js";

export async function fireAiProcessing(
  postId: string,
  opts: { origin: string; url?: string; content?: string },
): Promise<void> {
  if (!env.ENABLE_AI_PROCESSING) {
    console.log(`[ai] processing disabled — skipping post ${postId}`);
    return;
  }
  try {
    await fetch(`${env.AI_SERVICE_URL}/v1/process-post`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, ...opts }),
    });
  } catch {
    // fire-and-forget — failures are non-critical
  }
}
