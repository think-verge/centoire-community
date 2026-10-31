import { startRegistration } from "@centoire/bahamut";
import { createApp } from "./app.js";
import { connectDb } from "./config/db.js";
import { env } from "./config/env.js";
import { initEventBus } from "./events/eventBus.js";
import { startIngestionCron } from "./workers/rssCron.js";
import { startCleanupCron } from "./workers/cleanupCron.js";
import { startHashtagCountsCron } from "./workers/hashtagCountsCron.js";

async function main(): Promise<void> {
  await connectDb();
  const bus = await initEventBus("core", env.NATS_URL);
  const app = createApp();
  app.listen(env.PORT, env.HOST, () => {
    console.log(`[server] listening on http://${env.HOST}:${env.PORT}`);
  });
  if (bus) {
    // The monolith registers like any other service; its broad prefixes are the
    // gateway's fallback, so extracted services (longer prefixes) win.
    startRegistration(bus, {
      name: "core",
      address: env.ANNOUNCE_ADDRESS || `http://${env.HOST}:${env.PORT}`,
      routes: () => [{ path: "/api/v1" }, { path: "/api/v1/internal", private: true }, { path: "/uploads" }],
    });
    console.log(`[server] registered with gateway via ${env.NATS_URL}`);
  }
  startIngestionCron();
  startCleanupCron();
  startHashtagCountsCron();
}

main().catch((err) => {
  console.error("[server] failed to start:", err);
  process.exit(1);
});
