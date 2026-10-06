import { createApp } from "./app.js";
import { connectDb } from "./config/db.js";
import { env } from "./config/env.js";
import "./models/index.js";
import { startExpiryCron } from "./workers/expireJobs.js";

async function main(): Promise<void> {
  await connectDb();
  const app = createApp();
  app.listen(env.PORT, env.HOST, () => {
    console.log(`[server] jobs-api listening on http://${env.HOST}:${env.PORT}`);
  });
  startExpiryCron();
}

main().catch((err) => {
  console.error("[server] failed to start:", err);
  process.exit(1);
});
