import type { Request, Response } from "express";
import * as categoryBackfillService from "../services/categoryBackfillService.js";
import * as postLifecycleService from "../services/postLifecycleService.js";

export async function backfillCategories(_req: Request, res: Response): Promise<void> {
  const result = await categoryBackfillService.backfillUncategorizedPosts();
  res.json(result);
}

export async function toggleCurated(req: Request, res: Response): Promise<void> {
  const id = typeof req.params.id === "string" ? req.params.id : req.params.id[0];
  const curated = typeof req.body?.curated === "boolean" ? req.body.curated : undefined;
  const post = await postLifecycleService.setPostCurated(id, curated);
  res.json({
    id: post._id.toString(),
    curated: Boolean(post.curated),
    status: post.status,
  });
}
