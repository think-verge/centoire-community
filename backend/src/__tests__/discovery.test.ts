import { beforeEach, describe, expect, it, vi } from "vitest";
import { Types } from "mongoose";
import { Post } from "../models/Post.js";
import { Source } from "../models/Source.js";
import { env } from "../config/env.js";
import * as policyService from "../services/policyService.js";
import * as aiService from "../services/aiService.js";
import * as postService from "../services/postService.js";
import { listDecisions, suggestSource, upsertStory, type StoryCandidateInput } from "../services/discoveryService.js";
import { SourceSuggestionSchema, StoryCandidateSchema } from "../routes/discoveryRoutes.js";

const story: StoryCandidateInput = {
  storyId: "a1b2c3d4e5f6",
  title: "Corteiz and Nike announce the Shox R4 Metallic Silver",
  excerpt: "First images surfaced via Sneaker Bar Detroit.",
  externalUrl: "https://sneakerbardetroit.com/corteiz-nike-shox-r4-metallic-silver/",
  publishedAt: "2026-11-07T01:29:00Z",
  discovery: {
    category: "collab",
    websiteCount: 4,
    articleCount: 7,
    firstPublished: { name: "Sneaker Bar Detroit", url: "https://sneakerbardetroit.com/x", at: "2026-11-07T01:29:00Z" },
    engineSawAt: "2026-11-07T01:39:00Z",
    spread: [{ name: "Sneaker Bar Detroit", firstAt: "2026-11-07T01:29:00Z" }],
    markets: ["US", "JP"],
  },
};

function fakeDoc<T extends object>(fields: T) {
  return { _id: new Types.ObjectId(), save: vi.fn().mockResolvedValue(undefined), ...fields };
}

