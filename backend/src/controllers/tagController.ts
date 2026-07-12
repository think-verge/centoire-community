import type { Request, Response } from "express";
import type { TagCategory } from "../models/Tag.js";
import * as tagService from "../services/tagService.js";

export async function list(req: Request, res: Response): Promise<void> {
  const category = (req.validatedQuery as { category?: TagCategory } | undefined)?.category;
  const tags = await tagService.listTags(category);
  res.json(tags.map(tagService.serializeTag));
}

export async function getBySlug(req: Request, res: Response): Promise<void> {
  const tag = await tagService.getTagBySlug(req.params.slug as string);
  res.json(tagService.serializeTag(tag));
}
