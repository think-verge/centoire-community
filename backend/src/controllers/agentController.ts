import type { Request, Response } from "express";
import { Tag } from "../models/Tag.js";
import * as agentSearchService from "../services/agentSearchService.js";

export async function searchQuery(req: Request, res: Response): Promise<void> {
  const { query } = req.body as { query: string };
  const filters = await agentSearchService.interpretQuery(query);

  let tag: { slug: string; name: string } | null = null;
  if (filters.tagSlug) {
    const doc = await Tag.findOne({ slug: filters.tagSlug }).select("slug name").lean();
    if (doc) tag = { slug: doc.slug, name: doc.name };
  }

  res.json({
    category: filters.category ?? null,
    subcategory: filters.subcategory ?? null,
    tag,
    country: filters.country ?? null,
    q: filters.q ?? null,
    sort: filters.sort ?? null,
  });
}
