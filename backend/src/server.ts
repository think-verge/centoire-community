import { createApp } from "./app.js";
import { connectDb } from "./config/db.js";
import { env } from "./config/env.js";
import { startIngestionCron } from "./workers/rssCron.js";

async function main(): Promise<void> {
  await connectDb();
  const app = createApp();
  app.listen(env.PORT, env.HOST, () => {
    console.log(`[server] listening on http://${env.HOST}:${env.PORT}`);
  });
  startIngestionCron();
}

main().catch((err) => {
  console.error("[server] failed to start:", err);
  process.exit(1);
});
