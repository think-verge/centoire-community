import { Router, type Request, type Response } from "express";
import { env } from "../config/env.js";
import { Post } from "../models/Post.js";
import { Cluster, ClusterMetadata } from "../models/Cluster.js";
import { UserTopicMix } from "../models/UserTopicMix.js";
import { evaluate } from "../services/policyService.js";
import { finalizePublish } from "../services/postService.js";
import * as hashtagService from "../services/hashtagService.js";
import { MAX_POST_HASHTAGS, diffHashtags } from "../utils/hashtag.js";
import { emitPostLifecycleEvent } from "../services/postLifecycleService.js";

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

    // If the post was already published before this AI analysis arrived:
    // - External posts wait for AI enrichment to emit post.created
    // - Native posts re-emit post.updated to attach the newly enriched aiSummary
    if (current?.status === "published") {
      const refreshed = await Post.findById(id);
      if (refreshed && refreshed.status === "published") {
        const event = refreshed.origin === "aggregated" ? "post.created" : "post.updated";
        void emitPostLifecycleEvent(event, refreshed).catch((err) => {
          console.error(`[internalRoutes] Failed to emit ${event} for ${refreshed._id}:`, err);
        });
      }
    }

    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** Returns cluster documents (active version by default) so the embedding service can find the nearest cluster. */
internalRouter.get("/clusters", async (req: Request, res: Response) => {
  try {
    const versionQuery = req.query["version"];
    let filter: Record<string, unknown> = {};

    if (versionQuery && versionQuery !== "all") {
      filter = { version: Number(versionQuery) };
    } else if (!versionQuery) {
      const meta = await ClusterMetadata.findOne({ key: "global" }).lean();
      if (meta?.activeVersion) {
        filter = { version: meta.activeVersion };
      }
    }

    const clusters = await Cluster.find(filter)
      .select("clusterId centre postCount version updatedAt")
      .lean();

    const result = clusters.map((c) => ({
      cluster_id: c.clusterId,
      centre: c.centre,
      post_count: c.postCount ?? 0,
      version: c.version,
      updated_at: c.updatedAt,
    }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** Updates a post's embedding fields after the AI agent generates an embedding. */
internalRouter.patch("/posts/:id/embedding", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      embedding,
      clusterId,
      modelName,
      modelVersion,
      embeddingStatus,
    } = req.body as {
      embedding?: number[];
      clusterId?: number;
      modelName?: string;
      modelVersion?: string;
      embeddingStatus: "pending" | "completed" | "failed";
    };

    if (embeddingStatus === "failed") {
      await Post.updateOne({ _id: id }, { $set: { embeddingStatus: "failed" } });
      res.json({ ok: true });
      return;
    }

    if (embeddingStatus === "completed") {
      const update: Record<string, unknown> = { embeddingStatus: "completed" };
      if (embedding !== undefined) update.embedding = embedding;
      if (clusterId !== undefined) update.clusterId = clusterId;
      if (modelName !== undefined) update.embeddingModel = modelName;
      if (modelVersion !== undefined) update.embeddingVersion = modelVersion;
      await Post.updateOne({ _id: id }, { $set: update });
      res.json({ ok: true });
      return;
    }

    res.status(400).json({ error: "Invalid embeddingStatus" });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** Returns cluster metadata (active version, total clusters). */
internalRouter.get("/clusters/metadata", async (_req: Request, res: Response) => {
  try {
    let meta = await ClusterMetadata.findOne({ key: "global" }).lean();
    if (!meta) {
      const latestCluster = await Cluster.findOne({}).sort({ version: -1 }).lean();
      const initialVersion = latestCluster?.version ?? 1;
      const count = await Cluster.countDocuments({ version: initialVersion });
      meta = await ClusterMetadata.findOneAndUpdate(
        { key: "global" },
        { $setOnInsert: { activeVersion: initialVersion, totalClusters: count } },
        { upsert: true, new: true },
      ).lean();
    }
    res.json({
      activeVersion: meta?.activeVersion ?? 1,
      totalClusters: meta?.totalClusters ?? 0,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** Saves staged clusters in bulk for a specific version. */
internalRouter.post("/clusters/bulk", async (req: Request, res: Response) => {
  try {
    const { version, clusters } = req.body as {
      version: number;
      clusters: Array<{ clusterId: number; centre: number[]; postCount?: number }>;
    };

    if (!version || !Array.isArray(clusters) || clusters.length === 0) {
      res.status(400).json({ error: "version and non-empty clusters array required" });
      return;
    }

    const operations = clusters.map((c) => ({
      updateOne: {
        filter: { version, clusterId: c.clusterId },
        update: {
          $set: {
            centre: c.centre,
            postCount: c.postCount ?? 0,
            version,
            clusterId: c.clusterId,
          },
        },
        upsert: true,
      },
    }));

    await Cluster.bulkWrite(operations);
    res.json({ ok: true, count: clusters.length, version });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/** Performs atomic version cutover and updates post cluster assignments. */
internalRouter.post("/clusters/cutover", async (req: Request, res: Response) => {
  try {
    const { newVersion, postAssignments } = req.body as {
      newVersion: number;
      postAssignments?: Array<{ postId: string; clusterId: number }>;
    };

    if (!newVersion) {
      res.status(400).json({ error: "newVersion is required" });
      return;
    }

    // 1. Update post assignments in bulk if provided
    let updatedPostsCount = 0;
    if (Array.isArray(postAssignments) && postAssignments.length > 0) {
      const batchSize = 1000;
      for (let i = 0; i < postAssignments.length; i += batchSize) {
        const batch = postAssignments.slice(i, i + batchSize);
        const operations = batch.map((p) => ({
          updateOne: {
            filter: { _id: p.postId },
            update: {
              $set: {
                clusterId: p.clusterId,
                clusterVersion: newVersion,
              },
            },
          },
        }));
        const resBatch = await Post.bulkWrite(operations);
        updatedPostsCount += resBatch.modifiedCount;
      }
    }

    // 2. Count clusters in the new version
    const totalClusters = await Cluster.countDocuments({ version: newVersion });

    // 3. Atomically activate the new version in metadata
    await ClusterMetadata.findOneAndUpdate(
      { key: "global" },
      { $set: { activeVersion: newVersion, totalClusters } },
      { upsert: true, new: true },
    );

    res.json({
      ok: true,
      activeVersion: newVersion,
      totalClusters,
      updatedPostsCount,
    });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * Returns posts that have no embedding or embeddingStatus != "completed".
 * Used by the backfill script.
 */
internalRouter.get("/posts/without-embedding", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query["limit"] ?? 50), 200);
    const offset = Number(req.query["offset"] ?? 0);

    const posts = await Post.find({
      $or: [
        { embeddingStatus: { $exists: false } },
        { embeddingStatus: { $ne: "completed" } },
      ],
    })
      .select(
        "_id title excerpt aiSummary hashtags circleName authorHandle origin contentText embeddingStatus",
      )
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .lean();

    res.json(posts);
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

/**
 * Returns posts that already have embeddings.
 * Used by the topic clustering and weekly reclustering jobs.
 */
internalRouter.get("/posts/with-embedding", async (req: Request, res: Response) => {
  try {
    const limit = Math.min(Number(req.query["limit"] ?? 500), 2000);
    const offset = Number(req.query["offset"] ?? 0);

    const posts = await Post.find({
      embedding: { $exists: true, $ne: null },
    })
      .select("_id title embedding clusterId clusterVersion")
      .sort({ _id: 1 })
      .skip(offset)
      .limit(limit)
      .lean();

    res.json(posts);
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
