import "./env.js";
import { createBus, createServer, loadServiceConfig, readEnv } from "@centoire/bahamut";
import type { DomainEventPayloads } from "@centoire/contracts";
import mongoose from "mongoose";
import { subscribeToEvents } from "./handlers.js";
import { NotificationIdentity, actionRouter, notificationProcessor } from "./routes.js";

const config = loadServiceConfig("notifications", { port: 8111 });
if (!config.natsUrl) throw new Error("NOTIFICATIONS_NATS_URL (or NATS_URL) is required");

// Own database on the shared cluster: no collection is shared with core.
await mongoose.connect(readEnv("notifications", "MONGODB_URI", "mongodb://127.0.0.1:27017")!, {
  dbName: readEnv("notifications", "DB_NAME", "centoire_notifications")!,
});
console.log(`[notifications] connected to ${mongoose.connection.name}`);

const bus = await createBus<DomainEventPayloads>({ service: config.name, url: config.natsUrl });
await subscribeToEvents(bus);

const server = createServer({ config, bus });
server.registerProcessor(NotificationIdentity, notificationProcessor);
server.mount("/notifications", actionRouter);
await server.run();
