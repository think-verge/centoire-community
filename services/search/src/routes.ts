import { asyncHandler } from "@centoire/bahamut";
import { Router } from "express";
import { z } from "zod";
import * as service from "./service.js";

const SearchQuery = z.object({
  q: z.string().max(100).default("").optional(),
  type: z.enum(["all", "posts", "people", "circles", "hashtags", "tags"]).optional(),
});

// Search is anonymous-friendly (the gateway still forwards claims if a session exists).
export const searchRouter = Router();
searchRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { q, type } = SearchQuery.parse(req.query);
    res.json(await service.search(q ?? "", type ?? "all"));
  }),
);
