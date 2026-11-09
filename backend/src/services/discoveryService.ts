/**
 * The discovery engine (discovery-engine/, a separate Python service) finds fashion news stories
 * across hundreds of sites and puts the important ones up for review here.
 *
 * - Stories arrive as aggregated posts in `pending_review`, attributed to one "Centoire Discovery"
 *   source, with the engine's evidence in `post.discovery` (websites, who was first, spread).
 *   While a story is pending, the engine keeps that evidence current.
 * - The engine reads editors' approve/reject decisions back (`listDecisions`) to learn which
 *   stories and which websites are worth surfacing.
 * - Sources: the engine watches every active source with `fetchedBy: "discovery"`, and proposes
 *   new ones (`review: "suggested"`, inactive) that an admin approves or rejects.
 */
import { Post, type IPost, type IPostDiscovery } from "../models/Post.js";
import { Source, type ISource, type SourceKind } from "../models/Source.js";
import { canonicalUrlHash } from "../utils/url-hash.js";
import { slugifyWithId } from "../utils/slugify.js";
import { readTimeMinutes } from "../utils/read-time.js";
import { evaluate as evaluatePolicy } from "./policyService.js";
import { finalizePublish } from "./postService.js";
import { fireAiProcessing } from "./aiService.js";
import { env } from "../config/env.js";

const DISCOVERY_SOURCE_FEED = "discovery://centoire";
const MAX_SPREAD = 25;

export interface StoryCandidateInput {
  storyId: string;
  title: string;
  excerpt?: string;
  externalUrl: string;
  coverImageUrl?: string;
  country?: string;
  publishedAt: string;
  discovery: {
    category?: string;
    websiteCount: number;
    articleCount: number;
    firstPublished?: { name: string; url?: string; at: string };
    engineSawAt?: string;
    spread: Array<{ name: string; url?: string; firstAt: string }>;
    markets: string[];
  };
}

export interface StoryCandidateResult {
  postId: string;
  status: IPost["status"];
  created: boolean;
}

/** The source every engine story is attributed to (created on first use, never fetched). */
export async function ensureDiscoverySource(): Promise<ISource> {
  const existing = await Source.findOne({ feedUrl: DISCOVERY_SOURCE_FEED });
  if (existing) return existing;
  try {
    return await Source.create({
      name: "Centoire Discovery",
      siteUrl: "https://centoire.com",
      feedUrl: DISCOVERY_SOURCE_FEED,
      kind: "discovery",
      fetchedBy: "discovery",
      active: false,
    });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      return (await Source.findOne({ feedUrl: DISCOVERY_SOURCE_FEED }))!;
    }
    throw err;
  }
}

function toDiscovery(input: StoryCandidateInput["discovery"], storyId: string): IPostDiscovery {
  return {
    storyId,
    category: input.category,
    websiteCount: input.websiteCount,
    articleCount: input.articleCount,
    firstPublished: input.firstPublished
      ? { ...input.firstPublished, at: new Date(input.firstPublished.at) }
      : undefined,
    engineSawAt: input.engineSawAt ? new Date(input.engineSawAt) : undefined,
    spread: input.spread.slice(0, MAX_SPREAD).map((s) => ({ ...s, firstAt: new Date(s.firstAt) })),
    markets: input.markets,
    updatedAt: new Date(),
  };
}

