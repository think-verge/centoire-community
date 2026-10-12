import { beforeEach, describe, expect, it, vi } from "vitest";
import { CreateSourceInputSchema } from "../schemas/sources.js";

const sourceCreate = vi.fn();
const sourceFindOne = vi.fn();
const sourceFindById = vi.fn();
const enqueue = vi.fn();
const fetchSource = vi.fn();

vi.mock("../models/Source.js", () => ({
  Source: { create: (...a: unknown[]) => sourceCreate(...a), findOne: (...a: unknown[]) => sourceFindOne(...a), findById: (...a: unknown[]) => sourceFindById(...a) },
}));
vi.mock("../services/scrapeJobService.js", () => ({ enqueue: (...a: unknown[]) => enqueue(...a), recentJobs: vi.fn() }));
vi.mock("../services/ingestionService.js", () => ({ fetchSource: (...a: unknown[]) => fetchSource(...a) }));
vi.mock("../services/hashtagService.js", () => ({ ensureHashtags: async (names: string[]) => names }));

const { create, fetchNow, rediscover } = await import("../controllers/sourceController.js");

const oid = (s: string) => ({ toString: () => s });
function res() {
  const r = { statusCode: 200, body: undefined as unknown, status: vi.fn(), json: vi.fn(), end: vi.fn() };
  r.status.mockImplementation((c: number) => ((r.statusCode = c), r));
  r.json.mockImplementation((b: unknown) => ((r.body = b), r));
  return r;
}
const stored = (over: Record<string, unknown> = {}) => ({
  _id: oid("s1"), name: "Daily", siteUrl: "https://daily.test", method: "agent", requiresLogin: false, scrapeIntervalMin: 30,
  spec: { status: "none", store: "excerpt" }, hashtags: [], active: true, ...over,
});
const req = (body: unknown, params = {}) => ({ body, params, user: { userId: "u1" } }) as never;

beforeEach(() => {
  vi.clearAllMocks();
  sourceFindOne.mockResolvedValue(null);
  enqueue.mockResolvedValue({ job: { _id: oid("j1") }, created: true });
});

describe("source admin", () => {
  it("accepts a source without a feed URL", () => {
    expect(CreateSourceInputSchema.safeParse({ name: "Daily", siteUrl: "https://daily.test" }).success).toBe(true);
  });

  it("rejects a credentialRef that looks like a password-ish free text", () => {
    expect(CreateSourceInputSchema.safeParse({ name: "D", siteUrl: "https://d.test", credentialRef: "My Pass 123!" }).success).toBe(false);
  });

  it("creating an agent source enqueues discovery", async () => {
    sourceCreate.mockResolvedValue(stored());
    sourceFindById.mockResolvedValue(stored({ spec: { status: "discovering", store: "excerpt" } }));
    const r = res();
    await create(req({ name: "Daily", siteUrl: "https://daily.test" }), r as never);
    expect(enqueue).toHaveBeenCalledWith(expect.anything(), "discover", "u1");
    expect(r.statusCode).toBe(201);
    expect((r.body as { spec: { status: string } }).spec.status).toBe("discovering");
  });

  it("requires a credentialRef when the source needs a login", async () => {
    await expect(create(req({ name: "Daily", siteUrl: "https://daily.test", requiresLogin: true }), res() as never)).rejects.toMatchObject({ statusCode: 422 });
    expect(sourceCreate).not.toHaveBeenCalled();
  });

  it("Fetch now scrapes when the spec is ready, and discovers first when it is not", async () => {
    sourceFindById.mockResolvedValueOnce(stored({ spec: { status: "ready", store: "full" } }));
    const a = res();
    await fetchNow(req({}, { id: "s1" }), a as never);
    expect(enqueue).toHaveBeenLastCalledWith(expect.anything(), "scrape", "u1");
    expect(a.body).toMatchObject({ mode: "agent", type: "scrape", jobId: "j1" });

    sourceFindById.mockResolvedValueOnce(stored());
    const b = res();
    await fetchNow(req({}, { id: "s1" }), b as never);
    expect(enqueue).toHaveBeenLastCalledWith(expect.anything(), "discover", "u1");
    expect(fetchSource).not.toHaveBeenCalled(); // never runs in the HTTP request any more
  });

  it("Re-discover enqueues a discover job and reports when one was already queued", async () => {
    sourceFindById.mockResolvedValue(stored({ spec: { status: "ready", store: "full" } }));
    enqueue.mockResolvedValue({ job: { _id: oid("j9") }, created: false });
    const r = res();
    await rediscover(req({}, { id: "s1" }), r as never);
    expect(r.body).toMatchObject({ type: "discover", created: false, jobId: "j9" });
  });
});
