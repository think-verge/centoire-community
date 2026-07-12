import * as cheerio from "cheerio";
import Parser from "rss-parser";
import { Post } from "../models/Post.js";
import { Source, type ISource } from "../models/Source.js";
import { Tag } from "../models/Tag.js";
import { canonicalUrlHash } from "../utils/url-hash.js";
import { slugifyWithId } from "../utils/slugify.js";

const parser = new Parser({
  timeout: 15_000,
  headers: { "User-Agent": "CentoireBot/0.1 (+https://centoire.app)" },
});

const OG_IMAGE_TIMEOUT_MS = 3_000;
const MAX_ITEMS_PER_FETCH = 25;

export interface FetchStats {
  sourceId: string;
  sourceName: string;
  itemsSeen: number;
  imported: number;
  skippedDuplicates: number;
  error?: string;
}

function stripHtml(html: string): string {
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

export async function fetchSource(source: ISource): Promise<FetchStats> {
  const stats: FetchStats = {
    sourceId: source._id.toString(),
    sourceName: source.name,
    itemsSeen: 0,
    imported: 0,
    skippedDuplicates: 0,
  };

  try {
    const feed = await parser.parseURL(source.feedUrl);
    const items = (feed.items ?? []).slice(0, MAX_ITEMS_PER_FETCH);
    stats.itemsSeen = items.length;

    for (const item of items) {
      const link = item.link?.trim();
      const title = item.title?.trim();
      if (!link || !title) continue;

      const hash = canonicalUrlHash(link);
      const exists = await Post.exists({ canonicalUrlHash: hash });
      if (exists) {
        stats.skippedDuplicates += 1;
        continue;
      }

      const rawSummary = item.contentSnippet ?? item.content ?? item.summary ?? "";
      const excerpt = stripHtml(String(rawSummary)).slice(0, 300);
      const enclosureUrl = item.enclosure?.url;
      const coverImageUrl = enclosureUrl ?? (await fetchOgImage(link));
      const publishedAt = item.isoDate ? new Date(item.isoDate) : new Date();

      try {
        await Post.create({
          origin: "aggregated",
          status: "published",
          sourceId: source._id,
          title: title.slice(0, 200),
          slug: slugifyWithId(title),
          excerpt,
          contentText: excerpt,
          coverImageUrl,
          externalUrl: link,
          canonicalUrlHash: hash,
          tags: source.tags,
          publishedAt,
          readTimeMinutes: 3,
        });
        stats.imported += 1;
      } catch (err: unknown) {
        if ((err as { code?: number }).code === 11000) {
          stats.skippedDuplicates += 1; // raced with another fetch
        } else {
          throw err;
        }
      }
    }

    if (stats.imported > 0 && source.tags.length > 0) {
      await Tag.updateMany(
        { _id: { $in: source.tags } },
        { $inc: { postCount: stats.imported } },
      );
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
