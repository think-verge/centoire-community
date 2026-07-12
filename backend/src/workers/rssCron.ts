import cron from "node-cron";
import { env } from "../config/env.js";

export function startIngestionCron(): void {
  if (!env.ENABLE_INGESTION) {
    console.log("[ingestion] disabled (set ENABLE_INGESTION=true to enable)");
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
  console.log(`[ingestion] scheduled: ${env.INGESTION_CRON}`);
}
