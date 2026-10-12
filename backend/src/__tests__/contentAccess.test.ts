import { describe, expect, it } from "vitest";
import { serializePostDetail } from "../services/postSerializer.js";
import type { IPost } from "../models/Post.js";

const post = (over: Record<string, unknown> = {}) =>
  ({
    _id: { toString: () => "p1" },
    slug: "s",
    origin: "aggregated",
    status: "published",
    title: "T",
    excerpt: "teaser",
    hashtags: [],
    contentHtml: "<p>full paid text</p>",
    content: { type: "doc" },
    contentAccess: "members",
    viewCount: 0,
    upvoteCount: 0,
    commentCount: 0,
    bookmarkCount: 0,
    readTimeMinutes: 1,
    updatedAt: new Date(0),
    ...over,
  }) as unknown as IPost;

describe("members-only content", () => {
  it("hides the full text from signed-out viewers but keeps the teaser", () => {
    const detail = serializePostDetail(post());
    expect(detail.contentHtml).toBeNull();
    expect(detail.content).toBeNull();
    expect(detail.contentLocked).toBe(true);
    expect(detail.excerpt).toBe("teaser");
  });

  it("shows it to signed-in viewers", () => {
    const detail = serializePostDetail(post(), undefined, undefined, true);
    expect(detail.contentHtml).toBe("<p>full paid text</p>");
    expect(detail.contentLocked).toBe(false);
  });

  it("never locks open posts", () => {
    const detail = serializePostDetail(post({ contentAccess: "open" }));
    expect(detail.contentHtml).toBe("<p>full paid text</p>");
    expect(detail.contentLocked).toBe(false);
  });
});
