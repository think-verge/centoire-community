import { describe, expect, it } from "vitest";
import { isIndexable } from "./indexable.js";

describe("isIndexable", () => {
  it("indexes only published, non-private posts", () => {
    expect(isIndexable("posts", { status: "published", circlePrivate: false })).toBe(true);
    for (const status of ["draft", "pending_review", "rejected", "removed"]) {
      expect(isIndexable("posts", { status, circlePrivate: false })).toBe(false);
    }
    expect(isIndexable("posts", { status: "published", circlePrivate: true })).toBe(false);
  });

  it("skips handle-less users, private circles and blocked hashtags", () => {
    expect(isIndexable("people", { hasHandle: true })).toBe(true);
    expect(isIndexable("people", { hasHandle: false })).toBe(false);
    expect(isIndexable("circles", { isPrivate: false })).toBe(true);
    expect(isIndexable("circles", { isPrivate: true })).toBe(false);
    expect(isIndexable("hashtags", { status: "active" })).toBe(true);
    expect(isIndexable("hashtags", { status: "blocked" })).toBe(false);
  });
});
