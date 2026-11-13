import cron from "node-cron";
import { env } from "../config/env.js";
import { pullQueue } from "../services/discoveryPullService.js";

export function startDiscoveryPullCron(): void {
  if (!env.ENABLE_DISCOVERY_PULL) {
    console.log("[discovery-pull] disabled (set ENABLE_DISCOVERY_PULL=true to enable)");
    return;
  }
  cron.schedule(env.DISCOVERY_PULL_CRON, async () => {
    try {
      const { pulled, skipped } = await pullQueue();
      if (pulled || skipped) console.log(`[discovery-pull] ${pulled} stories saved, ${skipped} skipped`);
    } catch (err) {
      console.warn("[discovery-pull] pull failed:", (err as Error).message);
    }
  });
  console.log(`[discovery-pull] scheduled: ${env.DISCOVERY_PULL_CRON}`);
}
