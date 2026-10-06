import { beforeEach, describe, expect, it, vi } from "vitest";

// The worker only talks to the models, so stub them and assert on the queries it issues.
const jobFind = vi.fn();
const jobUpdateMany = vi.fn();
const jobCount = vi.fn();
const companyUpdateOne = vi.fn();

vi.mock("../models/index.js", () => ({
  Job: {
    find: (...args: unknown[]) => ({ select: () => jobFind(...args) }),
    updateMany: (...args: unknown[]) => jobUpdateMany(...args),
    countDocuments: (...args: unknown[]) => jobCount(...args),
  },
  Company: { updateOne: (...args: unknown[]) => companyUpdateOne(...args) },
}));

const { expireJobs } = await import("../workers/expireJobs.js");

const id = (s: string) => ({ toString: () => s, _s: s });

beforeEach(() => {
  vi.clearAllMocks();
});

describe("expireJobs", () => {
  it("does nothing when no published job is past its expiry", async () => {
    jobFind.mockResolvedValue([]);
    await expect(expireJobs(new Date("2026-01-01"))).resolves.toBe(0);
    expect(jobUpdateMany).not.toHaveBeenCalled();
    expect(companyUpdateOne).not.toHaveBeenCalled();
  });

  it("only looks at published jobs whose expiry has passed", async () => {
    jobFind.mockResolvedValue([]);
    const now = new Date("2026-03-01");
    await expireJobs(now);
    expect(jobFind).toHaveBeenCalledWith({ status: "published", expiresAt: { $lte: now } });
  });

  it("marks them expired and refreshes each affected company once", async () => {
    jobFind.mockResolvedValue([
      { _id: id("j1"), companyId: id("c1") },
      { _id: id("j2"), companyId: id("c1") },
      { _id: id("j3"), companyId: id("c2") },
    ]);
    jobCount.mockImplementation(async ({ companyId }: { companyId: string }) => (companyId === "c1" ? 4 : 0));

    await expect(expireJobs()).resolves.toBe(3);

    expect(jobUpdateMany).toHaveBeenCalledTimes(1);
    expect(jobUpdateMany.mock.calls[0][1]).toEqual({ $set: { status: "expired" } });
    expect(companyUpdateOne).toHaveBeenCalledTimes(2); // c1 and c2, not three times
    expect(companyUpdateOne).toHaveBeenCalledWith({ _id: "c1" }, { $set: { openJobCount: 4 } });
    expect(companyUpdateOne).toHaveBeenCalledWith({ _id: "c2" }, { $set: { openJobCount: 0 } });
  });
});