/** Create the story's post for review, or refresh the evidence on the one already made. */
export async function upsertStory(input: StoryCandidateInput): Promise<StoryCandidateResult> {
  const discovery = toDiscovery(input.discovery, input.storyId);
  const title = input.title.slice(0, 200);
  const excerpt = (input.excerpt ?? "").slice(0, 300);

  const existing = await Post.findOne({ "discovery.storyId": input.storyId });
  if (existing) {
    existing.discovery = discovery;
    if (existing.status === "pending_review") {
      // Still undecided: the editor should see the story as it is now.
      existing.title = title;
      if (excerpt) {
        existing.excerpt = excerpt;
        existing.contentText = excerpt;
      }
      if (!existing.coverImageUrl && input.coverImageUrl) existing.coverImageUrl = input.coverImageUrl;
      // The engine may pick a better article to link (e.g. an English one) as the story spreads.
      const newHash = canonicalUrlHash(input.externalUrl);
      if (newHash !== existing.canonicalUrlHash && !(await Post.exists({ canonicalUrlHash: newHash }))) {
        existing.externalUrl = input.externalUrl;
        existing.canonicalUrlHash = newHash;
      }
    }
    await existing.save();
    return { postId: existing._id.toString(), status: existing.status, created: false };
  }

  // The app's own RSS importer may already hold the same article; attach the evidence to it.
  const hash = canonicalUrlHash(input.externalUrl);
  const sameArticle = await Post.findOne({ canonicalUrlHash: hash });
  if (sameArticle) {
    if (!sameArticle.discovery) {
      sameArticle.discovery = discovery;
      await sameArticle.save();
      return { postId: sameArticle._id.toString(), status: sameArticle.status, created: false };
    }
    // Two engine stories pointing at one article: keep the first, report it.
    return { postId: sameArticle._id.toString(), status: sameArticle.status, created: false };
  }

  const source = await ensureDiscoverySource();
  const policyOutcome = await evaluatePolicy({ sourceId: source._id.toString(), origin: "aggregated" });
  let post: IPost;
  try {
    post = await Post.create({
      origin: "aggregated",
      status: "pending_review",
      sourceId: source._id,
      title,
      slug: slugifyWithId(title),
      excerpt,
      contentText: excerpt,
      coverImageUrl: input.coverImageUrl,
      externalUrl: input.externalUrl,
      canonicalUrlHash: hash,
      hashtags: [],
      country: input.country && /^[A-Za-z]{2}$/.test(input.country) ? input.country : undefined,
      publishedAt: new Date(input.publishedAt),
      readTimeMinutes: readTimeMinutes(excerpt),
      // No expiresAt: a story an editor approved should stay, unlike bulk-imported feed items.
      discovery,
    });
  } catch (err) {
    if ((err as { code?: number }).code === 11000) {
      // Raced with another request for the same story or article.
      const raced = await Post.findOne({ $or: [{ "discovery.storyId": input.storyId }, { canonicalUrlHash: hash }] });
      if (raced) return { postId: raced._id.toString(), status: raced.status, created: false };
    }
    throw err;
  }

  void fireAiProcessing(post._id.toString(), { origin: "aggregated", url: input.externalUrl });

  if (policyOutcome === "auto_approve" && env.DISCOVERY_AUTO_APPROVE) {
    await finalizePublish(post);
  } else if (policyOutcome === "auto_reject") {
    post.status = "rejected";
    post.reviewedAt = new Date();
    post.rejectionReason = "Rejected by moderation policy";
    await post.save();
  }
  return { postId: post._id.toString(), status: post.status, created: true };
}

export interface StoryDecision {
  storyId: string;
  postId: string;
  status: IPost["status"];
  reviewedAt: string;
  rejectionReason: string | null;
  /** False when a moderation policy or the AI check decided, not an editor. */
  byEditor: boolean;
}

/** Decisions on engine stories made after `since`, oldest first (the engine pages with the last reviewedAt). */
export async function listDecisions(since: Date, limit: number): Promise<StoryDecision[]> {
  const posts = await Post.find({
    "discovery.storyId": { $exists: true },
    reviewedAt: { $gt: since },
    status: { $in: ["published", "rejected", "removed"] },
  })
    .select("discovery.storyId status reviewedAt reviewedBy rejectionReason")
    .sort({ reviewedAt: 1 })
    .limit(limit)
    .lean();
  return posts.map((p) => ({
    storyId: p.discovery!.storyId,
    postId: p._id.toString(),
    status: p.status,
    reviewedAt: p.reviewedAt!.toISOString(),
    rejectionReason: p.rejectionReason ?? null,
    byEditor: Boolean(p.reviewedBy),
  }));
}

export function serializeEngineSource(source: ISource) {
  return {
    id: source._id.toString(),
    name: source.name,
    siteUrl: source.siteUrl,
    feedUrl: source.feedUrl,
    kind: source.kind ?? "rss",
    region: source.region ?? null,
    active: source.active,
    review: source.review ?? null,
  };
}

/** Every source the engine is responsible for, including suggestions (so it never re-suggests one). */
export async function listEngineSources(): Promise<ISource[]> {
  return Source.find({ fetchedBy: "discovery", kind: { $ne: "discovery" } }).sort({ createdAt: 1 });
}

export interface SourceSuggestionInput {
  name: string;
  siteUrl: string;
  feedUrl: string;
  kind: Exclude<SourceKind, "discovery">;
  region?: string;
  reason: string;
  evidence: string[];
  score?: number;
}

/** Propose a source for an admin to approve. Anything already known is left as it is. */
export async function suggestSource(input: SourceSuggestionInput): Promise<{ source: ISource; created: boolean }> {
  const suggestion = {
    reason: input.reason.slice(0, 300),
    evidence: input.evidence.slice(0, 10).map((e) => e.slice(0, 300)),
    score: input.score,
    suggestedAt: new Date(),
  };
  const existing = await Source.findOne({ feedUrl: input.feedUrl });
  if (existing) {
    if (existing.review === "suggested") {
      existing.suggestion = suggestion;
      await existing.save();
    }
    return { source: existing, created: false };
  }
  let host = "";
  try {
    host = new URL(input.siteUrl).hostname;
  } catch {
    // keep the favicon empty for an unparsable site URL
  }
  const source = await Source.create({
    name: input.name.slice(0, 80),
    siteUrl: input.siteUrl,
    feedUrl: input.feedUrl,
    faviconUrl: host ? `https://www.google.com/s2/favicons?domain=${host}&sz=64` : undefined,
    kind: input.kind,
    fetchedBy: "discovery",
    region: input.region,
    active: false,
    review: "suggested",
    suggestion,
  });
  return { source, created: true };
}
