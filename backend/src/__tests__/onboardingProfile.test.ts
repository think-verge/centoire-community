import { describe, expect, it, vi, beforeEach } from "vitest";
import { Types } from "mongoose";
import { serializeUser } from "../services/userSerializer.js";
import { User, type IUser } from "../models/User.js";
import { UserTopicMix } from "../models/UserTopicMix.js";
import { Circle } from "../models/Circle.js";
import { Follow } from "../models/Follow.js";
import { CircleMembership } from "../models/CircleMembership.js";
import * as userService from "../services/userService.js";
import * as onboardingService from "../services/onboardingService.js";
import * as feedService from "../services/feedService.js";
import { Post } from "../models/Post.js";

describe("Ticket #114: Onboarding Profile & Topic-Mix Seeding", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("serializeUser", () => {
    it("serializes location, profileRole, and domains in base output", () => {
      const mockUser = {
        _id: new Types.ObjectId(),
        email: "designer@centoire.app",
        displayName: "Coco Chanel",
        handle: "coco",
        role: "creator",
        profileRole: "Head of Design",
        location: "Paris, France",
        domains: ["Runway", "Couture", "Luxury"],
        likedCreators: [new Types.ObjectId()],
        reputation: 150,
        followerCount: 200,
        followingCount: 50,
        postCount: 12,
        createdAt: new Date("2026-11-01T12:00:00Z"),
      } as unknown as IUser;

      const publicOutput = serializeUser(mockUser);
      expect(publicOutput).toMatchObject({
        id: mockUser._id.toString(),
        displayName: "Coco Chanel",
        handle: "coco",
        role: "creator",
        profileRole: "Head of Design",
        location: "Paris, France",
        domains: ["Runway", "Couture", "Luxury"],
      });
      expect((publicOutput as Record<string, unknown>).likedCreators).toBeUndefined();

      const privateOutput = serializeUser(mockUser, { private: true });
      expect(privateOutput).toMatchObject({
        profileRole: "Head of Design",
        location: "Paris, France",
        domains: ["Runway", "Couture", "Luxury"],
        likedCreators: [mockUser.likedCreators[0].toString()],
      });
    });
  });

  describe("updateMe and settings persistence", () => {
    it("persists location, profileRole, domains, and likedCreators", async () => {
      const mockUserDoc = {
        _id: new Types.ObjectId(),
        displayName: "Original Name",
        handle: "user_one",
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(User, "findById").mockResolvedValue(mockUserDoc as any);

      const creatorId = new Types.ObjectId().toString();
      const updated = await userService.updateMe(mockUserDoc._id.toString(), {
        displayName: "Updated Name",
        location: "New York, USA",
        profileRole: "Fashion Stylist",
        domains: ["Streetwear", "Sneakers"],
        likedCreators: [creatorId],
      });

      expect(mockUserDoc.save).toHaveBeenCalled();
      expect((updated as any).location).toBe("New York, USA");
      expect((updated as any).profileRole).toBe("Fashion Stylist");
      expect((updated as any).domains).toEqual(["Streetwear", "Sneakers"]);
      expect((updated as any).likedCreators[0].toString()).toBe(creatorId);
    });

    it("maps role to profileRole if role is passed as a string", async () => {
      const mockUserDoc = {
        _id: new Types.ObjectId(),
        handle: "user_two",
        role: "member",
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(User, "findById").mockResolvedValue(mockUserDoc as any);

      const updated = await userService.updateMe(mockUserDoc._id.toString(), {
        role: "Creative Director",
      });

      expect((updated as any).profileRole).toBe("Creative Director");
      expect((updated as any).role).toBe("member"); // security role is preserved
    });
  });

  describe("seedTopicMix & completeOnboarding", () => {
    it("seeds 10 points per chosen domain and normalizes to 100%", async () => {
      const userId = new Types.ObjectId();
      const findOneAndUpdateSpy = vi
        .spyOn(UserTopicMix, "findOneAndUpdate")
        .mockResolvedValue({} as any);

      // Mock fetch so recsys network call does not fail
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true })));

      await userService.seedTopicMix(userId, ["Streetwear", "Luxury"]);

      expect(findOneAndUpdateSpy).toHaveBeenCalledTimes(1);
      const callArgs = findOneAndUpdateSpy.mock.calls[0];
      expect(callArgs[0]).toEqual({ userId });

      const updateSet = (callArgs[1] as any).$set;
      expect(updateSet.rawPoints).toEqual({
        streetwear: 10,
        luxury: 10,
      });
      expect(updateSet.mix).toEqual({
        streetwear: 50,
        luxury: 50,
      });
      expect(updateSet.dailyEarned).toEqual({
        streetwear: 10,
        luxury: 10,
      });
      expect(updateSet.activeDays).toBe(1);

      // Verify recsys HTTP notification was attempted
      expect(fetchSpy).toHaveBeenCalled();
    });

    it("completeOnboarding validates handle and hashtags, and seeds topic mix", async () => {
      const userId = new Types.ObjectId();
      const mockUserDoc = {
        _id: userId,
        handle: "fashionista",
        followedHashtags: ["art", "design", "runway"],
        domains: ["Runway", "Streetwear", "Sustainable"],
        likedCreators: [],
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(User, "findById").mockResolvedValue(mockUserDoc as any);
      vi.spyOn(UserTopicMix, "findOneAndUpdate").mockResolvedValue({} as any);
      vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ ok: true })));

      const result = await userService.completeOnboarding(userId.toString());

      expect(result.onboardingCompletedAt).toBeInstanceOf(Date);
      expect(mockUserDoc.save).toHaveBeenCalled();
    });
  });

  describe("onboarding suggestions matching domains and location", () => {
    it("returns creators and circles matching domains and location", async () => {
      const userId = new Types.ObjectId();
      const user = {
        _id: userId,
        followedHashtags: ["art"],
        domains: ["Streetwear"],
        location: "Milan",
      };

      const matchingCreator = {
        _id: new Types.ObjectId(),
        handle: "milan_stylist",
        displayName: "Milan Stylist",
        role: "creator",
        domains: ["Streetwear"],
        location: "Milan, Italy",
        reputation: 100,
        followerCount: 500,
      };

      const matchingCircle = {
        _id: new Types.ObjectId(),
        name: "Milan Streetwear Circle",
        slug: "milan-streetwear",
        description: "Streetwear in Milan",
        hashtags: ["streetwear"],
        memberCount: 80,
      };

      vi.spyOn(User, "findById").mockResolvedValue(user as any);

      // Mock User.find chain
      const mockUserSort = vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([matchingCreator]),
      });
      vi.spyOn(User, "find").mockReturnValue({
        sort: mockUserSort,
      } as any);

      // Mock Circle.find chain
      const mockCircleSort = vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([matchingCircle]),
      });
      vi.spyOn(Circle, "find").mockReturnValue({
        sort: mockCircleSort,
      } as any);

      vi.spyOn(Follow, "find").mockReturnValue({
        select: vi.fn().mockResolvedValue([]),
      } as any);
      vi.spyOn(CircleMembership, "find").mockReturnValue({
        select: vi.fn().mockResolvedValue([]),
      } as any);

      const suggestions = await onboardingService.getSuggestions(userId.toString());

      expect(suggestions.creators).toContain(matchingCreator);
      expect(suggestions.circles).toContain(matchingCircle);
    });
  });

  describe("forYou first feed personalization", () => {
    it("includes user chosen domains and liked creators in forYou candidates", async () => {
      const userId = new Types.ObjectId();
      const likedCreatorId = new Types.ObjectId();

      const user = {
        _id: userId,
        followedHashtags: ["textiles"],
        domains: ["Streetwear", "Vintage"],
        likedCreators: [likedCreatorId],
        dismissedPosts: [],
      };

      vi.spyOn(User, "findById").mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(user),
          then: (resolve: any) => resolve(user),
        }),
      } as any);

      vi.spyOn(userService, "getFollowedUserIds").mockResolvedValue([]);
      vi.spyOn(userService, "getFollowedSourceIds").mockResolvedValue([]);
      vi.spyOn(userService, "getMembershipCircleIds").mockResolvedValue([]);
      vi.spyOn(userService, "getBlockedAndMutedUserIds").mockResolvedValue([]);
      vi.spyOn(Circle, "find").mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue([]),
        }),
      } as any);
      vi.spyOn(User, "find").mockReturnValue({
        select: vi.fn().mockResolvedValue([]),
      } as any);

      vi.spyOn(Post, "find").mockReturnValue({
        populate: vi.fn().mockResolvedValue([]),
      } as any);

      const aggregateSpy = vi.spyOn(Post, "aggregate").mockResolvedValue([]);

      await feedService.forYou(userId.toString());

      expect(aggregateSpy).toHaveBeenCalled();
      const pipeline = aggregateSpy.mock.calls[0][0];
      const matchStage = pipeline[0] as { $match: { $or: Array<Record<string, unknown>> } };

      // Should include hashtags from both followedHashtags AND domains
      const hashtagMatch = matchStage.$match.$or.find((cond) => cond.hashtags);
      expect(hashtagMatch).toBeDefined();
      const expectedInterests = ["textiles", "streetwear", "vintage"];
      for (const exp of expectedInterests) {
        expect((hashtagMatch?.hashtags as any).$in).toContain(exp);
      }

      // Should include authorId for liked creators
      const authorMatch = matchStage.$match.$or.find((cond) => cond.authorId);
      expect(authorMatch).toBeDefined();
      expect((authorMatch?.authorId as any).$in).toContainEqual(likedCreatorId);
    });
  });
});
