import type { Request, Response } from "express";
import * as searchService from "../services/searchService.js";

export async function search(req: Request, res: Response): Promise<void> {
  const { q, type } = req.validatedQuery as { q: string; type?: searchService.SearchType };
  const results = await searchService.search(q, type ?? "all");
  res.json(results);
}
