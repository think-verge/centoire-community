import { beforeEach, describe, expect, it, vi } from "vitest";

const jobFindOne = vi.fn();
const jobFind = vi.fn();
const jobCreate = vi.fn();
const jobUpdateMany = vi.fn();
const jobUpdateOne = vi.fn();
const jobFindOneAndUpdate = vi.fn();
const sourceFind = vi.fn();
const sourceFindById = vi.fn();
const sourceUpdateOne = vi.fn();

const lean = (rows: unknown) => ({ select: () => ({ lean: async () => rows }) });
vi.mock("../models/ScrapeJob.js", () => ({
  ScrapeJob: {
    findOne: (...a: unknown[]) => jobFindOne(...a),
    find: (...a: unknown[]) => lean(jobFind(...a)),
    create: (...a: unknown[]) => jobCreate(...a),
    updateMany: (...a: unknown[]) => jobUpdateMany(...a),
    updateOne: (...a: unknown[]) => jobUpdateOne(...a),
    findOneAndUpdate: (...a: unknown[]) => jobFindOneAndUpdate(...a),
  },
}));
vi.mock("../models/Source.js", () => ({
  SCRAPE_ERROR_CODES: ["login_expired", "layout_changed", "needs_human", "blocked", "network", "internal"],
  Source: { find: (...a: unknown[]) => sourceFind(...a), findById: (...a: unknown[]) => sourceFindById(...a), updateOne: (...a: unknown[]) => sourceUpdateOne(...a) },
}));

const svc = await import("../services/scrapeJobService.js");

const oid = (s: string) => ({ toString: () => s, valueOf: () => s });
const src = (over: Record<string, unknown> = {}) => ({ _id: oid("s1"), active: true, method: "agent", scrapeIntervalMin: 30, spec: { status: "ready" }, ...over });

beforeEach(() => {
  vi.clearAllMocks();
  jobFindOne.mockResolvedValue(null);
  jobFind.mockReturnValue([]);
});

describe("enqueue", () => {
  it("does not queue a second job of the same type for a source", async () => {
    const open = { _id: oid("j1") };
    jobFindOne.mockResolvedValue(open);
    const res = await svc.enqueue("s1", "scrape");
    expect(res).toEqual({ job: open, created: false });
    expect(jobCreate).not.toHaveBeenCalled();
  });

  it("marks the source as discovering when a discover job is queued", async () => {
    jobCreate.mockResolvedValue({ _id: oid("j2") });
    await svc.enqueue("s1", "discover");
    expect(sourceUpdateOne).toHaveBeenCalledWith({ _id: "s1" }, { $set: { "spec.status": "discovering" } });
  });
});

describe("lease", () => {
  it("requeues lapsed leases and fails jobs that lapsed too many times", async () => {
    jobFindOneAndUpdate.mockResolvedValue(null);
    await svc.lease("worker-1");
    expect(jobUpdateMany).toHaveBeenCalledTimes(2);
    expect(jobUpdateMany.mock.calls[0][1].$set.status).toBe("failed");
    expect(jobUpdateMany.mock.calls[1][1].$set.status).toBe("queued");
  });

  it("claims the oldest queued job atomically and returns it with its source", async () => {
    const job = { _id: oid("j1"), sourceId: oid("s1"), type: "scrape" };
    jobFindOneAndUpdate.mockResolvedValueOnce(job);
    sourceFindById.mockResolvedValue(src());
    const res = await svc.lease("worker-1", ["scrape"]);
    expect(res?.job).toBe(job);
    const [filter, update, opts] = jobFindOneAndUpdate.mock.calls[0];
    expect(filter).toEqual({ status: "queued", type: { $in: ["scrape"] } });
    expect(update.$set).toMatchObject({ status: "leased", leasedBy: "worker-1" });
    expect(update.$inc).toEqual({ attempts: 1 });
    expect(opts.sort).toEqual({ createdAt: 1 });
  });

  it("skips (and fails) jobs whose source was paused or deleted, then serves the next one", async () => {
    const dead = { _id: oid("j1"), sourceId: oid("gone") };
    const live = { _id: oid("j2"), sourceId: oid("s1") };
    jobFindOneAndUpdate.mockResolvedValueOnce(dead).mockResolvedValueOnce(live);
    sourceFindById.mockResolvedValueOnce(null).mockResolvedValueOnce(src());
    const res = await svc.lease("worker-1");
    expect(res?.job).toBe(live);
    expect(jobUpdateOne).toHaveBeenCalledWith({ _id: dead._id }, expect.objectContaining({ $set: expect.objectContaining({ status: "failed" }) }));
  });

  it("returns null when nothing is queued", async () => {
    jobFindOneAndUpdate.mockResolvedValue(null);
    expect(await svc.lease("worker-1")).toBeNull();
  });
});

