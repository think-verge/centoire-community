import { describe, expect, it, vi, beforeEach } from "vitest";
import { Types } from "mongoose";

// Stub models
const userFindById = vi.fn();
const userFind = vi.fn();
const userUpdateOne = vi.fn();
const userUpdateMany = vi.fn();
const followFind = vi.fn();
const followFindOne = vi.fn();
const followFindOneAndDelete = vi.fn();
const followDeleteMany = vi.fn();
const circleFind = vi.fn();
const circleMembershipFind = vi.fn();
const circleMembershipDeleteMany = vi.fn();
const emitDomainEventMock = vi.fn();

function leanSelectChain(result: unknown) {
  return {
    select: () => ({
      lean: async () => result,
    }),
  };
}

function findChain(result: unknown) {
  const c: Record<string, unknown> = {};
  for (const m of ["sort", "limit", "select"]) {
    c[m] = () => c;
  }
  (c as any).lean = async () => result;
  (c as any).then = (resolve: (val: unknown) => void) => Promise.resolve(result).then(resolve);
  return c;
}

vi.mock("../models/User.js", () => ({
  User: {
    findById: (...a: unknown[]) => userFindById(...a),
    find: (...a: unknown[]) => findChain(userFind(...a)),
    updateOne: (...a: unknown[]) => userUpdateOne(...a),
    updateMany: (...a: unknown[]) => userUpdateMany(...a),
  },
}));

vi.mock("../models/Follow.js", () => ({
  Follow: {
    find: (...a: unknown[]) => {
      const res = followFind(...a);
      return {
        select: () => ({
          lean: async () => res,
          then: (resolve: (val: unknown) => void) => Promise.resolve(res).then(resolve),
        }),
        then: (resolve: (val: unknown) => void) => Promise.resolve(res).then(resolve),
      };
    },
    findOne: (...a: unknown[]) => followFindOne(...a),
    findOneAndDelete: (...a: unknown[]) => followFindOneAndDelete(...a),
    deleteMany: (...a: unknown[]) => followDeleteMany(...a),
  },
}));

vi.mock("../models/CircleMembership.js", () => ({
  CircleMembership: {
    find: (...a: unknown[]) => {
      const res = circleMembershipFind(...a);
      return {
        select: () => ({
          lean: async () => res,
          then: (resolve: (val: unknown) => void) => Promise.resolve(res).then(resolve),
        }),
        then: (resolve: (val: unknown) => void) => Promise.resolve(res).then(resolve),
      };
    },
    deleteMany: (...a: unknown[]) => circleMembershipDeleteMany(...a),
  },
}));

vi.mock("../models/Circle.js", () => ({
  Circle: {
    find: (...a: unknown[]) => findChain(circleFind(...a)),
    updateOne: vi.fn(),
  },
}));

vi.mock("../events/eventBus.js", () => ({
  emitDomainEvent: (...a: unknown[]) => emitDomainEventMock(...a),
}));

const userService = await import("../services/userService.js");
const onboardingService = await import("../services/onboardingService.js");

