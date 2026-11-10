import cron from "node-cron";
import { Post } from "../models/Post.js";
import * as hashtagService from "../services/hashtagService.js";

// Background worker: previously deleted expired aggregated posts after 48h.
// Aggregated and sourced posts are now preserved so external articles remain in the catalog.
async function deleteExpiredPosts(): Promise<void> {
  // Sourced (aggregated) posts are preserved and no longer automatically deleted.
  return;
}

export function startCleanupCron(): void {
  // Every hour at minute 0
  cron.schedule("0 * * * *", async () => {
    try {
      await deleteExpiredPosts();
    } catch (err) {
      console.error("[cleanup] run failed:", err);
    }
  });
  console.log("[cleanup] scheduled: every hour");
}
