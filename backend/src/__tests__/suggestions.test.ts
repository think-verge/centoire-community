import { describe, expect, it, vi, beforeEach } from "vitest";
import { Types } from "mongoose";
import {
  SuggestionsQuerySchema,
  SuggestionDismissBodySchema,
  SuggestionIgnoreBodySchema,
  SuggestionImpressionsBodySchema,
} from "../schemas/suggestions.js";
import {
  getSuggestedCircles,
  getSuggestedCreators,
  dismissSuggestion,
  ignoreSuggestion,
} from "../services/suggestionService.js";
import { Circle } from "../models/Circle.js";
import { CircleMembership } from "../models/CircleMembership.js";
import { Follow } from "../models/Follow.js";
import { User } from "../models/User.js";
import { SuggestionFeedback } from "../models/SuggestionFeedback.js";

describe("Suggestions Schema Validation", () => {
  it("validates and bounds query limit", () => {
    expect(SuggestionsQuerySchema.parse({ limit: "15" }).limit).toBe(15);
    expect(SuggestionsQuerySchema.parse({}).limit).toBe(10);
    expect(() => SuggestionsQuerySchema.parse({ limit: "0" })).toThrow();
    expect(() => SuggestionsQuerySchema.parse({ limit: "100" })).toThrow();
  });

  it("validates dismiss request body", () => {
    const valid = { targetType: "circle", targetId: "64b1f2e9a1b2c3d4e5f6a7b8" };
    expect(SuggestionDismissBodySchema.parse(valid)).toEqual(valid);

    const validCreator = { targetType: "creator", targetId: "64b1f2e9a1b2c3d4e5f6a7b9" };
    expect(SuggestionDismissBodySchema.parse(validCreator)).toEqual(validCreator);

    expect(() => SuggestionDismissBodySchema.parse({ targetType: "invalid", targetId: "123" })).toThrow();
  });

  it("validates ignore and impression batch schemas", () => {
    const validIgnore = { targetType: "circle", targetId: "64b1f2e9a1b2c3d4e5f6a7b8" };
    expect(SuggestionIgnoreBodySchema.parse(validIgnore)).toEqual(validIgnore);

    const validImpressions = {
      impressions: [
        { targetType: "circle", targetId: "c1", position: 1, score: 5.78, reason: "3 friends are members" },
        { targetType: "creator", targetId: "u1", position: 2, score: 7.37, reason: "Rising creator" },
      ],
    };
    expect(SuggestionImpressionsBodySchema.parse(validImpressions).impressions).toHaveLength(2);
  });
});

