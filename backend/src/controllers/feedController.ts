import type { Request, Response } from "express";
import { Types } from "mongoose";
import * as feedService from "../services/feedService.js";
import { normalizeHashtag } from "../utils/hashtag.js";
import type { PostCategory } from "../config/categoryTaxonomy.js";

export async function forYou(req: Request, res: Response): Promise<void> {
  const { cursor } = (req.validatedQuery ?? {}) as { cursor?: string };
  const page = await feedService.forYou(req.user!.userId, cursor);
  res.json(page);
}

export async function following(req: Request, res: Response): Promise<void> {
  const { cursor } = (req.validatedQuery ?? {}) as { cursor?: string };
  const page = await feedService.following(req.user!.userId, cursor);
  res.json(page);
}

export async function discover(req: Request, res: Response): Promise<void> {
  const query = (req.validatedQuery ?? {}) as {
    sort?: "trending" | "new";
    hashtag?: string;
    origin?: "native" | "aggregated";
    source?: string;
    category?: PostCategory;
    subcategory?: string;
    country?: string;
    q?: string;
    cursor?: string;
  };
  // An unknown or malformed hashtag simply has no posts; return an empty page rather than a 404.
  const hashtag = query.hashtag ? (normalizeHashtag(query.hashtag) ?? "\u0000none") : undefined;
  let sourceId: Types.ObjectId | undefined;
  if (query.source && Types.ObjectId.isValid(query.source)) {
    sourceId = new Types.ObjectId(query.source);
  }
  const page = await feedService.discover(
    {
      sort: query.sort ?? "trending",
      hashtag,
      sourceId,
      origin: query.origin,
      category: query.category,
      subcategory: query.subcategory,
      country: query.country?.toUpperCase(),
      q: query.q,
      cursor: query.cursor,
    },
    req.user?.userId,
  );
  res.json(page);
}

export async function category(req: Request, res: Response): Promise<void> {
  const { category: categoryParam } = req.params as { category: PostCategory };
  const { subcategory, cursor } = (req.validatedQuery ?? {}) as {
    subcategory?: string;
    cursor?: string;
  };
  const page = await feedService.categoryFeed(categoryParam, subcategory, cursor, req.user?.userId);
  res.json(page);
}
