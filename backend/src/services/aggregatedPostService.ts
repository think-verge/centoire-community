import type { Types } from "mongoose";
import type { PostCategory } from "../config/categoryTaxonomy.js";
import { Post, type IPost } from "../models/Post.js";
import { canonicalUrlHash } from "../utils/url-hash.js";
import { readTimeMinutes } from "../utils/read-time.js";
import { slugifyWithId } from "../utils/slugify.js";
import { fireAiProcessing } from "./aiService.js";
import { evaluate as evaluatePolicy } from "./policyService.js";
import { finalizePublish } from "./postService.js";
import { inferCountry } from "./regionService.js";

export const AGGREGATED_POST_TTL_MS = 2 * 24 * 60 * 60 * 1000; // matches cleanupCron's expiry window

/** The parts of a Source this service needs (a full ISource satisfies it). */
export interface SourceDefaults {
  _id: Types.ObjectId;
  hashtags?: string[];
  category?: PostCategory;
  subcategory?: string;
  requiresLogin?: boolean;
  spec?: { store?: "full" | "excerpt" };
}

export interface AggregatedPostInput {
  url: string;
  title: string;
  excerpt?: string;
  contentHtml?: string;
  contentText?: string;
  coverImageUrl?: string;
  publishedAt?: Date;
  country?: string;
  specHash?: string;
  /** Set false when the caller will trigger AI itself (kept for tests). */
  fireAi?: boolean;
}

export type UpsertOutcome = "created" | "updated" | "duplicate";

export interface UpsertResult {
  outcome: UpsertOutcome;
  post: IPost;
}

/** Bodies shorter than this still go through the AI agent's own fetch; longer ones are sent along. */
const MIN_BODY_FOR_AI = 500;

const text = (s: string | undefined) => (s ?? "").replace(/\s+/g, " ").trim();

/**
 * Idempotent create-or-enrich of an aggregated post, keyed by the canonical URL hash.
 *
 *  - new URL        -> create (policy phase 1, AI analysis, auto-approve/reject as configured)
 *  - known URL      -> "updated" only when the incoming body is meaningfully richer than what is stored
 *                      (e.g. an RSS teaser that a logged-in scrape can now fill in); otherwise "duplicate"
 *
 * `contentAccess` follows the source: members-only for logged-in/paid sources that store full text.
 */
export async function upsertAggregatedPost(source: SourceDefaults, input: AggregatedPostInput): Promise<UpsertResult> {
  const hash = canonicalUrlHash(input.url);
  const store = source.spec?.store ?? "excerpt";
  const keepBody = store === "full";

  const excerpt = text(input.excerpt || input.contentText).slice(0, 300);
  const bodyText = keepBody ? text(input.contentText) : "";
  const bodyHtml = keepBody ? input.contentHtml : undefined;
  const contentAccess = source.requiresLogin && keepBody ? "members" : "open";

  const existing = await Post.findOne({ canonicalUrlHash: hash });
  if (existing) {
    const richer = keepBody && bodyText.length > Math.max(excerpt.length, text(existing.contentText).length) * 1.2 && bodyText.length > 200;
    if (!richer) return { outcome: "duplicate", post: existing };
    existing.contentHtml = bodyHtml ?? existing.contentHtml;
    existing.contentText = bodyText;
    existing.readTimeMinutes = readTimeMinutes(bodyText);
    if (!existing.coverImageUrl && input.coverImageUrl) existing.coverImageUrl = input.coverImageUrl;
    existing.contentAccess = contentAccess;
    existing.scrapedAt = new Date();
    if (input.specHash) existing.scrapeSpecHash = input.specHash;
    await existing.save();
    return { outcome: "updated", post: existing };
  }

  // Phase 1 policy (identity-only) decides the initial status; phase 2 runs after AI analysis.
  const policyOutcome = await evaluatePolicy({ sourceId: source._id.toString(), origin: "aggregated" });
  const country = input.country ?? (await inferCountry({ title: input.title, excerpt })) ?? undefined;

  let post: IPost;
  try {
    post = await Post.create({
      origin: "aggregated",
      status: "pending_review",
      sourceId: source._id,
      title: input.title.trim().slice(0, 200),
      slug: slugifyWithId(input.title),
      excerpt,
      contentHtml: bodyHtml,
      contentText: bodyText || excerpt,
      coverImageUrl: input.coverImageUrl,
      externalUrl: input.url,
      canonicalUrlHash: hash,
      hashtags: source.hashtags ?? [],
      category: source.category,
      subcategory: source.subcategory,
      country,
      publishedAt: input.publishedAt ?? new Date(),
      readTimeMinutes: readTimeMinutes(bodyText || excerpt),
      expiresAt: new Date(Date.now() + AGGREGATED_POST_TTL_MS),
      contentAccess,
      scrapedAt: new Date(),
      scrapeSpecHash: input.specHash,
    });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      // Lost a race with another worker creating the same URL: report it as the duplicate it is.
      const winner = await Post.findOne({ canonicalUrlHash: hash });
      if (winner) return { outcome: "duplicate", post: winner };
    }
    throw err;
  }

  if (input.fireAi !== false) {
    // Hand over text we already have (possibly paywalled) so the AI agent doesn't re-fetch the URL.
    const aiOpts = bodyText.length >= MIN_BODY_FOR_AI
      ? { origin: "aggregated", content: bodyText }
      : { origin: "aggregated", url: input.url };
    void fireAiProcessing(post._id.toString(), aiOpts);
  }

  if (policyOutcome === "auto_approve") {
    await finalizePublish(post);
  } else if (policyOutcome === "auto_reject") {
    post.status = "rejected";
    post.reviewedAt = new Date();
    post.rejectionReason = "Rejected by moderation policy";
    await post.save();
  }
  return { outcome: "created", post };
}
