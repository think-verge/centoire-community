import type { Request, Response } from "express";
import * as categoryBackfillService from "../services/categoryBackfillService.js";

export async function backfillCategories(_req: Request, res: Response): Promise<void> {
  const result = await categoryBackfillService.backfillUncategorizedPosts();
  res.json(result);
}
