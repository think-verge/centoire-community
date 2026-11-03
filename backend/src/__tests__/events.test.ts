import { describe, expect, it, vi } from "vitest";
import { EventBatchInputSchema, EventItemInputSchema } from "../schemas/events.js";
import { ingestEventBatch } from "../services/eventService.js";
import { Event } from "../models/Event.js";
import * as eventBus from "../events/eventBus.js";

describe("Event Schemas", () => {
  it("validates valid event items for client and server actions", () => {
    const validItem = {
      action: "impression",
      postId: "64e8583545842eb7f0701234",
      position: 0,
      source: "feed_for_you",
      score: 0.95,
      dwellMs: 15000,
      idempotencyKey: "evt-uuid-1",
      sessionId: "session-abc",
      at: new Date().toISOString(),
    };
    expect(EventItemInputSchema.parse(validItem).action).toBe("impression");

    const allActions = [
      "impression",
      "read",
      "dwell",
      "hide",
      "report",
      "suggestion_impression",
      "suggestion_dismiss",
      "upvote",
      "save",
      "comment",
      "share",
      "follow",
      "circle_join",
    ];

    for (const action of allActions) {
      expect(EventItemInputSchema.parse({ action }).action).toBe(action);
    }
  });

  it("rejects unknown action types", () => {
    expect(() => EventItemInputSchema.parse({ action: "unknown_action" })).toThrow();
  });

  it("requires at least 1 event and at most 100 events in batch", () => {
    expect(() => EventBatchInputSchema.parse({ events: [] })).toThrow();

    const single = EventBatchInputSchema.parse({
      events: [{ action: "read", postId: "64e8583545842eb7f0701234" }],
    });
    expect(single.events).toHaveLength(1);

    const overLimit = Array.from({ length: 101 }, (_, i) => ({
      action: "impression",
      idempotencyKey: `key-${i}`,
    }));
    expect(() => EventBatchInputSchema.parse({ events: overLimit })).toThrow();
  });
});

describe("ingestEventBatch", () => {
  it("bulk writes events and emits behavior.batch onto eventBus", async () => {
    const bulkWriteSpy = vi.spyOn(Event, "bulkWrite").mockResolvedValueOnce({
      insertedCount: 2,
    } as any);
    const emitSpy = vi.spyOn(eventBus, "emitDomainEvent").mockImplementation(() => {});

    const items = [
      { action: "impression" as const, postId: "64e8583545842eb7f0701234", position: 1 },
      { action: "read" as const, postId: "64e8583545842eb7f0701234", dwellMs: 12000 },
    ];

    const result = await ingestEventBatch(items, "64e8583545842eb7f0709999");
    expect(result.accepted).toBe(2);
    expect(result.duplicates).toBe(0);
    expect(bulkWriteSpy).toHaveBeenCalled();
    expect(emitSpy).toHaveBeenCalledWith("behavior.batch", expect.objectContaining({
      events: expect.arrayContaining([
        expect.objectContaining({ action: "impression" }),
        expect.objectContaining({ action: "read" }),
      ]),
    }));
  });

  it("handles duplicate key collisions gracefully by returning duplicates count", async () => {
    const duplicateErr: any = new Error("E11000 duplicate key error");
    duplicateErr.name = "MongoBulkWriteError";
    duplicateErr.code = 11000;
    duplicateErr.result = { insertedCount: 1 };
    duplicateErr.writeErrors = [{ code: 11000 }];

    vi.spyOn(Event, "bulkWrite").mockRejectedValueOnce(duplicateErr);
    vi.spyOn(eventBus, "emitDomainEvent").mockImplementation(() => {});

    const items = [
      { action: "impression" as const, idempotencyKey: "dup-key-1" },
      { action: "impression" as const, idempotencyKey: "dup-key-1" },
    ];

    const result = await ingestEventBatch(items);
    expect(result.accepted).toBe(1);
    expect(result.duplicates).toBe(1);
  });
});
