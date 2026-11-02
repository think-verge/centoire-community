import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import * as cheerio from "cheerio";
import YAML from "yaml";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIGS_DIR = path.join(__dirname, "configs");

export interface ScraperConfig {
  name: string;
  domain: string;
  is_paid: boolean;
  engine?: "http" | "playwright";
  auth?: {
    type?: "credentials";
    env_user_key?: string;
    env_pass_key?: string;
    login_url?: string;
    username_selector?: string;
    password_selector?: string;
    submit_selector?: string;
    wait_for_selector?: string;
  };
  attribution?: {
    canonical?: boolean;
    show_read_original_link?: boolean;
  };
  selectors: {
    title: string;
    author?: string;
    lead_image?: string;
    body: string;
    remove?: string[];
  };
}

export interface ScrapedArticleResult {
  title: string;
  contentHtml: string;
  contentText: string;
  coverImageUrl?: string;
  isPaywalled: boolean;
  isPaidSource: boolean;
  excerpt: string;
  canonicalUrl: string;
  readTimeMinutes: number;
  sourceName: string;
  engineUsed: "http" | "playwright" | "arc-xp";
}

// In-memory cache of loaded YAML configs
const configCache = new Map<string, ScraperConfig>();
let configsLoaded = false;

function loadAllConfigs(): void {
  if (configsLoaded) return;
  try {
    if (fs.existsSync(CONFIGS_DIR)) {
      const files = fs.readdirSync(CONFIGS_DIR).filter((f) => f.endsWith(".yaml") || f.endsWith(".yml"));
      for (const file of files) {
        if (file === "default.yaml" || file === "default.yml") continue;
        const filePath = path.join(CONFIGS_DIR, file);
        try {
          const parsed = YAML.parse(fs.readFileSync(filePath, "utf-8")) as ScraperConfig;
          if (parsed && parsed.domain) {
            configCache.set(parsed.domain.toLowerCase(), parsed);
          }
        } catch (err) {
          console.warn(`[scraper] Failed to parse config ${file}:`, err);
        }
      }
    }
  } catch (err) {
    console.warn(`[scraper] Failed to read CONFIGS_DIR:`, err);
  }
  configsLoaded = true;
}

export function loadConfigForUrl(url: string): ScraperConfig {
  loadAllConfigs();

  const hostname = (() => {
    try {
      return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
    } catch {
      return "";
    }
  })();

  // 1. Check if any cached config domain matches the hostname
  for (const [domain, config] of configCache.entries()) {
    if (domain !== "*" && (hostname === domain || hostname.endsWith(`.${domain}`) || hostname.includes(domain))) {
      return config;
    }
  }

  // 2. Fallback to default
  const defaultPath = path.join(CONFIGS_DIR, "default.yaml");
  if (fs.existsSync(defaultPath)) {
    try {
      return YAML.parse(fs.readFileSync(defaultPath, "utf-8")) as ScraperConfig;
    } catch {
      // fallback
    }
  }

  return {
    name: "Fallback Default",
    domain: "*",
    is_paid: false,
    engine: "http",
    attribution: {
      canonical: true,
      show_read_original_link: true,
    },
    selectors: {
      title: "h1",
      body: "article, main",
      remove: ["header", "footer", "nav", "aside", ".advertisement"],
    },
  };
}

