import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  diffHashtags,
  escapeRegex,
  normalizeHashtag,
  normalizeHashtags,
  normalizePrefix,
} from "../utils/hashtag.js";
import { HashtagListQuerySchema, HashtagNameParamsSchema } from "../schemas/hashtags.js";
import { CreatePostInputSchema } from "../schemas/posts.js";

describe("normalizeHashtag", () => {
  it.each([
    ["#Art", "art"],
    ["  Pattern Making ", "patternmaking"],
    ["street-style", "streetstyle"],
    ["#Haute_Couture", "haute_couture"],
    ["ÉCOLE", "école"],
    ["東京", "東京"],
  ])("%j -> %j", (input, expected) => {
    expect(normalizeHashtag(input)).toBe(expected);
  });

  it.each(["", "#", "a", "###", "12345", "___", "x".repeat(31), 42, null, undefined])("rejects %j", (input) => {
    expect(normalizeHashtag(input)).toBeNull();
  });

  it("strips regex and html characters so they can never reach a query", () => {
    expect(normalizeHashtag("art.*<script>")).toBe("artscript");
  });
});

describe("normalizePrefix", () => {
  it("allows a single character while typing and caps length", () => {
    expect(normalizePrefix("A")).toBe("a");
    expect(normalizePrefix("#Fa")).toBe("fa");
    expect(normalizePrefix("x".repeat(80))).toHaveLength(30);
    expect(normalizePrefix(undefined)).toBe("");
  });
});

describe("normalizeHashtags", () => {
  it("dedupes, drops invalid values, keeps order and honours the cap", () => {
    expect(normalizeHashtags(["#Art", "art", "ART", "x", "denim", "knit wear"])).toEqual(["art", "denim", "knitwear"]);
    expect(normalizeHashtags(["aa", "bb", "cc", "dd"], 2)).toEqual(["aa", "bb"]);
  });
});

describe("diffHashtags / escapeRegex", () => {
  it("reports exactly what was added and removed", () => {
    expect(diffHashtags(["art", "denim"], ["denim", "knit"])).toEqual({ added: ["knit"], removed: ["art"] });
    expect(diffHashtags([], ["a1"])).toEqual({ added: ["a1"], removed: [] });
  });

  it("escapes every regex metacharacter", () => {
    expect(escapeRegex("a.b*c+d?e^f$g{h}i(j)k|l[m]n\\o")).toBe("a\\.b\\*c\\+d\\?e\\^f\\$g\\{h\\}i\\(j\\)k\\|l\\[m\\]n\\\\o");
  });
});

describe("schemas", () => {
  it("bounds the typeahead query", () => {
    expect(HashtagListQuerySchema.parse({ q: "ar", limit: "8", featured: "true" })).toEqual({ q: "ar", limit: 8, featured: true });
    expect(() => HashtagListQuerySchema.parse({ limit: "999" })).toThrow();
    expect(() => HashtagNameParamsSchema.parse({ name: "" })).toThrow();
  });

  it("allows 0-5 hashtags on a post draft and rejects 6", () => {
    expect(CreatePostInputSchema.parse({ title: "T" }).hashtags).toBeUndefined();
    expect(CreatePostInputSchema.parse({ title: "T", hashtags: ["aa", "bb"] }).hashtags).toHaveLength(2);
    expect(() => CreatePostInputSchema.parse({ title: "T", hashtags: ["a1", "b2", "c3", "d4", "e5", "f6"] })).toThrow();
  });
});

// ─── hashtagService against a stubbed model layer ────────────────────────────

const find = vi.fn();
const bulkWrite = vi.fn();
const aggregate = vi.fn();
const userUpdateOne = vi.fn();
const hashtagUpdateOne = vi.fn();
const hashtagFindOne = vi.fn();

function chain(rows: unknown) {
  const c: Record<string, unknown> = {};
  for (const m of ["sort", "limit", "select"]) c[m] = () => c;
  c.lean = async () => rows;
  return c;
}

vi.mock("../models/Hashtag.js", () => ({
  Hashtag: {
    find: (...a: unknown[]) => chain(find(...a)),
    findOne: (...a: unknown[]) => ({ select: async () => hashtagFindOne(...a) }),
    bulkWrite: (...a: unknown[]) => bulkWrite(...a),
    updateOne: (...a: unknown[]) => hashtagUpdateOne(...a),
  },
}));
vi.mock("../models/Post.js", () => ({ Post: { aggregate: (...a: unknown[]) => aggregate(...a) } }));
vi.mock("../models/User.js", () => ({
  User: { updateOne: (...a: unknown[]) => userUpdateOne(...a), exists: async () => null },
}));

const svc = await import("../services/hashtagService.js");

beforeEach(() => {
  vi.clearAllMocks();
  svc.clearHashtagCaches();
});

