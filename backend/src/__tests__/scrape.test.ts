import { beforeEach, describe, expect, it, vi } from "vitest";
import { secretsMatch } from "../middleware/scraperAuth.js";
import { UpsertPostInputSchema, CompleteInputSchema, ExistsInputSchema } from "../schemas/scrapeInternal.js";

// ─── stubs for the model / service layer ─────────────────────────────────────

const postFindOne = vi.fn();
const postCreate = vi.fn();
const evaluate = vi.fn();
const finalizePublish = vi.fn();
const fireAi = vi.fn();
const inferCountry = vi.fn();

vi.mock("../models/Post.js", () => ({ Post: { findOne: (...a: unknown[]) => postFindOne(...a), create: (...a: unknown[]) => postCreate(...a) } }));
vi.mock("../services/policyService.js", () => ({ evaluate: (...a: unknown[]) => evaluate(...a) }));
vi.mock("../services/postService.js", () => ({ finalizePublish: (...a: unknown[]) => finalizePublish(...a) }));
vi.mock("../services/aiService.js", () => ({ fireAiProcessing: (...a: unknown[]) => fireAi(...a) }));
vi.mock("../services/regionService.js", () => ({ inferCountry: (...a: unknown[]) => inferCountry(...a) }));

const { upsertAggregatedPost } = await import("../services/aggregatedPostService.js");

const oid = (s: string) => ({ toString: () => s });
const source = (over: Record<string, unknown> = {}) => ({ _id: oid("s1"), hashtags: ["denim"], spec: { store: "full" }, requiresLogin: false, ...over }) as never;
const LONG = "word ".repeat(400);

function fakePost(over: Record<string, unknown> = {}) {
  return { _id: oid("p1"), status: "pending_review", contentText: "short teaser", save: vi.fn(), ...over };
}

beforeEach(() => {
  vi.clearAllMocks();
  postFindOne.mockResolvedValue(null);
  postCreate.mockImplementation(async (doc: Record<string, unknown>) => fakePost(doc));
  evaluate.mockResolvedValue(null);
  inferCountry.mockResolvedValue(null);
});

