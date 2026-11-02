import "./env.js";
import { createBus, createServer, loadServiceConfig, readEnv, ServiceClient } from "@centoire/bahamut";
import type { DomainEventPayloads } from "@centoire/contracts";
import mongoose from "mongoose";
import { PersonDoc } from "./model.js";
import { searchRouter } from "./routes.js";
import { startSyncLoops } from "./sync.js";

const config = loadServiceConfig("search", { port: 8112 });
if (!config.natsUrl) throw new Error("SEARCH_NATS_URL (or NATS_URL) is required");

await mongoose.connect(readEnv("search", "MONGODB_URI", "mongodb://127.0.0.1:27017")!, {
  dbName: readEnv("search", "DB_NAME", "centoire_search")!,
});
console.log(`[search] connected to ${mongoose.connection.name}`);

const bus = await createBus<DomainEventPayloads>({ service: config.name, url: config.natsUrl });
// Fast path for the one delete that matters most; everything else is covered by id reconciliation.
await bus.on("user.deleted", async ({ userId }) => {
  await PersonDoc.deleteOne({ _id: userId });
});

const server = createServer({ config, bus });
server.mount("/search", searchRouter);
await server.run();

// Core is reached through the gateway's private listener, never by its own address.
const core = new ServiceClient({
  baseUrl: readEnv("search", "GATEWAY_PRIVATE_URL", "http://127.0.0.1:8101")!,
  internalSecret: config.internalSecret,
  caller: "search",
});
startSyncLoops(
  core,
  Number(readEnv("search", "SYNC_MS", "5000")),
  Number(readEnv("search", "RECONCILE_MS", "300000")),
);
