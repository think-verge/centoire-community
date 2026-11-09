import { Types } from "mongoose";
import { emitDomainEvent } from "../events/eventBus.js";
import { Event, type EventAction, type EventTargetType } from "../models/Event.js";
import type { BehaviorEventItem } from "@centoire/contracts";

export interface IngestItemInput {
  action: EventAction;
  postId?: string;
  targetType?: EventTargetType;
  targetId?: string;
  position?: number;
  source?: string;
  score?: number;
  dwellMs?: number;
  idempotencyKey?: string;
  sessionId?: string;
  at?: string | number | Date;
  metadata?: Record<string, unknown>;
}

export interface IngestResult {
  accepted: number;
  duplicates: number;
}

export async function ingestEventBatch(
  items: IngestItemInput[],
  authenticatedUserId?: string,
): Promise<IngestResult> {
  if (!items.length) {
    return { accepted: 0, duplicates: 0 };
  }

  const normalizedDocs = items.map((item) => {
    let atDate: Date;
    if (item.at instanceof Date) {
      atDate = item.at;
    } else if (typeof item.at === "number") {
      atDate = new Date(item.at);
    } else if (typeof item.at === "string") {
      atDate = new Date(item.at);
      if (isNaN(atDate.getTime())) atDate = new Date();
    } else {
      atDate = new Date();
    }

    const doc: Record<string, unknown> = {
      action: item.action,
      at: atDate,
      createdAt: atDate,
      updatedAt: atDate,
    };

    const resolvedUserId = authenticatedUserId || undefined;
    if (resolvedUserId && Types.ObjectId.isValid(resolvedUserId)) {
      doc.userId = new Types.ObjectId(resolvedUserId);
    }

    if (item.sessionId) {
      doc.sessionId = item.sessionId;
    }

    if (item.postId && Types.ObjectId.isValid(item.postId)) {
      doc.postId = new Types.ObjectId(item.postId);
    }

    if (item.targetType) {
      doc.targetType = item.targetType;
    }

    if (item.targetId) {
      doc.targetId = item.targetId;
    }

    if (typeof item.position === "number") {
      doc.position = item.position;
    }

    if (item.source) {
      doc.source = item.source;
    }

    if (typeof item.score === "number") {
      doc.score = item.score;
    }

    if (typeof item.dwellMs === "number") {
      doc.dwellMs = item.dwellMs;
    }

    if (item.idempotencyKey) {
      doc.idempotencyKey = item.idempotencyKey;
    }

    if (item.metadata) {
      doc.metadata = item.metadata;
    }

    return doc;
  });

  const ops = normalizedDocs.map((doc) => ({
    insertOne: {
      document: doc,
    },
  }));

  let accepted: number;
  let duplicates = 0;

  try {
    const result = await Event.bulkWrite(ops, { ordered: false });
    accepted = result.insertedCount;
  } catch (err: unknown) {
    const mongoErr = err as {
      name?: string;
      code?: number;
      result?: { insertedCount?: number };
      writeErrors?: Array<{ code?: number }>;
    };
    if (mongoErr.name === "MongoBulkWriteError" || mongoErr.code === 11000) {
      // Duplicates encountered; bulkWrite inserted whatever didn't collide
      accepted = mongoErr.result?.insertedCount ?? 0;
      duplicates = mongoErr.writeErrors
        ? mongoErr.writeErrors.filter((e) => e.code === 11000).length
        : items.length - accepted;
    } else {
      throw err;
    }
  }

  // Publish to NATS JetStream events.behavior.batch
  const busItems: BehaviorEventItem[] = normalizedDocs.map((d) => ({
    userId: d.userId ? d.userId.toString() : undefined,
    sessionId: (d.sessionId as string) || undefined,
    action: d.action as BehaviorEventItem["action"],
    postId: d.postId ? d.postId.toString() : undefined,
    targetType: (d.targetType as BehaviorEventItem["targetType"]) || undefined,
    targetId: (d.targetId as string) || undefined,
    position: (d.position as number) || undefined,
    source: (d.source as string) || undefined,
    score: (d.score as number) || undefined,
    dwellMs: (d.dwellMs as number) || undefined,
    idempotencyKey: (d.idempotencyKey as string) || undefined,
    at: (d.at as Date).toISOString(),
    metadata: (d.metadata as Record<string, unknown>) || undefined,
  }));

  try {
    emitDomainEvent("behavior.batch", { events: busItems });
  } catch (natsErr) {
    console.warn("[events] failed to publish behavior.batch to NATS", natsErr);
  }

  return { accepted, duplicates };
}

/**
 * Helper for recording server-side events (like, save, comment, follow, circle join)
 * into the events collection and NATS.
 */
export async function recordServerEvent(opts: {
  userId?: string;
  action: EventAction;
  postId?: string;
  targetType?: EventTargetType;
  targetId?: string;
  metadata?: Record<string, unknown>;
  idempotencyKey?: string;
}): Promise<void> {
  await ingestEventBatch(
    [
      {
        action: opts.action,
        postId: opts.postId,
        targetType: opts.targetType,
        targetId: opts.targetId,
        metadata: opts.metadata,
        idempotencyKey: opts.idempotencyKey,
      },
    ],
    opts.userId,
  );
}