describe("upsertAggregatedPost", () => {
  it("creates a pending post with the source's hashtags and fires AI with the URL for short bodies", async () => {
    const res = await upsertAggregatedPost(source(), { url: "https://x.com/a?utm_source=t", title: "A title", excerpt: "teaser" });
    expect(res.outcome).toBe("created");
    const doc = postCreate.mock.calls[0][0];
    expect(doc).toMatchObject({ origin: "aggregated", status: "pending_review", hashtags: ["denim"], contentAccess: "open" });
    expect(fireAi).toHaveBeenCalledWith("p1", { origin: "aggregated", url: "https://x.com/a?utm_source=t" });
  });

  it("hands long (possibly paywalled) text to the AI agent instead of the URL", async () => {
    await upsertAggregatedPost(source(), { url: "https://x.com/a", title: "T", contentText: LONG, contentHtml: "<p>x</p>" });
    expect(fireAi.mock.calls[0][1]).toMatchObject({ origin: "aggregated", content: expect.stringContaining("word") });
    expect(fireAi.mock.calls[0][1].url).toBeUndefined();
  });

  it("marks full-text posts from login sources members-only", async () => {
    await upsertAggregatedPost(source({ requiresLogin: true }), { url: "https://x.com/a", title: "T", contentText: LONG, contentHtml: "<p>x</p>" });
    expect(postCreate.mock.calls[0][0]).toMatchObject({ contentAccess: "members", contentHtml: "<p>x</p>" });
  });

  it("stores no body when the source is excerpt-only, however much the scraper sent", async () => {
    await upsertAggregatedPost(source({ spec: { store: "excerpt" }, requiresLogin: true }), { url: "https://x.com/a", title: "T", contentText: LONG, contentHtml: "<p>x</p>", excerpt: "short" });
    const doc = postCreate.mock.calls[0][0];
    expect(doc.contentHtml).toBeUndefined();
    expect(doc.contentText).toBe("short");
    expect(doc.contentAccess).toBe("open");
  });

  it("auto-approves / auto-rejects according to policy", async () => {
    evaluate.mockResolvedValueOnce("auto_approve");
    await upsertAggregatedPost(source(), { url: "https://x.com/1", title: "T" });
    expect(finalizePublish).toHaveBeenCalledTimes(1);

    evaluate.mockResolvedValueOnce("auto_reject");
    const rejected = await upsertAggregatedPost(source(), { url: "https://x.com/2", title: "T" });
    expect(rejected.post.status).toBe("rejected");
    expect(finalizePublish).toHaveBeenCalledTimes(1);
  });

  it("reports a duplicate for a known URL with no better body", async () => {
    postFindOne.mockResolvedValue(fakePost({ contentText: LONG }));
    const res = await upsertAggregatedPost(source(), { url: "https://x.com/a", title: "T", contentText: LONG });
    expect(res.outcome).toBe("duplicate");
    expect(postCreate).not.toHaveBeenCalled();
  });

  it("enriches a known teaser-only post when a logged-in scrape returns the full body", async () => {
    const existing = fakePost({ contentText: "short teaser" });
    postFindOne.mockResolvedValue(existing);
    const res = await upsertAggregatedPost(source({ requiresLogin: true }), { url: "https://x.com/a", title: "T", contentText: LONG, contentHtml: "<p>full</p>" });
    expect(res.outcome).toBe("updated");
    expect(existing).toMatchObject({ contentHtml: "<p>full</p>", contentAccess: "members" });
    expect(existing.save).toHaveBeenCalled();
  });

  it("treats a lost creation race (duplicate key) as a duplicate, not an error", async () => {
    postCreate.mockRejectedValueOnce(Object.assign(new Error("dup"), { code: 11000 }));
    postFindOne.mockResolvedValueOnce(null).mockResolvedValueOnce(fakePost());
    const res = await upsertAggregatedPost(source(), { url: "https://x.com/a", title: "T" });
    expect(res.outcome).toBe("duplicate");
  });
});

// ─── auth + request schemas ──────────────────────────────────────────────────

describe("scraper secret", () => {
  it("matches only the exact secret", () => {
    expect(secretsMatch("s3cret", "s3cret")).toBe(true);
    expect(secretsMatch("s3cret!", "s3cret")).toBe(false);
    expect(secretsMatch(undefined, "s3cret")).toBe(false);
    expect(secretsMatch("", "s3cret")).toBe(false);
  });
});

describe("internal scrape schemas", () => {
  const base = { sourceId: "6a536720d6f2db000e5375bc", url: "https://x.com/a", title: "T" };

  it("accepts a minimal post and coerces dates / country", () => {
    const parsed = UpsertPostInputSchema.parse({ ...base, publishedAt: "2026-10-01T10:00:00Z", country: "gb" });
    expect(parsed.publishedAt).toBeInstanceOf(Date);
    expect(parsed.country).toBe("GB");
  });

  it("rejects bad ids, non-URLs and oversized bodies", () => {
    expect(() => UpsertPostInputSchema.parse({ ...base, sourceId: "nope" })).toThrow();
    expect(() => UpsertPostInputSchema.parse({ ...base, url: "not a url" })).toThrow();
    expect(() => UpsertPostInputSchema.parse({ ...base, contentHtml: "x".repeat(600_001) })).toThrow();
  });

  it("limits the dedupe batch and validates completion error codes", () => {
    expect(() => ExistsInputSchema.parse({ urls: [] })).toThrow();
    expect(() => ExistsInputSchema.parse({ urls: Array.from({ length: 201 }, (_, i) => `https://x.com/${i}`) })).toThrow();
    expect(CompleteInputSchema.parse({ workerId: "worker-1", ok: false, errorCode: "layout_changed" }).errorCode).toBe("layout_changed");
    expect(() => CompleteInputSchema.parse({ workerId: "worker-1", ok: false, errorCode: "boom" })).toThrow();
  });
});
