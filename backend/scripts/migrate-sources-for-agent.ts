/**
 * One-off, idempotent: prepares existing Source documents for the external scraper-agent.
 *
 *   npm run migrate:sources -- --dry-run     report only
 *   npm run migrate:sources                  apply
 *
 *  - drops the old non-sparse unique `feedUrl_1` index (agent sources may have no feed) and lets Mongoose
 *    recreate it as unique+sparse
 *  - gives every source the new fields: method "agent", spec.status "none", spec.store "excerpt" (flip a
 *    source to "full" only once you hold the rights for its full text), 30-minute interval
 *  - does NOT enqueue anything: with ENABLE_INGESTION=true the scheduler enqueues discovery on its own
 */
import mongoose from "mongoose";
import { connectDb, disconnectDb } from "../src/config/db.js";
import "../src/models/index.js";
import { Source } from "../src/models/Source.js";

const DRY = process.argv.includes("--dry-run");
const log = (m: string) => console.log(`[migrate]${DRY ? " (dry-run)" : ""} ${m}`);

async function main(): Promise<void> {
  await connectDb();
  const col = mongoose.connection.collection("sources");

  const indexes = await col.indexes();
  const old = indexes.find((i) => i.name === "feedUrl_1" && !i.sparse);
  if (old) {
    log("dropping non-sparse unique index feedUrl_1");
    if (!DRY) await col.dropIndex("feedUrl_1");
  }
  if (!DRY) await Source.syncIndexes();

  const needs = { $or: [{ method: { $exists: false } }, { "spec.status": { $exists: false } }, { scrapeIntervalMin: { $exists: false } }] };
  const count = await col.countDocuments(needs);
  log(`${count} source(s) need the new fields`);
  if (!DRY && count > 0) {
    await col.updateMany({ method: { $exists: false } }, { $set: { method: "agent" } });
    await col.updateMany({ requiresLogin: { $exists: false } }, { $set: { requiresLogin: false } });
    await col.updateMany({ scrapeIntervalMin: { $exists: false } }, { $set: { scrapeIntervalMin: 30 } });
    await col.updateMany({ "spec.status": { $exists: false } }, { $set: { "spec.status": "none", "spec.store": "excerpt" } });
  }
  log(`total sources: ${await col.countDocuments()}`);
  await disconnectDb();
}

main().catch((err) => {
  console.error("[migrate] failed:", err);
  process.exit(1);
});
