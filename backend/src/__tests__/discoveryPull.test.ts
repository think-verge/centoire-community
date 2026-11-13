import { beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import { DiscoveryCursor } from "../models/DiscoveryCursor.js";
import { Source } from "../models/Source.js";
import * as discoveryService from "../services/discoveryService.js";
import { pullQueue, requestFetch } from "../services/discoveryPullService.js";
import { fetchNow } from "../controllers/sourceController.js";

const payload = (id: string) => ({
  storyId: id,
  title: `Story ${id}`,
  externalUrl: `https://example.com/${id}`,
  publishedAt: "2026-11-07T01:29:00Z",
  discovery: { websiteCount: 1, articleCount: 1, spread: [], markets: [] },
});
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function mockCursor(since: Date | null) {
  vi.spyOn(DiscoveryCursor, "findById").mockResolvedValue((since ? { since } : null) as never);
  return vi.spyOn(DiscoveryCursor, "findByIdAndUpdate").mockResolvedValue(null as never);
}

describe("discovery queue pull", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  it("upserts valid items, skips invalid ones and saves the cursor", async () => {
    const save = mockCursor(new Date("2026-11-01T00:00:00Z"));
    const upsert = vi.spyOn(discoveryService, "upsertStory").mockResolvedValue({} as never);
    const f = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        json({
          items: [
            { storyId: "a", queuedAt: "x", payload: payload("a") },
            { storyId: "bad", queuedAt: "x", payload: { storyId: "bad" } },
          ],
          nextSince: "2026-11-02T00:00:00.000Z",
        }),
      )
      .mockResolvedValueOnce(json({ items: [{ storyId: "a", payload: payload("a") }, { storyId: "bad", payload: {} }], nextSince: "2026-11-02T00:00:00.000Z" }))
      .mockResolvedValueOnce(json({ items: [], nextSince: "2026-11-02T00:00:00.000Z" }));
    const r = await pullQueue();
    expect(r).toEqual({ pulled: 1, skipped: 1 });
    expect(upsert).toHaveBeenCalledTimes(1);
    const [url, init] = f.mock.calls[0]!;
    expect(String(url)).toContain("/queue?since=2026-11-01T00%3A00%3A00.000Z");
    expect((init as RequestInit).headers).toMatchObject({ "x-internal-secret": "dev-internal-secret" });
    expect(save).toHaveBeenCalledWith("queue", { since: new Date("2026-11-02T00:00:00.000Z") }, { upsert: true });
  });

  it("loops over full pages until the queue is empty", async () => {
    mockCursor(null);
    const upsert = vi.spyOn(discoveryService, "upsertStory").mockResolvedValue({} as never);
    const page = (n: number, next: string) =>
      json({ items: Array.from({ length: n }, (_, i) => ({ storyId: `s${next}${i}`, payload: payload(`s${next}${i}`) })), nextSince: next });
    const f = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(page(100, "2026-11-02T00:00:00.000Z"))
      .mockResolvedValueOnce(page(2, "2026-11-03T00:00:00.000Z"));
    const r = await pullQueue();
    expect(r.pulled).toBe(102);
    expect(upsert).toHaveBeenCalledTimes(102);
    expect(f).toHaveBeenCalledTimes(2);
    expect(String(f.mock.calls[1]![0])).toContain(encodeURIComponent("2026-11-02T00:00:00.000Z"));
  });

  it("does not overlap pulls", async () => {
    mockCursor(null);
    let release!: (r: Response) => void;
    const f = vi.spyOn(globalThis, "fetch").mockReturnValueOnce(new Promise((res) => (release = res)));
    const first = pullQueue();
    await new Promise((r) => setImmediate(r));
    expect(await pullQueue()).toEqual({ pulled: 0, skipped: 0 });
    release(json({ items: [], nextSince: "2026-11-02T00:00:00.000Z" }));
    await first;
    expect(f).toHaveBeenCalledTimes(1);
  });

  it("answers 503 when the engine is down", async () => {
    mockCursor(null);
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("fetch failed"));
    await expect(pullQueue()).rejects.toMatchObject({ statusCode: 503 });
    // lock was released
    await expect(pullQueue()).rejects.toMatchObject({ statusCode: 503 });
  });

  it("requestFetch posts to the engine then pulls", async () => {
    mockCursor(null);
    vi.spyOn(discoveryService, "upsertStory").mockResolvedValue({} as never);
    const f = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json({ polled: 3, newItems: 2, queued: 1 }))
      .mockResolvedValueOnce(json({ items: [{ storyId: "a", payload: payload("a") }], nextSince: "2026-11-02T00:00:00.000Z" }));
    const r = await requestFetch("abc");
    expect(r).toEqual({ polled: 3, newItems: 2, queued: 1, pulled: 1 });
    const init = f.mock.calls[0]![1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(init.body).toBe(JSON.stringify({ sourceId: "abc" }));
  });

  it("requestFetch maps an unreachable engine to 503", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));
    await expect(requestFetch("abc")).rejects.toMatchObject({ statusCode: 503 });
  });

  it("fetchNow calls the engine and keeps the response shape", async () => {
    const id = new Types.ObjectId();
    vi.spyOn(Source, "findById").mockResolvedValue({ _id: id, name: "GQ", kind: "rss" } as never);
    mockCursor(null);
    vi.spyOn(discoveryService, "upsertStory").mockResolvedValue({} as never);
    const f = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(json({ polled: 5, newItems: 2, queued: 1 }))
      .mockResolvedValueOnce(json({ items: [], nextSince: "2026-11-02T00:00:00.000Z" }));
    const res = { json: vi.fn() };
    await fetchNow({ params: { id: id.toString() } } as never, res as never);
    expect(JSON.parse((f.mock.calls[0]![1] as RequestInit).body as string)).toEqual({ sourceId: id.toString() });
    expect(res.json).toHaveBeenCalledWith({
      sourceId: id.toString(),
      sourceName: "GQ",
      itemsSeen: 5,
      imported: 2,
      skippedDuplicates: 3,
      queued: 1,
      pulled: 0,
    });
  });

  it("listEngineSources returns every source with a feed URL except the placeholder", async () => {
    const sort = vi.fn().mockResolvedValue([]);
    const find = vi.spyOn(Source, "find").mockReturnValue({ sort } as never);
    await discoveryService.listEngineSources();
    expect(find).toHaveBeenCalledWith({ kind: { $ne: "discovery" }, feedUrl: { $exists: true, $nin: [null, ""] } });
  });
});
