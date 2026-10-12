import * as cheerio from "cheerio";
import Parser from "rss-parser";
import { extract } from "@extractus/article-extractor";
import { Post } from "../models/Post.js";
import { Source, type ISource } from "../models/Source.js";
import { canonicalUrlHash } from "../utils/url-hash.js";
import { readTimeMinutes } from "../utils/read-time.js";
import { upsertAggregatedPost } from "./aggregatedPostService.js";

const parser = new Parser({
  timeout: 15_000,
  headers: { "User-Agent": "CentoireBot/0.1 (+https://centoire.app)" },
  customFields: {
    item: [["content:encoded", "content:encoded"]],
  },
});

// Many real-world RSS feeds contain bare & instead of &amp; which breaks the XML parser.
// Fetch the raw text ourselves, sanitize it, then parse from the string.
async function fetchFeedXml(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "CentoireBot/0.1 (+https://centoire.app)" },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    // Replace bare & not already part of a valid XML entity/char reference
    return text.replace(/&(?!(?:#\d+|#x[\da-fA-F]+|[\w.-]+);)/g, "&amp;");
  } finally {
    clearTimeout(timer);
  }
}

const OG_IMAGE_TIMEOUT_MS = 3_000;
const MAX_ITEMS_PER_FETCH = 25;

const ARTICLE_EXTRACT_TIMEOUT_MS = 10_000;

export async function extractArticleHtml(url: string): Promise<string | null> {
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), ARTICLE_EXTRACT_TIMEOUT_MS);
    try {
      const fetcher = (u: string) => fetch(u, { signal: ac.signal });
      const article = await extract(url, {}, fetcher);
      return (article as { content?: string } | null)?.content ?? null;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

export interface FetchStats {
  sourceId: string;
  sourceName: string;
  itemsSeen: number;
  imported: number;
  skippedDuplicates: number;
  error?: string;
}

export function stripHtml(html: string): string {
  return cheerio.load(html).text().replace(/\s+/g, " ").trim();
}

async function fetchOgImage(pageUrl: string): Promise<string | undefined> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), OG_IMAGE_TIMEOUT_MS);
    const res = await fetch(pageUrl, {
      signal: controller.signal,
      headers: { "User-Agent": "CentoireBot/0.1 (+https://centoire.app)" },
    });
    clearTimeout(timer);
    if (!res.ok) return undefined;
    const html = await res.text();
    const $ = cheerio.load(html);
    return (
      $('meta[property="og:image"]').attr("content") ??
      $('meta[name="twitter:image"]').attr("content") ??
      undefined
    );
  } catch {
    return undefined;
  }
}

/**
 * Legacy in-process RSS fetch (INGESTION_MODE=rss). The external scraper-agent replaces this; it is
 * kept so the cut-over can be rolled back. Post creation goes through the shared upsertAggregatedPost.
 */
export async function fetchSource(source: ISource): Promise<FetchStats> {
  const stats: FetchStats = {
    sourceId: source._id.toString(),
    sourceName: source.name,
    itemsSeen: 0,
    imported: 0,
    skippedDuplicates: 0,
  };

  try {
    if (!source.feedUrl) throw new Error("Source has no feedUrl for RSS ingestion");
    const feedXml = await fetchFeedXml(source.feedUrl);
    const feed = await parser.parseString(feedXml);
    const items = (feed.items ?? []).slice(0, MAX_ITEMS_PER_FETCH);
    stats.itemsSeen = items.length;

    for (const item of items) {
      const link = item.link?.trim();
      const title = item.title?.trim();
      if (!link || !title) continue;

      if (await Post.exists({ canonicalUrlHash: canonicalUrlHash(link) })) {
        stats.skippedDuplicates += 1;
        continue;
      }

      // Priority 1: use RSS body (content:encoded or content) if substantial (>500 chars)
      const rssBodyRaw = ((item as unknown as Record<string, unknown>)["content:encoded"] as string | undefined) ?? item.content ?? "";
      const rssBodyStripped = stripHtml(String(rssBodyRaw));
      const hasRssBody = rssBodyStripped.length > 500;
      const rawSummary = item.contentSnippet ?? item.content ?? item.summary ?? "";
      const excerpt = stripHtml(String(rawSummary)).slice(0, 300);
      const coverImageUrl = item.enclosure?.url ?? (await fetchOgImage(link));

      const { outcome, post } = await upsertAggregatedPost(
        { ...source.toObject(), spec: { store: "full" } },
        {
          url: link,
          title,
          excerpt,
          contentHtml: hasRssBody ? String(rssBodyRaw) : undefined,
          contentText: hasRssBody ? rssBodyStripped : excerpt,
          coverImageUrl,
          publishedAt: item.isoDate ? new Date(item.isoDate) : new Date(),
        },
      );
      if (outcome === "duplicate") {
        stats.skippedDuplicates += 1;
        continue;
      }
      if (post.status !== "rejected") stats.imported += 1;

      // Priority 2: fire-and-forget URL extraction when the RSS body was insufficient
      if (!hasRssBody) {
        void extractArticleHtml(link).then((contentHtml) => {
          if (contentHtml) {
            const text = stripHtml(contentHtml);
            Post.updateOne(
              { _id: post._id },
              { $set: { contentHtml, contentText: text, readTimeMinutes: readTimeMinutes(text) } },
            ).catch(() => {});
          }
        });
      }
    }

    source.lastFetchedAt = new Date();
    source.lastStatus = "ok";
    source.lastError = undefined;
    await source.save();
  } catch (err) {
    stats.error = (err as Error).message;
    source.lastFetchedAt = new Date();
    source.lastStatus = "error";
    source.lastError = stats.error.slice(0, 500);
    await source.save();
  }

  return stats;
}

export async function fetchAllActiveSources(): Promise<FetchStats[]> {
  const sources = await Source.find({ active: true });
  const results: FetchStats[] = [];
  for (const source of sources) {
    const stats = await fetchSource(source);
    results.push(stats);
    console.log(
      `[ingestion] ${stats.sourceName}: ${stats.imported} imported, ${stats.skippedDuplicates} duplicates${stats.error ? `, error: ${stats.error}` : ""}`,
    );
  }
  return results;
}
