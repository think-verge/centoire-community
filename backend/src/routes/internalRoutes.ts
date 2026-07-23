import { Router, type Request, type Response } from "express";
import { env } from "../config/env.js";
import { Post } from "../models/Post.js";

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
      aiQualityScore,
      aiIsSpam,
      aiSummary,
      clickbaitDetected,
    } = req.body as {
      status: string;
      aiReadTimeMinutes?: number;
      aiCategory?: string;
      aiQualityScore?: number;
      aiIsSpam?: boolean;
      aiSummary?: string;
      clickbaitDetected?: boolean;
    };

    const update: Record<string, unknown> = {
      aiProcessed: true,
      ...(aiCategory !== undefined && { aiCategory }),
      ...(aiQualityScore !== undefined && { aiQualityScore }),
      ...(aiIsSpam !== undefined && { aiIsSpam }),
      ...(aiSummary !== undefined && { aiSummary }),
      ...(clickbaitDetected !== undefined && { clickbaitDetected }),
    };

    if (aiReadTimeMinutes) {
      update.aiReadTimeMinutes = aiReadTimeMinutes;
      update.readTimeMinutes = aiReadTimeMinutes;
    }

    if (aiIsSpam) {
      update.status = "rejected";
      update.rejectionReason = "Flagged as spam by AI content analysis";
      update.reviewedAt = new Date();
    } else if (status === "rejected") {
      update.status = "rejected";
      update.rejectionReason = "Rejected by AI quality check";
      update.reviewedAt = new Date();
    }

    await Post.updateOne({ _id: id }, { $set: update });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});