describe("discovery engine integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(aiService, "fireAiProcessing").mockResolvedValue(undefined as never);
  });

  it("validates the engine's payloads", () => {
    expect(StoryCandidateSchema.parse(story).storyId).toBe(story.storyId);
    expect(() => StoryCandidateSchema.parse({ ...story, externalUrl: "not a url" })).toThrow();
    expect(() =>
      SourceSuggestionSchema.parse({ name: "x", siteUrl: "https://x.com", feedUrl: "https://x.com/feed", kind: "tiktok", reason: "r" }),
    ).toThrow();
  });

  it("creates a pending post attributed to the discovery source, with the evidence", async () => {
    const source = fakeDoc({ name: "Centoire Discovery" });
    vi.spyOn(Post, "findOne").mockResolvedValue(null);
    vi.spyOn(Source, "findOne").mockResolvedValue(source as never);
    vi.spyOn(policyService, "evaluate").mockResolvedValue(null);
    const create = vi.spyOn(Post, "create").mockImplementation(async (doc) => fakeDoc(doc as object) as never);

    const result = await upsertStory(story);

    expect(result.created).toBe(true);
    expect(result.status).toBe("pending_review");
    const doc = create.mock.calls[0]![0] as Record<string, unknown>;
    expect(doc).toMatchObject({ origin: "aggregated", status: "pending_review", sourceId: source._id });
    expect(doc.expiresAt).toBeUndefined();
    expect((doc.discovery as { websiteCount: number; storyId: string })).toMatchObject({
      storyId: story.storyId,
      websiteCount: 4,
    });
    expect(aiService.fireAiProcessing).toHaveBeenCalledOnce();
  });

  it("refreshes a pending story's evidence and title but never a decided one's title", async () => {
    const pending = fakeDoc({ status: "pending_review", title: "old", excerpt: "old", discovery: undefined as unknown });
    vi.spyOn(Post, "findOne").mockResolvedValueOnce(pending as never);
    await upsertStory({ ...story, discovery: { ...story.discovery, websiteCount: 9 } });
    expect(pending.title).toBe(story.title);
    expect((pending.discovery as { websiteCount: number }).websiteCount).toBe(9);

    const published = fakeDoc({ status: "published", title: "Editor's title", excerpt: "e", discovery: undefined as unknown });
    vi.spyOn(Post, "findOne").mockResolvedValueOnce(published as never);
    const result = await upsertStory(story);
    expect(published.title).toBe("Editor's title");
    expect(result).toMatchObject({ status: "published", created: false });
  });

  it("attaches the evidence to an article the RSS importer already holds", async () => {
    const imported = fakeDoc({ status: "pending_review", discovery: undefined as unknown });
    vi.spyOn(Post, "findOne").mockResolvedValueOnce(null).mockResolvedValueOnce(imported as never);
    const create = vi.spyOn(Post, "create");
    const result = await upsertStory(story);
    expect(create).not.toHaveBeenCalled();
    expect(result.created).toBe(false);
    expect((imported.discovery as { storyId: string }).storyId).toBe(story.storyId);
  });

  it("keeps a story for an editor even when an auto-approve policy matches", async () => {
    vi.spyOn(Post, "findOne").mockResolvedValue(null);
    vi.spyOn(Source, "findOne").mockResolvedValue(fakeDoc({}) as never);
    vi.spyOn(policyService, "evaluate").mockResolvedValue("auto_approve");
    vi.spyOn(Post, "create").mockImplementation(async (doc) => fakeDoc(doc as object) as never);
    const finalize = vi.spyOn(postService, "finalizePublish").mockResolvedValue();
    const result = await upsertStory(story);
    expect(finalize).not.toHaveBeenCalled();
    expect(result.status).toBe("pending_review");
  });

  it("publishes straight away when DISCOVERY_AUTO_APPROVE is on and a policy matches", async () => {
    vi.spyOn(env, "DISCOVERY_AUTO_APPROVE", "get").mockReturnValue(true);
    vi.spyOn(Post, "findOne").mockResolvedValue(null);
    vi.spyOn(Source, "findOne").mockResolvedValue(fakeDoc({}) as never);
    vi.spyOn(policyService, "evaluate").mockResolvedValue("auto_approve");
    vi.spyOn(Post, "create").mockImplementation(async (doc) => fakeDoc(doc as object) as never);
    const finalize = vi.spyOn(postService, "finalizePublish").mockResolvedValue();
    await upsertStory(story);
    expect(finalize).toHaveBeenCalledOnce();
  });

  it("suggests a new source inactive, and leaves known sources alone", async () => {
    vi.spyOn(Source, "findOne").mockResolvedValueOnce(null);
    const create = vi.spyOn(Source, "create").mockImplementation(async (doc) => fakeDoc(doc as object) as never);
    const input = {
      name: "Up To Date",
      siteUrl: "https://uptodate.tokyo",
      feedUrl: "https://uptodate.tokyo/feed",
      kind: "rss" as const,
      region: "JP",
      reason: "First to publish 3 stories",
      evidence: ["BBC × Pokémon, 11h before Hypebeast"],
    };
    const { created } = await suggestSource(input);
    expect(created).toBe(true);
    expect(create.mock.calls[0]![0]).toMatchObject({ active: false, review: "suggested", fetchedBy: "discovery" });

    const rejected = fakeDoc({ review: "rejected", suggestion: undefined as unknown });
    vi.spyOn(Source, "findOne").mockResolvedValueOnce(rejected as never);
    const again = await suggestSource(input);
    expect(again.created).toBe(false);
    expect(rejected.save).not.toHaveBeenCalled();
  });

  it("reports decisions with whether an editor made them", async () => {
    const reviewedAt = new Date("2026-11-10T10:00:00Z");
    vi.spyOn(Post, "find").mockReturnValue({
      select: () => ({
        sort: () => ({
          limit: () => ({
            lean: async () => [
              { _id: new Types.ObjectId(), discovery: { storyId: "s1" }, status: "published", reviewedAt,
                reviewedBy: new Types.ObjectId() },
              { _id: new Types.ObjectId(), discovery: { storyId: "s2" }, status: "rejected", reviewedAt,
                rejectionReason: "Not fashion" },
            ],
          }),
        }),
      }),
    } as never);
    const decisions = await listDecisions(new Date(0), 10);
    expect(decisions.map((d) => [d.storyId, d.status, d.byEditor, d.rejectionReason])).toEqual([
      ["s1", "published", true, null],
      ["s2", "rejected", false, "Not fashion"],
    ]);
  });
});