describe("Social Graph - Block and Mute Service", () => {
  const userId = new Types.ObjectId().toString();
  const targetUserId = new Types.ObjectId().toString();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("blockUser", () => {
    it("rejects self-blocking with 422", async () => {
      await expect(userService.blockUser(userId, userId)).rejects.toThrow("You cannot block yourself");
    });

    it("rejects invalid target user ID with 400", async () => {
      await expect(userService.blockUser(userId, "invalid-id")).rejects.toThrow("Invalid target user ID");
    });

    it("rejects non-existent target user with 404", async () => {
      userFindById.mockResolvedValueOnce(null);
      await expect(userService.blockUser(userId, targetUserId)).rejects.toThrow("User not found");
    });

    it("adds target to blockedUsers, severs mutual follows, and emits event", async () => {
      userFindById.mockResolvedValueOnce({ _id: targetUserId });
      followFindOneAndDelete.mockResolvedValue(null);

      await userService.blockUser(userId, targetUserId);

      expect(userUpdateOne).toHaveBeenCalledWith(
        { _id: userId },
        { $addToSet: { blockedUsers: new Types.ObjectId(targetUserId) } },
      );
      expect(emitDomainEventMock).toHaveBeenCalledWith("social.user_blocked", {
        userId,
        targetUserId,
      });
    });
  });

  describe("unblockUser", () => {
    it("removes target from blockedUsers and emits event", async () => {
      await userService.unblockUser(userId, targetUserId);

      expect(userUpdateOne).toHaveBeenCalledWith(
        { _id: userId },
        { $pull: { blockedUsers: new Types.ObjectId(targetUserId) } },
      );
      expect(emitDomainEventMock).toHaveBeenCalledWith("social.user_unblocked", {
        userId,
        targetUserId,
      });
    });
  });

  describe("muteUser", () => {
    it("rejects self-muting with 422", async () => {
      await expect(userService.muteUser(userId, userId)).rejects.toThrow("You cannot mute yourself");
    });

    it("rejects invalid target user ID with 400", async () => {
      await expect(userService.muteUser(userId, "bad-id")).rejects.toThrow("Invalid target user ID");
    });

    it("rejects non-existent target user with 404", async () => {
      userFindById.mockResolvedValueOnce(null);
      await expect(userService.muteUser(userId, targetUserId)).rejects.toThrow("User not found");
    });

    it("adds target to mutedUsers and emits event", async () => {
      userFindById.mockResolvedValueOnce({ _id: targetUserId });

      await userService.muteUser(userId, targetUserId);

      expect(userUpdateOne).toHaveBeenCalledWith(
        { _id: userId },
        { $addToSet: { mutedUsers: new Types.ObjectId(targetUserId) } },
      );
      expect(emitDomainEventMock).toHaveBeenCalledWith("social.user_muted", {
        userId,
        targetUserId,
      });
    });
  });

  describe("unmuteUser", () => {
    it("removes target from mutedUsers and emits event", async () => {
      await userService.unmuteUser(userId, targetUserId);

      expect(userUpdateOne).toHaveBeenCalledWith(
        { _id: userId },
        { $pull: { mutedUsers: new Types.ObjectId(targetUserId) } },
      );
      expect(emitDomainEventMock).toHaveBeenCalledWith("social.user_unmuted", {
        userId,
        targetUserId,
      });
    });
  });

  describe("getBlockedAndMutedUserIds", () => {
    it("returns combined deduped ObjectId list for blocked and muted users", async () => {
      const id1 = new Types.ObjectId();
      const id2 = new Types.ObjectId();
      userFindById.mockReturnValueOnce(
        leanSelectChain({
          blockedUsers: [id1],
          mutedUsers: [id1, id2],
        }),
      );

      const ids = await userService.getBlockedAndMutedUserIds(userId);
      expect(ids).toHaveLength(2);
      expect(ids.map((id) => id.toString())).toContain(id1.toString());
      expect(ids.map((id) => id.toString())).toContain(id2.toString());
    });

    it("returns empty array when user has no blocked or muted users", async () => {
      userFindById.mockReturnValueOnce(
        leanSelectChain({
          blockedUsers: [],
          mutedUsers: [],
        }),
      );

      const ids = await userService.getBlockedAndMutedUserIds(userId);
      expect(ids).toEqual([]);
    });
  });

  describe("getSocialGraph", () => {
    it("returns full social graph context for recommendation engine", async () => {
      const followeeId = new Types.ObjectId();
      const circleId = new Types.ObjectId();
      const dismissedPostId = new Types.ObjectId();
      const blockedId = new Types.ObjectId();
      const mutedId = new Types.ObjectId();

      userFindById.mockReturnValueOnce(
        leanSelectChain({
          dismissedPosts: [dismissedPostId],
          blockedUsers: [blockedId],
          mutedUsers: [mutedId],
        }),
      );
      followFind.mockReturnValueOnce([{ followeeId }]);
      circleMembershipFind.mockReturnValueOnce([{ circleId }]);

      const graph = await userService.getSocialGraph(userId);

      expect(graph.userId).toBe(userId);
      expect(graph.followedUserIds).toEqual([followeeId.toString()]);
      expect(graph.membershipCircleIds).toEqual([circleId.toString()]);
      expect(graph.dismissedPostIds).toEqual([dismissedPostId.toString()]);
      expect(graph.blockedUserIds).toEqual([blockedId.toString()]);
      expect(graph.mutedUserIds).toEqual([mutedId.toString()]);
      expect(graph.allExcludedAuthorIds).toContain(blockedId.toString());
      expect(graph.allExcludedAuthorIds).toContain(mutedId.toString());
    });
  });

  describe("onboardingService.getSuggestions with blocked/muted authors", () => {
    it("excludes blocked and muted creators from suggested creator queries", async () => {
      const blockedId = new Types.ObjectId();
      const mutedId = new Types.ObjectId();

      userFindById
        .mockResolvedValueOnce({ followedHashtags: ["minimalism"] }) // User.findById(userId)
        .mockReturnValueOnce(
          leanSelectChain({
            blockedUsers: [blockedId],
            mutedUsers: [mutedId],
          }),
        ); // userService.getBlockedAndMutedUserIds

      userFind.mockReturnValue([]);
      circleFind.mockReturnValue([]);
      followFind.mockReturnValue([]);
      circleMembershipFind.mockReturnValue([]);

      await onboardingService.getSuggestions(userId);

      // Verify that userFind was called with excluded author IDs
      const firstFindCall = userFind.mock.calls[0][0];
      expect(firstFindCall._id.$nin.map((id: Types.ObjectId) => id.toString())).toEqual(
        expect.arrayContaining([userId, blockedId.toString(), mutedId.toString()]),
      );
    });
  });
});
