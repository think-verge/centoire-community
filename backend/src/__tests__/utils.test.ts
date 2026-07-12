import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "../utils/cursor.js";
import { readTimeMinutes, tiptapToPlainText } from "../utils/read-time.js";
import { slugify, slugifyWithId } from "../utils/slugify.js";
import { canonicalUrlHash } from "../utils/url-hash.js";

describe("cursor", () => {
  it("round-trips a payload", () => {
    const cursor = encodeCursor({ offset: 40 });
    expect(decodeCursor<{ offset: number }>(cursor)).toEqual({ offset: 40 });
  });

  it("returns null for garbage", () => {
    expect(decodeCursor("not-base64!@#")).toBeNull();
    expect(decodeCursor(undefined)).toBeNull();
  });
});

describe("slugify", () => {
  it("lowercases and hyphenates", () => {
    expect(slugify("Japanese Denim & Repair")).toBe("japanese-denim-repair");
  });

  it("strips accents", () => {
    expect(slugify("Défilé Couture")).toBe("defile-couture");
  });

  it("falls back for empty input", () => {
    expect(slugify("!!!")).toBe("untitled");
  });

  it("appends a unique suffix", () => {
    const a = slugifyWithId("Same Title");
    const b = slugifyWithId("Same Title");
    expect(a).not.toBe(b);
    expect(a).toMatch(/^same-title-[0-9a-f]{8}$/);
  });
});

describe("canonicalUrlHash", () => {
  it("ignores tracking params and hash fragments", () => {
    const clean = canonicalUrlHash("https://vogue.com/article/silhouettes");
    expect(
      canonicalUrlHash("https://vogue.com/article/silhouettes?utm_source=rss&utm_medium=feed#top"),
    ).toBe(clean);
    expect(canonicalUrlHash("https://VOGUE.com/article/silhouettes/")).toBe(clean);
  });

  it("keeps meaningful query params", () => {
    expect(canonicalUrlHash("https://example.com/story?id=1")).not.toBe(
      canonicalUrlHash("https://example.com/story?id=2"),
    );
  });
});

describe("read-time", () => {
  it("extracts plain text from TipTap JSON", () => {
    const doc = {
      type: "doc",
      content: [
        { type: "paragraph", content: [{ type: "text", text: "Hello" }] },
        { type: "paragraph", content: [{ type: "text", text: "world" }] },
      ],
    };
    expect(tiptapToPlainText(doc)).toBe("Hello world");
  });

  it("computes at least one minute", () => {
    expect(readTimeMinutes("a few words")).toBe(1);
    expect(readTimeMinutes(Array(700).fill("word").join(" "))).toBe(3);
  });
});
