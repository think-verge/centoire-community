import mongoose from "mongoose";
import { JOBS_EVENTS, type JobsEvent, type OutboxRecord } from "@centoire/contracts";
import { env } from "../config/env.js";
import { emitDomainEvent } from "../events/eventBus.js";

const POLL_INTERVAL_MS = 2_000;
const BATCH_SIZE = 100;

/**
 * Bridges mini-app processes onto core's in-process event bus. A producer (jobs-api) writes
 * events into its own database's `platform_outbox`; this polls by _id and re-emits them, so
 * notificationService keeps subscribing to plain domain events. The consumed position is kept
 * in core's DB, which makes restarts at-least-once and never skips an event.
 */
export function startOutboxPoller(producer: string, dbName: string): void {
  const outbox = () => mongoose.connection.useDb(dbName, { useCache: true }).collection("platform_outbox");
  const cursors = () => mongoose.connection.collection("platform_outbox_cursors");
  let running = false;

  async function tick(): Promise<void> {
    if (running) return;
    running = true;
    try {
      const state = await cursors().findOne<{ lastId?: mongoose.Types.ObjectId }>({ producer });
      const filter = state?.lastId ? { _id: { $gt: state.lastId } } : {};
      const batch = await outbox().find(filter).sort({ _id: 1 }).limit(BATCH_SIZE).toArray();
      for (const row of batch) {
        const record = row as unknown as OutboxRecord & { _id: mongoose.Types.ObjectId };
        if (JOBS_EVENTS.includes(record.type as JobsEvent)) {
          emitDomainEvent(record.type, record.payload as never);
        }
        await cursors().updateOne({ producer }, { $set: { lastId: record._id } }, { upsert: true });
      }
    } catch (err) {
      console.error(`[outbox:${producer}] poll failed:`, (err as Error).message);
    } finally {
      running = false;
    }
  }

  setInterval(() => void tick(), POLL_INTERVAL_MS).unref();
  console.log(`[outbox:${producer}] polling ${dbName}.platform_outbox every ${POLL_INTERVAL_MS}ms`);
}