function calculateReadTime(text: string): number {
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

function buildAttributionHtml(sourceName: string, sourceUrl: string): string {
  const safeName = sourceName.replace(/"/g, "&quot;").replace(/</g, "&lt;");
  const safeUrl = sourceUrl.replace(/"/g, "%22").replace(/</g, "%3C");
  return `\n<div class="article-attribution" style="margin-top: 2rem; padding: 1rem 1.25rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.875rem; color: #475569;">
  <p style="margin: 0 0 0.35rem 0; font-weight: 600; color: #0f172a;">Originally published on ${safeName}</p>
  <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" style="color: #2563eb; text-decoration: underline; font-weight: 500;">
    Read original story on ${safeName} &rarr;
  </a>
</div>`;
}

/**
 * Scrape full article using site-specific YAML rules.
 * Handles Free vs Paid, Playwright-ready specs,
 * dynamic reading time calculation, and Medium/daily.dev canonical attribution.
 */
export async function scrapeArticleWithYaml(
  url: string,
  fallbackCoverImage?: string
): Promise<ScrapedArticleResult | null> {
  const config = loadConfigForUrl(url);
  const headers: Record<string, string> = {
    "User-Agent":
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
    Referer: "https://www.google.com/",
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);

  let rawHtml = "";
  try {
    const res = await fetch(url, { headers, signal: controller.signal });
    if (res.ok) {
      rawHtml = await res.text();
    } else {
      console.warn(`[scraper] fetch returned HTTP ${res.status} for ${url}, trying curl fallback...`);
    }
  } catch (err) {
    console.warn(`[scraper] fetch error for ${url}:`, err);
  } finally {
    clearTimeout(timer);
  }

  // Cloudflare TLS fallback: if fetch failed or returned 403, use curl.exe
  if (!rawHtml || rawHtml.length < 500) {
    try {
      const { execFile } = await import("child_process");
      const { promisify } = await import("util");
      const execFileAsync = promisify(execFile);

      const args: string[] = ["-s", "-L"];
      for (const [k, v] of Object.entries(headers)) {
        args.push("-H", `${k}: ${v}`);
      }
      args.push(url);

      const curlCmd = process.platform === "win32" ? "curl.exe" : "curl";
      const { stdout } = await execFileAsync(curlCmd, args, { maxBuffer: 10 * 1024 * 1024 });
      if (stdout && stdout.length > 500) {
        rawHtml = stdout;
        console.log(`[scraper] curl fallback succeeded for ${url} (${rawHtml.length} bytes)`);
      }
    } catch (curlErr) {
      console.error(`[scraper] curl fallback failed:`, curlErr);
    }
  }

  if (!rawHtml || rawHtml.length < 500) {
    console.error(`[scraper] Could not obtain article HTML for ${url}`);
    return null;
  }

  const $ = cheerio.load(rawHtml);

  // Extract Title
  const title =
    $(config.selectors.title).first().text().trim() ||
    $('meta[property="og:title"]').attr("content") ||
    "";

  // Extract Cover / Lead Image
  let coverImageUrl = fallbackCoverImage;
  if (!coverImageUrl && config.selectors.lead_image) {
    coverImageUrl =
      $(config.selectors.lead_image).first().attr("src") ||
      $('meta[property="og:image"]').attr("content") ||
      undefined;
  }

  // 1. Arc XP / Fusion globalContent extraction (e.g. Business of Fashion)
  const fusionScript = $("script#fusion-metadata").html() || "";
  const fusionMatch = fusionScript.match(/Fusion\.globalContent\s*=\s*(\{.*?\});\s*Fusion\./s);
  if (fusionMatch && fusionMatch[1]) {
    try {
      const data = JSON.parse(fusionMatch[1]);
      if (data.content_elements && Array.isArray(data.content_elements) && data.content_elements.length > 0) {
        const extractedCover = data.promo_items?.basic?.url || coverImageUrl;
        const coverBasename = extractedCover ? path.basename(extractedCover.split("?")[0] || "") : "";
        let fullHtml = "";
        let fullText = "";

        for (const el of data.content_elements) {
          if (el.type === "text" && el.content) {
            fullHtml += `<p>${el.content}</p>\n`;
            fullText += el.content + " ";
          } else if (el.type === "header" && el.content) {
            fullHtml += `<h3>${el.content}</h3>\n`;
            fullText += el.content + " ";
          } else if (el.type === "quote" && el.content) {
            fullHtml += `<blockquote>${el.content}</blockquote>\n`;
            fullText += el.content + " ";
          } else if (el.type === "image" && (el.url || el.additional_properties?.originalUrl)) {
            const imgUrl = el.url || el.additional_properties?.originalUrl;
            const isCover =
              coverBasename && imgUrl && (imgUrl === extractedCover || imgUrl.includes(coverBasename));
            if (!isCover) {
              const captionHtml = el.caption
                ? `<figcaption style="font-size: 0.85rem; color: #71717a; margin-top: 0.5rem; line-height: 1.4;">${el.caption}</figcaption>`
                : "";
              fullHtml += `<figure style="margin: 2rem 0;">\n  <img src="${imgUrl}" alt="${el.caption || "Article image"}" style="width: 100%; border-radius: 8px; object-fit: cover;" />\n  ${captionHtml}\n</figure>\n`;
            }
          }
        }

        if (fullText.trim().length > 300) {
          const extractedTitle = data.headlines?.basic || title;
          const extractedExcerpt =
            data.subheadlines?.basic || data.description?.basic || fullText.trim().slice(0, 300);

          // Append Medium/daily.dev style attribution banner if configured
          if (config.attribution?.show_read_original_link !== false) {
            fullHtml += buildAttributionHtml(config.name, url);
          }

          const readTime = calculateReadTime(fullText);

          console.log(
            `[scraper] Arc XP / Fusion extraction succeeded for ${url} (${fullText.trim().length} chars, ${readTime} min read)`
          );

          return {
            title: extractedTitle,
            contentHtml: fullHtml,
            contentText: fullText.trim(),
            coverImageUrl: extractedCover,
            isPaywalled: false,
            isPaidSource: config.is_paid,
            excerpt: extractedExcerpt.slice(0, 300),
            canonicalUrl: url,
            readTimeMinutes: readTime,
            sourceName: config.name,
            engineUsed: "arc-xp",
          };
        }
      }
    } catch (err) {
      console.warn(`[scraper] failed parsing Fusion JSON, falling back to DOM selectors:`, err);
    }
  }

  // Detect Paywall Indicators
  const isPaywalled =
    rawHtml.includes("Subscribe to continue reading") ||
    rawHtml.includes("To continue reading, subscribe") ||
    rawHtml.includes("paywall-content") ||
    $(".paywall, [class*='paywall']").length > 0;

  // Extract Body Container using configured selectors
  let $body: ReturnType<typeof $> | null = null;
  const bodySelectors = config.selectors.body.split(",");
  for (const sel of bodySelectors) {
    const found = $(sel.trim());
    if (found.length > 0) {
      $body = found.first();
      break;
    }
  }

  if (!$body || $body.length === 0) {
    $body = $("article").length > 0 ? $("article").first() : $("main").first();
  }

  if (!$body || $body.length === 0) {
    console.warn(`[scraper] no matching body found for ${url}`);
    return null;
  }

  // Remove unwanted elements specified in YAML
  if (config.selectors.remove && config.selectors.remove.length > 0) {
    for (const removeSel of config.selectors.remove) {
      $body.find(removeSel).remove();
    }
  }

  // SOLVE DUPLICATE IMAGE ISSUE:
  // If the article body has a lead image that matches coverImageUrl, remove it from the body!
  if (coverImageUrl) {
    const coverBasename = path.basename(coverImageUrl.split("?")[0] || "");
    $body.find("img").each((_, el) => {
      const src = $(el).attr("src") || "";
      if (src === coverImageUrl || (coverBasename && src.includes(coverBasename))) {
        $(el).remove();
      }
    });

    // Also remove the very first image if it is inside a lead figure/header container
    $body.find("figure:first-child, .lead-image, div[class*='hero']").first().find("img").remove();
  }

  let contentHtml = $body.html()?.trim() || "";
  const contentText = $body.text().replace(/\s+/g, " ").trim();
  const excerpt = contentText.slice(0, 300);

  // Append Medium/daily.dev style attribution banner if configured
  if (config.attribution?.show_read_original_link !== false) {
    contentHtml += buildAttributionHtml(config.name, url);
  }

  const readTime = calculateReadTime(contentText);

  return {
    title,
    contentHtml,
    contentText,
    coverImageUrl,
    isPaywalled,
    isPaidSource: config.is_paid,
    excerpt,
    canonicalUrl: url,
    readTimeMinutes: readTime,
    sourceName: config.name,
    engineUsed: config.engine === "playwright" ? "playwright" : "http",
  };
}
