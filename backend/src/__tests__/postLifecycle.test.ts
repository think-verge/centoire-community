import { describe, expect, it, vi, beforeEach } from "vitest";
import { Types } from "mongoose";
import {
  buildPostLifecyclePayload,
  emitPostLifecycleEvent,
  resolveCirclePrivacy,
  setPostCurated,
} from "../services/postLifecycleService.js";
import { Circle } from "../models/Circle.js";
import { Post, type IPost } from "../models/Post.js";
import * as eventBus from "../events/eventBus.js";
import { CuratePostInputSchema } from "../schemas/posts.js";
import { finalizePublish } from "../services/postService.js";
import * as hashtagService from "../services/hashtagService.js";
import * as reputationService from "../services/reputationService.js";
import { User } from "../models/User.js";

describe("Post Lifecycle Service", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("resolveCirclePrivacy", () => {
    it("returns false if circleId is null or undefined", async () => {
      expect(await resolveCirclePrivacy(null)).toBe(false);
      expect(await resolveCirclePrivacy(undefined)).toBe(false);
    });

    it("returns true when circle.isPrivate is true", async () => {
      const circleId = new Types.ObjectId();
      vi.spyOn(Circle, "findById").mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue({ _id: circleId, isPrivate: true }),
        }),
      } as unknown as ReturnType<typeof Circle.findById>);

      const result = await resolveCirclePrivacy(circleId);
      expect(result).toBe(true);
    });

    it("returns false when circle.isPrivate is false", async () => {
      const circleId = new Types.ObjectId();
      vi.spyOn(Circle, "findById").mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue({ _id: circleId, isPrivate: false }),
        }),
      } as unknown as ReturnType<typeof Circle.findById>);

      const result = await resolveCirclePrivacy(circleId);
      expect(result).toBe(false);
    });

    it("returns false if circle document is not found", async () => {
      const circleId = new Types.ObjectId();
      vi.spyOn(Circle, "findById").mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(null),
        }),
      } as unknown as ReturnType<typeof Circle.findById>);

      const result = await resolveCirclePrivacy(circleId);
      expect(result).toBe(false);
    });
  });

  describe("buildPostLifecyclePayload", () => {
    it("builds prepared fields for native post including contentText", async () => {
      const postId = new Types.ObjectId();
      const authorId = new Types.ObjectId();
      const circleId = new Types.ObjectId();

      vi.spyOn(Circle, "findById").mockReturnValue({
        select: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue({ _id: circleId, isPrivate: true }),
        }),
      } as unknown as ReturnType<typeof Circle.findById>);

      const post = {
        _id: postId,
        origin: "native",
        title: "Test Native Post",
        excerpt: "This is a brief excerpt.",
        contentText: "This is full plain-text body content.",
        aiSummary: "AI summary of the post",
        hashtags: ["ai", "tech"],
        authorId,
        circleId,
        curated: true,
      } as unknown as IPost;

      const payload = await buildPostLifecyclePayload(post);

      expect(payload).toEqual({
        postId: postId.toString(),
        title: "Test Native Post",
        excerpt: "This is a brief excerpt.",
        aiSummary: "AI summary of the post",
        hashtags: ["ai", "tech"],
        authorId: authorId.toString(),
        circleId: circleId.toString(),
        curated: true,
        origin: "native",
        isCirclePrivate: true,
        contentText: "This is full plain-text body content.",
      });
    });

    it("omits contentText for external / aggregated posts (title + excerpt + summary only)", async () => {
      const postId = new Types.ObjectId();

      const post = {
        _id: postId,
        origin: "aggregated",
        title: "External Ingested Article",
        excerpt: "External RSS summary snippet.",
        contentText: "Scraped body that must NOT be sent for aggregated posts.",
        aiSummary: "Enriched concise summary by Gemini.",
        hashtags: ["news"],
        curated: false,
      } as unknown as IPost;

      const payload = await buildPostLifecyclePayload(post);

      expect(payload.origin).toBe("aggregated");
      expect(payload.title).toBe("External Ingested Article");
      expect(payload.excerpt).toBe("External RSS summary snippet.");
      expect(payload.aiSummary).toBe("Enriched concise summary by Gemini.");
      expect(payload.curated).toBe(false);
      expect(payload.isCirclePrivate).toBe(false);
      expect(payload.contentText).toBeUndefined();
    });
  });

  describe("emitPostLifecycleEvent", () => {
    it("emits domain event on eventBus with prepared payload", async () => {
      const emitSpy = vi.spyOn(eventBus, "emitDomainEvent").mockImplementation(() => {});

      const postId = new Types.ObjectId();
      const post = {
        _id: postId,
        origin: "native",
        title: "Event Emission Test",
        excerpt: "Excerpt here",
        contentText: "Body text",
        hashtags: ["testing"],
        curated: false,
      } as unknown as IPost;

      const payload = await emitPostLifecycleEvent("post.created", post);

      expect(emitSpy).toHaveBeenCalledTimes(1);
      expect(emitSpy).toHaveBeenCalledWith("post.created", payload);
      expect(payload.postId).toBe(postId.toString());
    });
  });

  describe("setPostCurated", () => {
    it("toggles curated flag when boolean argument is omitted", async () => {
      const postId = new Types.ObjectId();
      const mockPost = {
        _id: postId,
        curated: false,
        status: "published",
        origin: "native",
        title: "Curated Post",
        excerpt: "Sample excerpt",
        hashtags: [],
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(Post, "findById").mockResolvedValue(mockPost as unknown as IPost);
      const emitSpy = vi.spyOn(eventBus, "emitDomainEvent").mockImplementation(() => {});

      const result = await setPostCurated(postId.toString());

      expect(result.curated).toBe(true);
      expect(mockPost.save).toHaveBeenCalled();
      expect(emitSpy).toHaveBeenCalledWith("post.updated", expect.objectContaining({
        postId: postId.toString(),
        curated: true,
      }));
    });

    it("explicitly sets curated to false and re-emits post.updated if published", async () => {
      const postId = new Types.ObjectId();
      const mockPost = {
        _id: postId,
        curated: true,
        status: "published",
        origin: "native",
        title: "Un-curated Post",
        excerpt: "Sample excerpt",
        hashtags: [],
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(Post, "findById").mockResolvedValue(mockPost as unknown as IPost);
      const emitSpy = vi.spyOn(eventBus, "emitDomainEvent").mockImplementation(() => {});

      const result = await setPostCurated(postId.toString(), false);

      expect(result.curated).toBe(false);
      expect(emitSpy).toHaveBeenCalledWith("post.updated", expect.objectContaining({
        curated: false,
      }));
    });

    it("does not emit post.updated if post status is draft", async () => {
      const postId = new Types.ObjectId();
      const mockPost = {
        _id: postId,
        curated: false,
        status: "draft",
        origin: "native",
        title: "Draft Post",
        excerpt: "Sample",
        hashtags: [],
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(Post, "findById").mockResolvedValue(mockPost as unknown as IPost);
      const emitSpy = vi.spyOn(eventBus, "emitDomainEvent").mockImplementation(() => {});

      const result = await setPostCurated(postId.toString(), true);

      expect(result.curated).toBe(true);
      expect(emitSpy).not.toHaveBeenCalled();
    });

    it("throws 404 for invalid ObjectId or missing post", async () => {
      await expect(setPostCurated("invalid-id")).rejects.toThrow("Post not found");

      vi.spyOn(Post, "findById").mockResolvedValue(null);
      await expect(setPostCurated(new Types.ObjectId().toString())).rejects.toThrow("Post not found");
    });
  });

  describe("finalizePublish lifecycle emissions", () => {
    it("emits post.created for native posts on publish", async () => {
      const postId = new Types.ObjectId();
      const authorId = new Types.ObjectId();
      const post = {
        _id: postId,
        origin: "native",
        title: "Publish Native Post",
        excerpt: "Excerpt",
        contentText: "Content",
        hashtags: ["tech"],
        authorId,
        save: vi.fn().mockResolvedValue(true),
      } as unknown as IPost;

      vi.spyOn(hashtagService, "ensureHashtags").mockResolvedValue(["tech"]);
      vi.spyOn(hashtagService, "adjustCounts").mockResolvedValue();
      vi.spyOn(User, "updateOne").mockResolvedValue({} as never);
      vi.spyOn(reputationService, "award").mockResolvedValue({} as never);
      const emitSpy = vi.spyOn(eventBus, "emitDomainEvent").mockImplementation(() => {});

      await finalizePublish(post);

      expect(post.status).toBe("published");
      expect(emitSpy).toHaveBeenCalledWith("post.approved", expect.anything());
      // Wait microtask for void fire-and-forget emitPostLifecycleEvent
      await new Promise((r) => setTimeout(r, 10));
      expect(emitSpy).toHaveBeenCalledWith("post.created", expect.objectContaining({
        postId: postId.toString(),
        origin: "native",
        contentText: "Content",
      }));
    });

    it("does not emit post.created for aggregated posts if aiProcessed is false", async () => {
      const postId = new Types.ObjectId();
      const post = {
        _id: postId,
        origin: "aggregated",
        title: "Publish External Post Without AI",
        excerpt: "Excerpt",
        hashtags: ["news"],
        aiProcessed: false,
        save: vi.fn().mockResolvedValue(true),
      } as unknown as IPost;

      vi.spyOn(hashtagService, "ensureHashtags").mockResolvedValue(["news"]);
      vi.spyOn(hashtagService, "adjustCounts").mockResolvedValue();
      const emitSpy = vi.spyOn(eventBus, "emitDomainEvent").mockImplementation(() => {});

      await finalizePublish(post);

      expect(post.status).toBe("published");
      await new Promise((r) => setTimeout(r, 10));
      const postCreatedCalls = emitSpy.mock.calls.filter((c) => c[0] === "post.created");
      expect(postCreatedCalls).toHaveLength(0);
    });

    it("emits post.created for aggregated posts if aiProcessed is true (approved after AI completed)", async () => {
      const postId = new Types.ObjectId();
      const post = {
        _id: postId,
        origin: "aggregated",
        title: "Publish External Post With AI",
        excerpt: "Excerpt",
        aiSummary: "Enriched summary",
        hashtags: ["news"],
        aiProcessed: true,
        save: vi.fn().mockResolvedValue(true),
      } as unknown as IPost;

      vi.spyOn(hashtagService, "ensureHashtags").mockResolvedValue(["news"]);
      vi.spyOn(hashtagService, "adjustCounts").mockResolvedValue();
      const emitSpy = vi.spyOn(eventBus, "emitDomainEvent").mockImplementation(() => {});

      await finalizePublish(post);

      expect(post.status).toBe("published");
      await new Promise((r) => setTimeout(r, 10));
      expect(emitSpy).toHaveBeenCalledWith("post.created", expect.objectContaining({
        postId: postId.toString(),
        origin: "aggregated",
        aiSummary: "Enriched summary",
      }));
    });
  });

  describe("CuratePostInputSchema", () => {
    it("validates optional boolean curated", () => {
      expect(CuratePostInputSchema.parse({ curated: true })).toEqual({ curated: true });
      expect(CuratePostInputSchema.parse({ curated: false })).toEqual({ curated: false });
      expect(CuratePostInputSchema.parse({})).toEqual({});
    });

    it("rejects non-boolean curated values", () => {
      expect(() => CuratePostInputSchema.parse({ curated: "true" })).toThrow();
      expect(() => CuratePostInputSchema.parse({ curated: 1 })).toThrow();
    });
  });
});