describe("heartbeat / complete", () => {
  it("rejects a worker that does not hold the lease", async () => {
    await expect(svc.heartbeat("j1", "intruder")).rejects.toMatchObject({ statusCode: 409 });
    await expect(svc.complete("j1", "intruder", { ok: true })).rejects.toMatchObject({ statusCode: 409 });
  });

  function leased(type = "scrape") {
    const job = { _id: oid("j1"), sourceId: oid("s1"), type, status: "leased", save: vi.fn(), leaseUntil: new Date(0) } as Record<string, unknown>;
    jobFindOne.mockResolvedValue(job);
    return job;
  }

  it("extends the lease on heartbeat", async () => {
    const job = leased();
    await svc.heartbeat("j1", "worker-1");
    expect((job.leaseUntil as Date).getTime()).toBeGreaterThan(Date.now());
  });

  it("records success on the job and mirrors it onto the source", async () => {
    const job = leased();
    await svc.complete("j1", "worker-1", { ok: true, stats: { itemsSeen: 10, imported: 4, duplicates: 6, updated: 0 } });
    expect(job).toMatchObject({ status: "done", errorCode: undefined });
    const set = sourceUpdateOne.mock.calls[0][1].$set;
    expect(set.lastStatus).toBe("ok");
    expect(set.lastRun).toMatchObject({ status: "ok", imported: 4, duplicates: 6 });
    expect(set["spec.status"]).toBeUndefined();
  });

  it.each([
    ["layout_changed", "needs_rediscovery"],
    ["needs_human", "needs_human"],
    ["login_expired", "needs_human"],
  ])("maps failure %s to spec status %s", async (errorCode, specStatus) => {
    leased();
    await svc.complete("j1", "worker-1", { ok: false, errorCode: errorCode as never, errorMessage: "x" });
    expect(sourceUpdateOne.mock.calls[0][1].$set["spec.status"]).toBe(specStatus);
  });

  it("resets the spec to 'none' when discovery itself fails for another reason", async () => {
    leased("discover");
    await svc.complete("j1", "worker-1", { ok: false, errorCode: "network" });
    expect(sourceUpdateOne.mock.calls[0][1].$set["spec.status"]).toBe("none");
  });
});

describe("scheduleDueJobs", () => {
  const now = new Date("2026-10-11T12:00:00Z");
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

  it("enqueues discovery for new sources, scrapes for due ready sources, and nothing else", async () => {
    sourceFind.mockResolvedValue([
      src({ _id: oid("new"), spec: { status: "none" } }),
      src({ _id: oid("due"), spec: { status: "ready" }, lastRun: { finishedAt: minutesAgo(45) } }),
      src({ _id: oid("fresh"), spec: { status: "ready" }, lastRun: { finishedAt: minutesAgo(5) } }),
      src({ _id: oid("human"), spec: { status: "needs_human" } }),
      src({ _id: oid("busy"), spec: { status: "discovering" } }),
    ]);
    jobCreate.mockImplementation(async (d: Record<string, unknown>) => ({ _id: oid("j"), ...d }));
    const { enqueued } = await svc.scheduleDueJobs(now);
    expect(enqueued).toBe(2);
    expect(jobCreate.mock.calls.map((c) => [String(c[0].sourceId), c[0].type]).sort()).toEqual([["due", "scrape"], ["new", "discover"]]);
  });

  it("does not stack jobs or retry discovery inside the cool-down", async () => {
    sourceFind.mockResolvedValue([
      src({ _id: oid("a"), spec: { status: "needs_rediscovery" } }),
      src({ _id: oid("b"), spec: { status: "ready" }, lastRun: { finishedAt: minutesAgo(90) } }),
    ]);
    jobFind
      .mockReturnValueOnce([{ sourceId: oid("b"), type: "scrape" }]) // open jobs
      .mockReturnValueOnce([{ sourceId: oid("a") }]); // discovery attempted recently
    expect((await svc.scheduleDueJobs(now)).enqueued).toBe(0);
    expect(jobCreate).not.toHaveBeenCalled();
  });
});
