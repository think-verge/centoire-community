"""Fetchers: turn one watchlist source into a list of FetchedItems.

Each fetcher takes an httpx client plus a small per-source HTTP cache (ETag /
Last-Modified) so unchanged feeds cost a 304 instead of a full download.
"""
from __future__ import annotations

import calendar
import html
import re
from datetime import datetime, timezone
from typing import Any
from urllib.parse import urlsplit

import feedparser
import httpx

from app.citations import extract_citations
from app.models import FetchedItem, Source

_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE = re.compile(r"\s+")


class NotModified(Exception):
    """The source answered 304; nothing new since the last poll."""


def _clean(text: str | None, limit: int = 400) -> str:
    text = html.unescape(_TAG_RE.sub(" ", text or ""))
    return _WS_RE.sub(" ", text).strip()[:limit]


def _struct_to_dt(value: Any) -> datetime | None:
    if not value:
        return None
    return datetime.fromtimestamp(calendar.timegm(value), tz=timezone.utc)


def _parse_iso(value: str | None) -> datetime | None:
    if not value:
        return None
    try:
        return datetime.fromisoformat(value).astimezone(timezone.utc)
    except ValueError:
        return None


async def _get(client: httpx.AsyncClient, url: str, cache: dict[str, str]) -> httpx.Response:
    headers = {}
    if etag := cache.get("etag"):
        headers["If-None-Match"] = etag
    if modified := cache.get("last_modified"):
        headers["If-Modified-Since"] = modified
    resp = await client.get(url, headers=headers)
    if resp.status_code == 304:
        raise NotModified()
    resp.raise_for_status()
    cache.clear()
    if etag := resp.headers.get("etag"):
        cache["etag"] = etag
    if modified := resp.headers.get("last-modified"):
        cache["last_modified"] = modified
    return resp


def _entry_image(entry: Any) -> str | None:
    for key in ("media_thumbnail", "media_content"):
        media = entry.get(key) or []
        if media and media[0].get("url"):
            return media[0]["url"]
    for link in entry.get("links", []):
        if link.get("rel") == "enclosure" and str(link.get("type", "")).startswith("image"):
            return link.get("href")
    return None


def parse_feed(body: bytes) -> list[FetchedItem]:
    """Parse RSS or Atom (including Google News and Reddit feeds)."""
    feed = feedparser.parse(body)
    items: list[FetchedItem] = []
    for entry in feed.entries:
        url = entry.get("link")
        title = _clean(entry.get("title"), 300)
        if not url or not title:
            continue
        publisher = (entry.get("source") or {}).get("title")
        # Google News appends " - Publisher" to every title.
        if publisher and title.endswith(f" - {publisher}"):
            title = title[: -len(publisher) - 3].rstrip()
        published = _struct_to_dt(entry.get("published_parsed") or entry.get("updated_parsed"))
        extra = {}
        if author := entry.get("author"):
            extra["author"] = author
        tags = entry.get("tags") or []
        if tags and tags[0].get("term"):
            extra["tag"] = tags[0]["term"]  # subreddit name on Reddit feeds
        # Who the article credits as the story's origin (see app.origins).
        body = (entry.get("content") or [{}])[0].get("value") or entry.get("summary") or ""
        if body:
            extra["citations"] = extract_citations(body, url, urlsplit(url).netloc)
        items.append(
            FetchedItem(
                url=url,
                title=title,
                summary=_clean(entry.get("summary")),
                image_url=_entry_image(entry),
                published_at=published,
                publisher=publisher,
                extra=extra,
            )
        )
    return items


def parse_shopify_products(store_url: str, payload: dict) -> list[FetchedItem]:
    """A Shopify /products.json page -> one item per product listing."""
    base = store_url.rstrip("/")
    items: list[FetchedItem] = []
    for product in payload.get("products", []):
        handle, title = product.get("handle"), product.get("title")
        if not handle or not title:
            continue
        vendor = (product.get("vendor") or "").strip()
        images = product.get("images") or []
        prices = [float(v["price"]) for v in product.get("variants", []) if v.get("price")]
        items.append(
            FetchedItem(
                url=f"{base}/products/{handle}",
                title=f"{vendor} — {title}" if vendor and vendor.lower() not in title.lower() else title,
                summary=_clean(product.get("body_html"), 300),
                image_url=images[0].get("src") if images else None,
                published_at=_parse_iso(product.get("published_at")),
                extra={
                    "vendor": vendor,
                    "product_type": product.get("product_type"),
                    "tags": product.get("tags", [])[:15],
                    "min_price": min(prices) if prices else None,
                },
            )
        )
    return items


async def fetch(client: httpx.AsyncClient, source: Source, cache: dict[str, str]) -> list[FetchedItem]:
    if source.type in ("rss", "reddit"):
        resp = await _get(client, source.url, cache)
        return parse_feed(resp.content)
    if source.type == "shopify":
        url = f"{source.url.rstrip('/')}/products.json?limit=50"
        resp = await _get(client, url, cache)
        return parse_shopify_products(source.url, resp.json())
    raise ValueError(f"unknown source type {source.type!r}")
