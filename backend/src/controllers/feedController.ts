import type { Request, Response } from "express";
import { Types } from "mongoose";
import { Tag } from "../models/Tag.js";
import * as feedService from "../services/feedService.js";
import { ApiError } from "../utils/api-error.js";

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
    tag?: string;
    cursor?: string;
  };
  let tagId: Types.ObjectId | undefined;
  if (query.tag) {
    const tag = await Tag.findOne({ slug: query.tag }).select("_id");
    if (!tag) throw new ApiError(404, "Tag not found");
    tagId = tag._id;
  }
  const page = await feedService.discover(
    { sort: query.sort ?? "trending", tagId, cursor: query.cursor },
    req.user?.userId,
  );
  res.json(page);
}
