import cron from "node-cron";
import { env } from "../config/env.js";

/**
 * Starts whatever drives ingestion for the configured mode.
 *  - agent: a once-a-minute scheduler enqueues scrape/discover jobs; the external scraper-agent leases them.
 *  - rss:   the legacy in-process RSS fetch on INGESTION_CRON (rollback path).
 * Both are off unless ENABLE_INGESTION=true, so local dev doesn't hit the network by accident.
 */
export function startIngestionCron(): void {
  if (!env.ENABLE_INGESTION) {
    console.log("[ingestion] disabled (set ENABLE_INGESTION=true to enable)");
    return;
  }

  if (env.INGESTION_MODE === "agent") {
    cron.schedule("* * * * *", async () => {
      try {
        const { scheduleDueJobs } = await import("../services/scrapeJobService.js");
        const { enqueued } = await scheduleDueJobs();
        if (enqueued > 0) console.log(`[scrape] enqueued ${enqueued} job(s)`);
      } catch (err) {
        console.error("[scrape] scheduling failed:", err);
      }
    });
    console.log("[ingestion] agent mode: scheduler running every minute (scraper-agent leases the jobs)");
    return;
  }

  cron.schedule(env.INGESTION_CRON, async () => {
    const { fetchAllActiveSources } = await import("../services/ingestionService.js");
    try {
      await fetchAllActiveSources();
    } catch (err) {
      console.error("[ingestion] run failed:", err);
    }
  });
  console.log(`[ingestion] rss mode: scheduled ${env.INGESTION_CRON}`);
}
