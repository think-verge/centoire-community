import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { Post } from "../models/Post.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { resolveReadTarget } from "../utils/readTarget.js";

export const redirectRouter = Router();

// Only posts that can be seen (published, or in review for editors) can be read out.
async function readablePost(id: string) {
  if (!Types.ObjectId.isValid(id)) throw new ApiError(404, "Post not found");
  const post = await Post.findById(id).select("externalUrl status");
  const target = post && ["published", "pending_review"].includes(post.status) ? resolveReadTarget(post.externalUrl) : null;
  if (!post || !target) throw new ApiError(404, "Post not found");
  return { post, target };
}

// GET /api/v1/r/:id — "Read post" fallback: counts the click and redirects to the original article (new tab).
redirectRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const { post, target } = await readablePost(req.params.id as string);
    if (req.method !== "HEAD") void Post.updateOne({ _id: post._id }, { $inc: { clickCount: 1 } }).catch(() => {});
    res.set("Cache-Control", "no-store");
    res.redirect(302, target);
  }),
);

const CountBody = z.object({ mode: z.enum(["reader", "newTab"]).default("reader") });

// POST /api/v1/r/:id — count-only variant used when the article opens inside Centoire (no redirect happens).
redirectRouter.post(
  "/:id",
  asyncHandler(async (req, res) => {
    const { mode } = CountBody.parse(req.body ?? {});
    const { post } = await readablePost(req.params.id as string);
    const inc = mode === "reader" ? { clickCount: 1, readerOpenCount: 1 } : { clickCount: 1 };
    await Post.updateOne({ _id: post._id }, { $inc: inc });
    res.status(204).end();
  }),
);
