import { Router, type Request, type Response } from "express";
import { env } from "../config/env.js";
import { Post } from "../models/Post.js";
import { evaluate } from "../services/policyService.js";
import { finalizePublish } from "../services/postService.js";

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
