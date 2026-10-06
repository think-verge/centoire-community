import mongoose from "mongoose";
import type { JobsEvent, JobsEventPayloads, OutboxRecord } from "@centoire/contracts";

/**
 * Producer side of the platform outbox. Core polls this collection and re-emits each row on
 * its in-process event bus, which is how Jobs events become bell notifications on centoire.com.
 */
export async function emitPlatformEvent<T extends JobsEvent>(type: T, payload: JobsEventPayloads[T]): Promise<void> {
  const record: OutboxRecord<T> = { type, payload, producer: "jobs", createdAt: new Date() };
  await mongoose.connection.collection("platform_outbox").insertOne(record as never);
}
