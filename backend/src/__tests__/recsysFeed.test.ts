import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { Types } from "mongoose";
import { env } from "../config/env.js";
import { User } from "../models/User.js";
import { Post } from "../models/Post.js";
import { Circle } from "../models/Circle.js";
import { Vote } from "../models/Vote.js";
import { Bookmark } from "../models/Bookmark.js";
import { PostReport } from "../models/PostReport.js";
import * as userService from "../services/userService.js";
import * as feedService from "../services/feedService.js";

describe("recsysFeed & daily active tracking (Ticket #115)", () => {
  const originalFlag = env.RECSYS_FEED;
  const originalUrl = env.RECSYS_URL;
  const originalTimeout = env.RECSYS_TIMEOUT_MS;

  beforeEach(() => {
    vi.restoreAllMocks();
    feedService.recsysMetrics.reset();

    // Default mocks to prevent real DB connection timeouts in unit tests
    vi.spyOn(User, "updateOne").mockResolvedValue({} as any);
    vi.spyOn(User, "findById").mockImplementation(() => {
      return {
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue({ dismissedPosts: [] }),
        }),
      } as any;
    });
    vi.spyOn(Vote, "find").mockResolvedValue([] as any);
    vi.spyOn(Bookmark, "find").mockResolvedValue([] as any);
    vi.spyOn(PostReport, "find").mockResolvedValue([] as any);
  });

  afterEach(() => {
    env.RECSYS_FEED = originalFlag;
    env.RECSYS_URL = originalUrl;
    env.RECSYS_TIMEOUT_MS = originalTimeout;
    vi.restoreAllMocks();
  });

  it("trackDailyActiveUser atomically increments active_days on first call of the day", async () => {
    const updateSpy = vi.spyOn(User, "updateOne").mockResolvedValue({} as any);
    const userId = new Types.ObjectId().toString();
    const today = new Date().toISOString().slice(0, 10);

    await feedService.trackDailyActiveUser(userId);

    expect(updateSpy).toHaveBeenCalledWith(
      { _id: userId, lastActiveDate: { $ne: today } },
      { $inc: { active_days: 1 }, $set: { lastActiveDate: today } },
    );
  });

  it("serves core feed when RECSYS_FEED flag is off (today's behavior)", async () => {
    env.RECSYS_FEED = false;
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const userId = new Types.ObjectId().toString();

    const expectedPage = { items: [], nextCursor: null };
    const coreSpy = vi.spyOn(feedService.feedOperations, "forYouCore").mockResolvedValue(expectedPage);

    const result = await feedService.forYou(userId);

    expect(coreSpy).toHaveBeenCalledWith(userId, undefined);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result).toBe(expectedPage);
    expect(feedService.recsysMetrics.requests).toBe(0);
  });

  it("serves recsys feed with hydrated cards and cursor when RECSYS_FEED flag is on", async () => {
    env.RECSYS_FEED = true;
    const userId = new Types.ObjectId().toString();
    const post1Id = new Types.ObjectId();
    const post2Id = new Types.ObjectId();

    // Mock recsys service returning candidate post IDs
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "ok",
        items: [post1Id.toString(), post2Id.toString()],
        cursor: "next_cursor_page_2",
      }),
    } as Response);

    // Mock memberships and social graphs
    vi.spyOn(userService, "getMembershipCircleIds").mockResolvedValue([]);
    vi.spyOn(userService, "getFollowedUserIds").mockResolvedValue([]);
    vi.spyOn(userService, "getFollowedSourceIds").mockResolvedValue([]);

    // Candidate lookup in core: post1 and post2 both public
    const mockPosts = [
      {
        _id: post1Id,
        slug: "post-1",
        title: "Post One",
        status: "published",
        origin: "native",
        upvoteCount: 10,
        commentCount: 2,
        bookmarkCount: 1,
        readTimeMinutes: 3,
        updatedAt: new Date(),
        publishedAt: new Date(),
      },
      {
        _id: post2Id,
        slug: "post-2",
        title: "Post Two",
        status: "published",
        origin: "native",
        upvoteCount: 5,
        commentCount: 0,
        bookmarkCount: 0,
        readTimeMinutes: 2,
        updatedAt: new Date(),
        publishedAt: new Date(),
      },
    ];

    vi.spyOn(Post, "find").mockImplementation((..._args: any[]) => {
      return {
        select: vi.fn().mockResolvedValue(mockPosts),
        populate: vi.fn().mockResolvedValue(mockPosts),
      } as any;
    });

    const result = await feedService.forYou(userId);

    expect(feedService.recsysMetrics.requests).toBe(1);
    expect(feedService.recsysMetrics.successes).toBe(1);
    expect(feedService.recsysMetrics.fallbacks).toBe(0);
    expect(result.nextCursor).toBe("next_cursor_page_2");
    expect(result.items).toHaveLength(2);
    expect(result.items[0].id).toBe(post1Id.toString());
    expect(result.items[1].id).toBe(post2Id.toString());
  });

  it("filters out private circle posts where the user is not a member (2nd line of defense)", async () => {
    env.RECSYS_FEED = true;
    const userId = new Types.ObjectId().toString();
    const publicPostId = new Types.ObjectId();
    const privatePostId = new Types.ObjectId();
    const privateCircleId = new Types.ObjectId();

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        status: "ok",
        items: [publicPostId.toString(), privatePostId.toString()],
        cursor: null,
      }),
    } as Response);

    // User is NOT a member of privateCircleId
    vi.spyOn(userService, "getMembershipCircleIds").mockResolvedValue([]);
    vi.spyOn(userService, "getFollowedUserIds").mockResolvedValue([]);
    vi.spyOn(userService, "getFollowedSourceIds").mockResolvedValue([]);

    const candidatePosts = [
      { _id: publicPostId, status: "published" },
      { _id: privatePostId, circleId: privateCircleId, status: "published" },
    ];

    vi.spyOn(Circle, "find").mockImplementation(() => {
      return {
        select: vi.fn().mockResolvedValue([{ _id: privateCircleId }]),
      } as any;
    });

    const fullPublicPost = {
      _id: publicPostId,
      slug: "public-post",
      title: "Public Post",
      status: "published",
      origin: "native",
      upvoteCount: 1,
      commentCount: 0,
      bookmarkCount: 0,
      readTimeMinutes: 1,
      updatedAt: new Date(),
      publishedAt: new Date(),
    };

    vi.spyOn(Post, "find").mockImplementation((..._args: any[]) => {
      return {
        select: vi.fn().mockResolvedValue(candidatePosts),
        populate: vi.fn().mockResolvedValue([fullPublicPost]),
      } as any;
    });

    const result = await feedService.forYou(userId);

    expect(result.items).toHaveLength(1);
    expect(result.items[0].id).toBe(publicPostId.toString());
  });

  it("falls back to core feed on recsys error or timeout, recording fallback metrics", async () => {
    env.RECSYS_FEED = true;
    const userId = new Types.ObjectId().toString();

    // Recsys throws network error or timeout
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Recsys timeout after 500ms"));

    const fallbackPage = { items: [], nextCursor: null };
    const coreSpy = vi.spyOn(feedService.feedOperations, "forYouCore").mockResolvedValue(fallbackPage);

    const result = await feedService.forYou(userId);

    expect(feedService.recsysMetrics.requests).toBe(1);
    expect(feedService.recsysMetrics.fallbacks).toBe(1);
    expect(feedService.recsysMetrics.fallbackRate).toBe(1);
    expect(coreSpy).toHaveBeenCalledWith(userId, undefined);
    expect(result).toBe(fallbackPage);
  });

  it("falls back to core feed when recsys returns HTTP 500 error", async () => {
    env.RECSYS_FEED = true;
    const userId = new Types.ObjectId().toString();

    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    const fallbackPage = { items: [], nextCursor: null };
    const coreSpy = vi.spyOn(feedService.feedOperations, "forYouCore").mockResolvedValue(fallbackPage);

    const result = await feedService.forYou(userId);

    expect(feedService.recsysMetrics.fallbacks).toBe(1);
    expect(coreSpy).toHaveBeenCalledWith(userId, undefined);
    expect(result).toBe(fallbackPage);
  });
});
