import type { Request, Response } from "express";
import * as agentSearchService from "../services/agentSearchService.js";

export async function searchQuery(req: Request, res: Response): Promise<void> {
  const { query } = req.body as { query: string };
  const filters = await agentSearchService.interpretQuery(query);

  res.json({
    category: filters.category ?? null,
    subcategory: filters.subcategory ?? null,
    hashtag: filters.hashtag ?? null,
    country: filters.country ?? null,
    q: filters.q ?? null,
    sort: filters.sort ?? null,
  });
}
