import { createApp } from "./app.js";
import { connectDb } from "./config/db.js";
import { env } from "./config/env.js";
import { startIngestionCron } from "./workers/rssCron.js";
import { startCleanupCron } from "./workers/cleanupCron.js";
import { startOutboxPoller } from "./workers/outboxPoller.js";

async function main(): Promise<void> {
  await connectDb();
  const app = createApp();
  app.listen(env.PORT, env.HOST, () => {
    console.log(`[server] listening on http://${env.HOST}:${env.PORT}`);
  });
  startIngestionCron();
  startCleanupCron();
  startOutboxPoller("jobs", env.JOBS_DB_NAME);
}

main().catch((err) => {
  console.error("[server] failed to start:", err);
  process.exit(1);
});