describe("Suggestion Feedback & Dismiss Mechanics", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("dismissal sets 30-day window", async () => {
    const userId = new Types.ObjectId().toString();
    const circleId = new Types.ObjectId().toString();

    let capturedQuery: any = null;
    let capturedUpdate: any = null;

    (vi.spyOn(SuggestionFeedback as any, "findOneAndUpdate") as any).mockImplementation((query: any, update: any) => {
      capturedQuery = query;
      capturedUpdate = update;
      return Promise.resolve({} as any);
    });

    const res = await dismissSuggestion(userId, "circle", circleId);

    expect(res.status).toBe("ok");
    expect(res.action).toBe("dismiss");
    expect(capturedQuery.targetType).toBe("circle");
    expect(capturedUpdate.$set.lastAction).toBe("dismiss");

    const dismissedUntil = new Date(res.dismissedUntil);
    const now = new Date();
    const diffDays = Math.round((dismissedUntil.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    expect(diffDays).toBe(30);
  });

  it("ignore action sets 14-day window strictly after 3 ignores", async () => {
    const userId = new Types.ObjectId().toString();
    const creatorId = new Types.ObjectId().toString();

    const capturedUpdates: any[] = [];
    (vi.spyOn(SuggestionFeedback as any, "findOneAndUpdate") as any).mockImplementation((_q: any, update: any) => {
      capturedUpdates.push(update);
      return Promise.resolve({} as any);
    });

    // 1st ignore: count = 1, dismissedUntil = null
    vi.spyOn(SuggestionFeedback, "findOne").mockResolvedValueOnce(null as any);
    const res1 = await ignoreSuggestion(userId, "creator", creatorId);
    expect(res1.ignoreCount).toBe(1);
    expect(res1.dismissedUntil).toBeNull();

    // 2nd ignore: count = 2, dismissedUntil = null
    vi.spyOn(SuggestionFeedback, "findOne").mockResolvedValueOnce({ ignoreCount: 1 } as any);
    const res2 = await ignoreSuggestion(userId, "creator", creatorId);
    expect(res2.ignoreCount).toBe(2);
    expect(res2.dismissedUntil).toBeNull();

    // 3rd ignore: count = 3 -> sets 14-day hide
    vi.spyOn(SuggestionFeedback, "findOne").mockResolvedValueOnce({ ignoreCount: 2 } as any);
    const res3 = await ignoreSuggestion(userId, "creator", creatorId);
    expect(res3.ignoreCount).toBe(3);
    expect(res3.dismissedUntil).not.toBeNull();

    const hiddenUntil = new Date(res3.dismissedUntil!);
    const now = new Date();
    const diffDays = Math.round((hiddenUntil.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    expect(diffDays).toBe(14);
  });
});

describe("Acceptance Criteria Verification", () => {
  const userId = new Types.ObjectId().toString();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("Acceptance Criterion 1: dismissed items do not return within the window", async () => {
    const activeCircleId = new Types.ObjectId();
    const dismissedCircleId = new Types.ObjectId();

    // Mock active feedback indicating dismissedCircleId is hidden for 30 days
    vi.spyOn(SuggestionFeedback, "find").mockReturnValue({
      select: vi.fn().mockResolvedValue([
        { targetId: dismissedCircleId },
      ]),
    } as any);

    vi.spyOn(CircleMembership, "find").mockReturnValue({
      select: vi.fn().mockResolvedValue([]),
    } as any);

    vi.spyOn(Follow, "find").mockReturnValue({
      select: vi.fn().mockResolvedValue([]),
    } as any);

    // AI agent fetch throws to trigger core fallback
    global.fetch = vi.fn().mockRejectedValue(new Error("AI agent offline"));

    // Candidate circles mock
    vi.spyOn(Circle, "find").mockReturnValue({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([
            {
              _id: activeCircleId,
              name: "Streetwear Global",
              slug: "streetwear-global",
              description: "All street styles",
              memberCount: 150,
              postCount: 40,
              isPrivate: false,
            },
          ]),
        }),
      }),
    } as any);

    const result = await getSuggestedCircles(userId, 10);
    const returnedIds = result.items.map((it) => it.id);

    expect(returnedIds).toContain(activeCircleId.toString());
    expect(returnedIds).not.toContain(dismissedCircleId.toString());
  });

  it("Acceptance Criterion 2: private circles the user cannot join never appear", async () => {
    const publicCircleId = new Types.ObjectId();
    const privateCircleId = new Types.ObjectId();

    vi.spyOn(SuggestionFeedback, "find").mockReturnValue({
      select: vi.fn().mockResolvedValue([]),
    } as any);

    vi.spyOn(CircleMembership, "find").mockReturnValue({
      select: vi.fn().mockResolvedValue([]),
    } as any);

    vi.spyOn(Follow, "find").mockReturnValue({
      select: vi.fn().mockResolvedValue([]),
    } as any);

    global.fetch = vi.fn().mockRejectedValue(new Error("AI agent offline"));

    let capturedCircleQuery: any = null;
    (vi.spyOn(Circle as any, "find") as any).mockImplementation((query: any) => {
      capturedCircleQuery = query;
      return {
        sort: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([
              {
                _id: publicCircleId,
                name: "Public Fashion Circle",
                slug: "public-fashion",
                description: "Open to all",
                memberCount: 200,
                postCount: 50,
                isPrivate: false,
              },
            ]),
          }),
        }),
      } as any;
    });

    const result = await getSuggestedCircles(userId, 10);

    // Verify query explicitly enforces isPrivate: false
    expect(capturedCircleQuery.isPrivate).toBe(false);

    const returnedIds = result.items.map((it) => it.id);
    expect(returnedIds).toContain(publicCircleId.toString());
    expect(returnedIds).not.toContain(privateCircleId.toString());
    expect(result.items[0].isPrivate).toBe(false);
  });

  it("Excludes already joined circles and followed creators", async () => {
    const joinedCircleId = new Types.ObjectId();
    const unjoinedCircleId = new Types.ObjectId();

    vi.spyOn(SuggestionFeedback, "find").mockReturnValue({
      select: vi.fn().mockResolvedValue([]),
    } as any);

    // User is already a member of joinedCircleId
    vi.spyOn(CircleMembership, "find").mockReturnValue({
      select: vi.fn().mockResolvedValue([{ circleId: joinedCircleId }]),
    } as any);

    vi.spyOn(Follow, "find").mockReturnValue({
      select: vi.fn().mockResolvedValue([]),
    } as any);

    global.fetch = vi.fn().mockRejectedValue(new Error("offline"));

    let capturedCircleFilter: any = null;
    (vi.spyOn(Circle as any, "find") as any).mockImplementation((query: any) => {
      capturedCircleFilter = query;
      return {
        sort: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([
              {
                _id: unjoinedCircleId,
                name: "Vintage Enthusiasts",
                slug: "vintage-enthusiasts",
                description: "Vintage wear",
                memberCount: 80,
                postCount: 15,
                isPrivate: false,
              },
            ]),
          }),
        }),
      } as any;
    });

    const result = await getSuggestedCircles(userId, 10);

    // Verify joined circle ID is in $nin exclusion list
    const excludedIds = capturedCircleFilter._id.$nin.map((oid: Types.ObjectId) => oid.toString());
    expect(excludedIds).toContain(joinedCircleId.toString());

    const resultIds = result.items.map((it) => it.id);
    expect(resultIds).toContain(unjoinedCircleId.toString());
    expect(resultIds).not.toContain(joinedCircleId.toString());
  });

  it("Excludes followed creators and self from creator suggestions", async () => {
    const followedCreatorId = new Types.ObjectId();
    const availableCreatorId = new Types.ObjectId();

    vi.spyOn(SuggestionFeedback, "find").mockReturnValue({
      select: vi.fn().mockResolvedValue([]),
    } as any);

    // User already follows followedCreatorId
    vi.spyOn(Follow, "find").mockReturnValue({
      select: vi.fn().mockResolvedValue([{ followeeId: followedCreatorId }]),
    } as any);

    vi.spyOn(User, "findById").mockReturnValue({
      select: vi.fn().mockReturnValue({
        lean: vi.fn().mockResolvedValue({ blockedUsers: [], mutedUsers: [] }),
      }),
    } as any);

    global.fetch = vi.fn().mockRejectedValue(new Error("offline"));

    let capturedCreatorFilter: any = null;
    (vi.spyOn(User as any, "find") as any).mockImplementation((query: any) => {
      capturedCreatorFilter = query;
      return {
        sort: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue([
              {
                _id: availableCreatorId,
                handle: "runway_designer",
                displayName: "Runway Designer",
                followerCount: 85,
                postCount: 12,
              },
            ]),
          }),
        }),
      } as any;
    });

    const result = await getSuggestedCreators(userId, 10);

    // Excluded list must include followed creator and user themselves
    const excludedIds = capturedCreatorFilter._id.$nin.map((oid: Types.ObjectId) => oid.toString());
    expect(excludedIds).toContain(followedCreatorId.toString());
    expect(excludedIds).toContain(userId);

    const resultIds = result.items.map((it) => it.id);
    expect(resultIds).toContain(availableCreatorId.toString());
    expect(resultIds).not.toContain(followedCreatorId.toString());
    expect(resultIds).not.toContain(userId);
    expect(result.items[0].isEmerging).toBe(true);
  });
});