describe("hashtagService.search", () => {
  it("uses an anchored, escaped prefix on active hashtags and caps the limit", async () => {
    find.mockReturnValue([{ name: "art", postCount: 12 }]);
    const rows = await svc.search({ q: "#Ar.t*", limit: 500 });
    expect(rows).toEqual([{ name: "art", postCount: 12 }]);
    expect(find).toHaveBeenCalledWith({ status: "active", name: { $regex: "^art" } });
  });

  it("returns popular hashtags when there is no query, and caches very short prefixes", async () => {
    find.mockReturnValue([{ name: "denim", postCount: 3 }]);
    await svc.search({ q: "d" });
    await svc.search({ q: "d" });
    expect(find).toHaveBeenCalledTimes(1);
    await svc.search({});
    expect(find).toHaveBeenLastCalledWith({ status: "active" });
  });

  it("does not cache longer prefixes", async () => {
    find.mockReturnValue([]);
    await svc.search({ q: "denim" });
    await svc.search({ q: "denim" });
    expect(find).toHaveBeenCalledTimes(2);
  });

  it("can restrict to featured hashtags", async () => {
    find.mockReturnValue([]);
    await svc.search({ featured: true });
    expect(find).toHaveBeenCalledWith({ status: "active", featured: true });
  });
});

describe("hashtagService.ensureHashtags", () => {
  it("normalizes, drops blocked names and upserts the rest without touching counts", async () => {
    find.mockReturnValue([{ name: "spam" }]);
    const allowed = await svc.ensureHashtags(["#Art", "spam", "ART", "x"], { createdBy: "u1" });
    expect(allowed).toEqual(["art"]);
    const ops = bulkWrite.mock.calls[0][0] as Array<{ updateOne: { filter: { name: string }; upsert: boolean; update: { $setOnInsert: { postCount: number } } } }>;
    expect(ops).toHaveLength(1);
    expect(ops[0].updateOne.filter).toEqual({ name: "art" });
    expect(ops[0].updateOne.upsert).toBe(true);
    expect(ops[0].updateOne.update.$setOnInsert.postCount).toBe(0);
  });

  it("returns nothing (and writes nothing) when no input is valid", async () => {
    expect(await svc.ensureHashtags(["", "#", "1"])).toEqual([]);
    expect(bulkWrite).not.toHaveBeenCalled();
  });

  it("tolerates a duplicate-key race from a concurrent creator", async () => {
    find.mockReturnValue([]);
    bulkWrite.mockRejectedValueOnce(Object.assign(new Error("dup"), { code: 11000 }));
    await expect(svc.ensureHashtags(["art"])).resolves.toEqual(["art"]);
  });
});

describe("hashtagService.filterExisting / adjustCounts", () => {
  it("keeps only hashtags that already exist (AI suggestions never create new ones)", async () => {
    find.mockReturnValue([{ name: "denim" }]);
    expect(await svc.filterExisting(["Denim", "trend-report", "zzznotreal"])).toEqual(["denim"]);
    expect(bulkWrite).not.toHaveBeenCalled();
  });

  it("increments added and decrements removed, never below zero", async () => {
    await svc.adjustCounts({ added: ["a1"], removed: ["b2"] });
    const ops = bulkWrite.mock.calls[0][0] as Array<{ updateOne: { filter: Record<string, unknown>; update: { $inc: { postCount: number } } } }>;
    expect(ops[0].updateOne.update.$inc.postCount).toBe(1);
    expect(ops[1].updateOne.update.$inc.postCount).toBe(-1);
    expect(ops[1].updateOne.filter).toEqual({ name: "b2", postCount: { $gt: 0 } });
  });

  it("does nothing for an empty change", async () => {
    await svc.adjustCounts({});
    expect(bulkWrite).not.toHaveBeenCalled();
  });
});

describe("hashtagService.trending", () => {
  it("ranks by recent use and hides blocked hashtags", async () => {
    aggregate.mockResolvedValue([
      { _id: "art", recentCount: 9 },
      { _id: "blockedtag", recentCount: 8 },
      { _id: "denim", recentCount: 5 },
    ]);
    find.mockReturnValue([{ name: "art", postCount: 40 }, { name: "denim", postCount: 22 }]);
    const rows = await svc.trending({ limit: 12 });
    expect(rows).toEqual([
      { name: "art", postCount: 40, recentCount: 9 },
      { name: "denim", postCount: 22, recentCount: 5 },
    ]);
  });

  it("falls back to all-time most used when the window is empty", async () => {
    aggregate.mockResolvedValue([]);
    find.mockReturnValue([{ name: "couture", postCount: 70 }]);
    expect(await svc.trending({})).toEqual([{ name: "couture", postCount: 70, recentCount: 0 }]);
  });

  it("filters the window by post category when asked", async () => {
    aggregate.mockResolvedValue([]);
    find.mockReturnValue([]);
    await svc.trending({ category: "beauty" });
    const pipeline = aggregate.mock.calls[0][0] as Array<{ $match?: Record<string, unknown> }>;
    expect(pipeline[0].$match?.category).toBe("beauty");
  });
});

describe("hashtagService follow", () => {
  it("only counts a follower when the user's list actually changed", async () => {
    hashtagFindOne.mockResolvedValue({ _id: "h1" });
    userUpdateOne.mockResolvedValueOnce({ modifiedCount: 0 });
    await svc.follow("u1", "art");
    expect(hashtagUpdateOne).not.toHaveBeenCalled();
    userUpdateOne.mockResolvedValueOnce({ modifiedCount: 1 });
    await svc.follow("u1", "art");
    expect(hashtagUpdateOne).toHaveBeenCalledWith({ _id: "h1" }, { $inc: { followerCount: 1 } });
  });

  it("rejects following a hashtag that does not exist", async () => {
    hashtagFindOne.mockResolvedValue(null);
    await expect(svc.follow("u1", "nope")).rejects.toMatchObject({ statusCode: 404 });
  });
});
