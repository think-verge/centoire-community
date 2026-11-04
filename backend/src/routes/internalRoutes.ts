import { Router, type Request, type Response } from "express";
import { env } from "../config/env.js";
import { Post } from "../models/Post.js";
import { UserTopicMix } from "../models/UserTopicMix.js";
import { evaluate } from "../services/policyService.js";
import { finalizePublish } from "../services/postService.js";
import * as hashtagService from "../services/hashtagService.js";
import { MAX_POST_HASHTAGS, diffHashtags } from "../utils/hashtag.js";

export const internalRouter = Router();

internalRouter.use((req, res, next) => {
  if (req.headers["x-internal-secret"] !== env.AI_INTERNAL_SECRET) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  next();
});

/** Receives AI processing results from the ai-agent service after async analysis. */
internalRouter.patch("/posts/:id/ai-result", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      status,
      aiReadTimeMinutes,
      aiCategory,
      aiTags,
      aiQualityScore,
      aiIsSpam,
      aiSummary,
      clickbaitDetected,
    } = req.body as {
      status: string;
      aiReadTimeMinutes?: number;
      aiCategory?: string;
      aiTags?: string[];
      aiQualityScore?: number;
      aiIsSpam?: boolean;
      aiSummary?: string;
      clickbaitDetected?: boolean;
    };

    const update: Record<string, unknown> = {
      aiProcessed: true,
      ...(aiCategory !== undefined && { aiCategory }),
      ...(aiTags !== undefined && { aiTags }),
      ...(aiQualityScore !== undefined && { aiQualityScore }),
      ...(aiIsSpam !== undefined && { aiIsSpam }),
      ...(aiSummary !== undefined && { aiSummary }),
      ...(clickbaitDetected !== undefined && { clickbaitDetected }),
    };

    if (aiReadTimeMinutes) {
      update.aiReadTimeMinutes = aiReadTimeMinutes;
      update.readTimeMinutes = aiReadTimeMinutes;
    }

    // Spam auto-rejection is handled immediately without policy re-evaluation.
    if (aiIsSpam) {
      update.status = "rejected";
      update.rejectionReason = "Flagged as spam by AI content analysis";
      update.reviewedAt = new Date();
      await Post.updateOne({ _id: id }, { $set: update });
      res.json({ ok: true });
      return;
    }

    if (status === "rejected") {
      update.status = "rejected";
      update.rejectionReason = "Rejected by AI quality check";
      update.reviewedAt = new Date();
      await Post.updateOne({ _id: id }, { $set: update });
      res.json({ ok: true });
      return;
    }

    // Scraped posts: add the AI's suggestions that are already real hashtags (it never creates new
    // ones). Counts only move if the post is already live; otherwise finalizePublish counts them.
    const current = await Post.findById(id).select("origin status hashtags");
    if (current?.origin === "aggregated" && aiTags?.length) {
      const matches = await hashtagService.filterExisting(aiTags);
      const merged = [...new Set([...current.hashtags, ...matches])].slice(0, MAX_POST_HASHTAGS);
      update.hashtags = merged;
      if (current.status === "published") {
        await hashtagService.adjustCounts(diffHashtags(current.hashtags, merged));
      }
    }

    await Post.updateOne({ _id: id }, { $set: update });

    // Phase 2: Re-evaluate content-based policies for posts still in pending_review.
    const updated = await Post.findById(id).populate("authorId", "role email");
    if (updated && updated.status === "pending_review") {
      const outcome = await evaluate({
        authorId: updated.authorId?.toString(),
        authorEmail: (updated.authorId as unknown as { email?: string } | null)?.email,
        authorRole: (updated.authorId as unknown as { role?: string } | null)?.role,
        sourceId: updated.sourceId?.toString(),
        origin: updated.origin,
        aiCategory: updated.aiCategory,
        aiTags: updated.aiTags,
        aiQualityScore: updated.aiQualityScore,
        aiIsSpam: updated.aiIsSpam,
        clickbaitDetected: updated.clickbaitDetected,
      });

      if (outcome === "auto_approve") {
        await finalizePublish(updated);
      } else if (outcome === "auto_reject") {
        updated.status = "rejected";
        updated.rejectionReason = "Rejected by content policy";
        updated.reviewedAt = new Date();
        await updated.save();
      }
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** Returns user's topic mix profile. */
internalRouter.get("/users/:id/topic-mix", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const doc = await UserTopicMix.findOne({ userId: id }).lean();
    if (!doc) {
      res.json({
        userId: id,
        mix: {},
        rawPoints: {},
        dailyEarned: {},
        activeDays: 1,
        lastActiveDate: new Date().toISOString().slice(0, 10),
        hiddenPostIds: [],
        clusterVersion: 1,
      });
      return;
    }

    res.json({
      userId: id,
      mix: doc.mix ? Object.fromEntries(doc.mix instanceof Map ? doc.mix : Object.entries(doc.mix)) : {},
      rawPoints: doc.rawPoints ? Object.fromEntries(doc.rawPoints instanceof Map ? doc.rawPoints : Object.entries(doc.rawPoints)) : {},
      dailyEarned: doc.dailyEarned ? Object.fromEntries(doc.dailyEarned instanceof Map ? doc.dailyEarned : Object.entries(doc.dailyEarned)) : {},
      activeDays: doc.activeDays ?? 1,
      lastActiveDate: doc.lastActiveDate ?? new Date().toISOString().slice(0, 10),
      hiddenPostIds: doc.hiddenPostIds ?? [],
      clusterVersion: doc.clusterVersion ?? 1,
      updatedAt: doc.updatedAt,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** Upserts user's topic mix profile. */
internalRouter.put("/users/:id/topic-mix", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      mix,
      rawPoints,
      dailyEarned,
      activeDays,
      lastActiveDate,
      hiddenPostIds,
      clusterVersion,
    } = req.body as {
      mix: Record<string, number>;
      rawPoints?: Record<string, number>;
      dailyEarned?: Record<string, number>;
      activeDays?: number;
      lastActiveDate?: string;
      hiddenPostIds?: string[];
      clusterVersion?: number;
    };

    const update: Record<string, unknown> = {
      mix: mix || {},
      ...(rawPoints !== undefined && { rawPoints }),
      ...(dailyEarned !== undefined && { dailyEarned }),
      ...(activeDays !== undefined && { activeDays }),
      ...(lastActiveDate !== undefined && { lastActiveDate }),
      ...(hiddenPostIds !== undefined && { hiddenPostIds }),
      ...(clusterVersion !== undefined && { clusterVersion }),
    };

    const updated = await UserTopicMix.findOneAndUpdate(
      { userId: id },
      { $set: update },
      { upsert: true, new: true },
    ).lean();

    res.json({ ok: true, data: updated });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
