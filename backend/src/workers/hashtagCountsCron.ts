import cron from "node-cron";
import { reconcileCounts } from "../services/hashtagService.js";

// Usage counts are maintained incrementally; this nightly pass recomputes them from published posts so
// any drift (a crash between a delete and its decrement, old data, manual DB edits) cannot persist.
export function startHashtagCountsCron(): void {
  cron.schedule("30 3 * * *", async () => {
    try {
      const { updated } = await reconcileCounts();
      if (updated > 0) console.log(`[hashtags] reconciled usage counts (${updated} corrected)`);
    } catch (err) {
      console.error("[hashtags] count reconcile failed:", err);
    }
  });
  console.log("[hashtags] count reconcile scheduled: daily 03:30");
}
