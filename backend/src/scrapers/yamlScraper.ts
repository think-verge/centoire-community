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
  auth?: {
    type?: "cookie" | "credentials";
    env_cookie_key?: string;
    env_user_key?: string;
    env_pass_key?: string;
    login_url?: string;
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
}

// In-memory cache of loaded YAML configs
const configCache = new Map<string, ScraperConfig>();

export function loadConfigForUrl(url: string): ScraperConfig {
  const hostname = (() => {
    try {
      return new URL(url).hostname.replace(/^www\./, "");
    } catch {
      return "";
    }
  })();

  if (hostname.includes("businessoffashion.com")) {
    const cached = configCache.get("bof");
    if (cached) return cached;
    const filePath = path.join(CONFIGS_DIR, "bof.yaml");
    if (fs.existsSync(filePath)) {
      const parsed = YAML.parse(fs.readFileSync(filePath, "utf-8")) as ScraperConfig;
      configCache.set("bof", parsed);
      return parsed;
    }
  }

  // Fallback to default
  const defaultPath = path.join(CONFIGS_DIR, "default.yaml");
  if (fs.existsSync(defaultPath)) {
    return YAML.parse(fs.readFileSync(defaultPath, "utf-8")) as ScraperConfig;
  }

  return {
    name: "Fallback Default",
    domain: "*",
    is_paid: false,
    selectors: {
      title: "h1",
      body: "article, main",
      remove: ["header", "footer", "nav", "aside", ".advertisement"],
    },
  };
}

/**
 * Scrape full article using site-specific YAML rules.
 * Handles Free vs Paid, authenticated cookies from .env, and strips duplicate images.
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

  // Paid credentials / cookie injection (PCL)
  if (config.is_paid && config.auth?.env_cookie_key) {
    const cookieVal = process.env[config.auth.env_cookie_key];
    if (cookieVal) {
      headers["Cookie"] = cookieVal.trim();
      console.log(`[scraper] attached paid auth cookie for ${config.name}`);
    } else {
      console.warn(
        `[scraper] ${config.name} is a paid source, but ${config.auth.env_cookie_key} is not set in .env.`
      );
    }
  }

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
  const title = $(config.selectors.title).first().text().trim() ||
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

          console.log(
            `[scraper] Arc XP / Fusion extraction succeeded for ${url} (${fullText.trim().length} chars)`
          );

          return {
            title: extractedTitle,
            contentHtml: fullHtml,
            contentText: fullText.trim(),
            coverImageUrl: extractedCover,
            isPaywalled: false,
            isPaidSource: config.is_paid,
            excerpt: extractedExcerpt.slice(0, 300),
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

  const contentHtml = $body.html()?.trim() || "";
  const contentText = $body.text().replace(/\s+/g, " ").trim();
  const excerpt = contentText.slice(0, 300);

  return {
    title,
    contentHtml,
    contentText,
    coverImageUrl,
    isPaywalled,
    isPaidSource: config.is_paid,
    excerpt,
  };
}
