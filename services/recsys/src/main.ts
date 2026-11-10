import "./env.js";
import { createBus, createServer, loadServiceConfig, readEnv } from "@centoire/bahamut";
import type { DomainEventPayloads } from "@centoire/contracts";
import mongoose from "mongoose";
import { forYouRouter, suggestionsRouter, internalRecsysRouter } from "./routes.js";

const config = loadServiceConfig("recsys", { port: 8004 });

const mongoUri = readEnv("recsys", "MONGODB_URI", "mongodb://127.0.0.1:27017")!;
const dbName = readEnv("recsys", "DB_NAME", "centoire_recsys")!;

try {
  await mongoose.connect(mongoUri, { dbName, serverSelectionTimeoutMS: 2000 });
  console.log(`[recsys] connected to ${mongoose.connection.name}`);
} catch (err) {
  console.warn(`[recsys] database connection failed, continuing in memory mode: ${(err as Error).message}`);
}

const bus = config.natsUrl
  ? await createBus<DomainEventPayloads>({ service: config.name, url: config.natsUrl })
  : undefined;

if (bus) {
  // Ticket #117: Consume user.deleted to ensure recsys stores purge user data
  await bus.on("user.deleted", async ({ userId }) => {
    console.log(`[recsys] received user.deleted for ${userId}`);
    if (mongoose.connection.readyState === 1 && mongoose.connection.db) {
      try {
        const collections = await mongoose.connection.db.listCollections().toArray();
        for (const col of collections) {
          try {
            const filter: Record<string, unknown>[] = [{ userId }, { user_id: userId }];
            if (mongoose.Types.ObjectId.isValid(userId)) {
              filter.push({ _id: new mongoose.Types.ObjectId(userId) });
            }
            await mongoose.connection.db.collection(col.name).deleteMany({
              $or: filter as any,
            });
          } catch {
            // ignore non-matching collection schema errors
          }
        }
      } catch (err) {
        console.warn(`[recsys] error cleaning up data for user.deleted: ${(err as Error).message}`);
      }
    }
  });
}

const server = createServer({ config, bus });

server.mount("/feed/for-you", forYouRouter);
server.mount("/suggestions", suggestionsRouter);
server.mount("/internal/recsys", internalRecsysRouter, { private: true });
server.mount("/recsys/healthz", (_req, res) => res.json({ status: "ok", service: "recsys" }));

await server.run();
