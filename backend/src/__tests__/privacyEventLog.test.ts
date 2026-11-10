import { describe, expect, it, vi, beforeEach } from "vitest";
import { Types } from "mongoose";
import { User } from "../models/User.js";
import { Event } from "../models/Event.js";
import { UserTopicMix } from "../models/UserTopicMix.js";
import { Circle } from "../models/Circle.js";
import { Source } from "../models/Source.js";
import { Post } from "../models/Post.js";
import { Comment } from "../models/Comment.js";
import { Follow } from "../models/Follow.js";
import { CircleMembership } from "../models/CircleMembership.js";
import { SourceFollow } from "../models/SourceFollow.js";
import { Bookmark, BookmarkFolder } from "../models/Bookmark.js";
import { Vote } from "../models/Vote.js";
import { Notification } from "../models/Notification.js";
import { CircleInvite } from "../models/CircleInvite.js";
import * as eventBus from "../events/eventBus.js";
import {
  deleteAccount,
  exportUserData,
  getPrivacySettings,
  updatePrivacySettings,
} from "../services/userService.js";
import { ingestEventBatch } from "../services/eventService.js";

describe("Privacy & Event Log (#117)", () => {
  const userId = new Types.ObjectId().toString();

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Event TTL Index", () => {
    it("has a 30-day retention TTL index on 'at'", () => {
      const indexes = Event.schema.indexes();
      const ttlIndex = indexes.find(
        ([fields, options]) => fields.at === 1 && options?.expireAfterSeconds === 30 * 24 * 60 * 60,
      );
      expect(ttlIndex).toBeDefined();
    });
  });

  describe("Privacy Consent Management", () => {
    it("returns default consent settings if not set", async () => {
      vi.spyOn(User, "findById").mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue({
            _id: new Types.ObjectId(userId),
          }),
        }),
      } as any);

      const settings = await getPrivacySettings(userId);
      expect(settings.behavioralTracking).toBe(true);
      expect(settings.personalizedRecommendations).toBe(true);
    });

    it("updates privacy consent settings", async () => {
      const mockUser = {
        _id: new Types.ObjectId(userId),
        privacyConsent: { behavioralTracking: true, personalizedRecommendations: true },
        set: vi.fn(),
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(User, "findById").mockResolvedValue(mockUser as any);

      await updatePrivacySettings(userId, {
        behavioralTracking: false,
        personalizedRecommendations: false,
      });

      expect(mockUser.set).toHaveBeenCalledWith("privacyConsent", expect.objectContaining({
        behavioralTracking: false,
        personalizedRecommendations: false,
      }));
      expect(mockUser.save).toHaveBeenCalled();
    });
  });

  describe("Consent Enforcement in Behavioral Event Ingestion", () => {
    it("anonymizes events when user has opted out of behavioral tracking", async () => {
      vi.spyOn(User, "findById").mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue({
            _id: new Types.ObjectId(userId),
            privacyConsent: { behavioralTracking: false },
          }),
        }),
      } as any);

      const bulkWriteSpy = vi.spyOn(Event, "bulkWrite").mockResolvedValueOnce({
        insertedCount: 1,
      } as any);
      const emitSpy = vi.spyOn(eventBus, "emitDomainEvent").mockImplementation(() => {});

      const result = await ingestEventBatch(
        [{ action: "dwell", postId: new Types.ObjectId().toString(), dwellMs: 5000 }],
        userId,
      );

      expect(result.accepted).toBe(1);
      expect(bulkWriteSpy).toHaveBeenCalled();
      const writtenDoc = (bulkWriteSpy.mock.calls[0][0] as any)[0].insertOne.document;
      // userId must NOT be present in written doc
      expect(writtenDoc.userId).toBeUndefined();

      // userId must NOT be present in emitted event batch
      expect(emitSpy).toHaveBeenCalledWith("behavior.batch", expect.objectContaining({
        events: [
          expect.objectContaining({
            userId: undefined,
            action: "dwell",
          }),
        ],
      }));
    });

    it("retains userId when behavioral tracking is enabled", async () => {
      vi.spyOn(User, "findById").mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue({
            _id: new Types.ObjectId(userId),
            privacyConsent: { behavioralTracking: true },
          }),
        }),
      } as any);

      const bulkWriteSpy = vi.spyOn(Event, "bulkWrite").mockResolvedValueOnce({
        insertedCount: 1,
      } as any);
      vi.spyOn(eventBus, "emitDomainEvent").mockImplementation(() => {});

      await ingestEventBatch(
        [{ action: "impression", postId: new Types.ObjectId().toString() }],
        userId,
      );

      const writtenDoc = (bulkWriteSpy.mock.calls[0][0] as any)[0].insertOne.document;
      expect(writtenDoc.userId).toEqual(new Types.ObjectId(userId));
    });
  });

  describe("exportUserData", () => {
    it("returns complete user data export including topicMix, suggestions, and events", async () => {
      const mockUser = {
        _id: new Types.ObjectId(userId),
        email: "test@example.com",
        handle: "testuser",
        displayName: "Test User",
        domains: ["fashiontech"],
        followedHashtags: ["#couture"],
        privacyConsent: { behavioralTracking: true, personalizedRecommendations: true },
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const mockTopicMix = {
        activeDays: 3,
        lastActiveDate: "2026-11-09",
        mix: { fashiontech: 0.8 },
        rawPoints: { fashiontech: 24 },
        dailyEarned: {},
        hiddenPostIds: ["post-123"],
        updatedAt: new Date(),
      };

      const mockEvents = [
        {
          _id: new Types.ObjectId(),
          action: "read",
          postId: new Types.ObjectId(),
          targetType: "post",
          dwellMs: 12000,
          source: "feed_for_you",
          at: new Date(),
        },
      ];

      vi.spyOn(User, "findById").mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(mockUser),
        }),
      } as any);
      vi.spyOn(UserTopicMix, "findOne").mockReturnValue({
        lean: vi.fn().mockResolvedValue(mockTopicMix),
      } as any);
      vi.spyOn(Event, "find").mockReturnValue({
        sort: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            lean: vi.fn().mockResolvedValue(mockEvents),
          }),
        }),
      } as any);

      const exported = await exportUserData(userId);

      expect(exported.complianceStandard).toContain("India DPDP Act 2023");
      expect(exported.user.email).toBe("test@example.com");
      expect(exported.topicMix?.hiddenPostIds).toEqual(["post-123"]);
      expect(exported.events).toHaveLength(1);
      expect(exported.events[0].action).toBe("read");
    });
  });

  describe("deleteAccount (Erasure)", () => {
    it("deletes all records from Event and UserTopicMix and emits user.deleted", async () => {
      const mockUser = {
        _id: new Types.ObjectId(userId),
        email: "test@example.com",
      };

      vi.spyOn(User, "findById").mockResolvedValue(mockUser as any);
      vi.spyOn(User, "findByIdAndDelete").mockResolvedValue(mockUser as any);
      vi.spyOn(User, "updateMany").mockResolvedValue({} as any);

      vi.spyOn(Post, "find").mockResolvedValue([]);
      vi.spyOn(Comment, "find").mockResolvedValue([]);
      vi.spyOn(Follow, "find").mockResolvedValue([]);
      vi.spyOn(Follow, "deleteMany").mockResolvedValue({ deletedCount: 0 } as any);
      vi.spyOn(CircleMembership, "find").mockResolvedValue([]);
      vi.spyOn(CircleMembership, "deleteMany").mockResolvedValue({ deletedCount: 0 } as any);
      vi.spyOn(Circle, "updateOne").mockResolvedValue({} as any);
      vi.spyOn(User, "updateOne").mockResolvedValue({} as any);
      vi.spyOn(Source, "updateOne").mockResolvedValue({} as any);
      vi.spyOn(SourceFollow, "find").mockResolvedValue([]);
      vi.spyOn(SourceFollow, "deleteMany").mockResolvedValue({ deletedCount: 0 } as any);
      vi.spyOn(Bookmark, "deleteMany").mockResolvedValue({ deletedCount: 0 } as any);
      vi.spyOn(BookmarkFolder, "deleteMany").mockResolvedValue({ deletedCount: 0 } as any);
      vi.spyOn(Vote, "deleteMany").mockResolvedValue({ deletedCount: 0 } as any);
      vi.spyOn(Notification, "deleteMany").mockResolvedValue({ deletedCount: 0 } as any);
      vi.spyOn(CircleInvite, "deleteMany").mockResolvedValue({ deletedCount: 0 } as any);

      // Spies for recsys & behavioral collections
      const eventDeleteSpy = vi.spyOn(Event, "deleteMany").mockResolvedValue({ deletedCount: 5 } as any);
      const topicMixDeleteSpy = vi.spyOn(UserTopicMix, "deleteMany").mockResolvedValue({ deletedCount: 1 } as any);
      const emitSpy = vi.spyOn(eventBus, "emitDomainEvent").mockImplementation(() => {});

      await deleteAccount(userId);

      expect(eventDeleteSpy).toHaveBeenCalledWith({ userId });
      expect(topicMixDeleteSpy).toHaveBeenCalledWith({ userId });
      expect(emitSpy).toHaveBeenCalledWith("user.deleted", { userId });
    });
  });
});
