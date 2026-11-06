"""Brand websites: a new page on a brand's sitemap or newsroom is an early, official signal.

Neither has a feed, so we diff. Every URL a source has ever listed is remembered
(Store.site_urls); only URLs that were never listed before become items. The first
listing just seeds that memory: those pages existed before we started watching.
"""
from __future__ import annotations

import asyncio
import html
import logging
import re
from typing import Protocol
from urllib.parse import unquote, urljoin, urlsplit

import httpx

from app.fetchers import _clean, _get, _parse_iso
from app.models import FetchedItem, Source

log = logging.getLogger("discovery.sites")

# At most this many items per poll; the rest of a big batch (a whole new Supreme
# season preview, say) is still remembered and counted in extra.batch_total.
MAX_NEW_PER_POLL = 50
# New pages opened per poll to read their real title, image and publish time.
MAX_ENRICH_PER_POLL = 15
# A listing where most URLs are suddenly "new" is a site redesign, not news.
RESEED_MIN_NEW = 100
RESEED_SHARE = 0.5

_LOC_RE = re.compile(r"<loc>\s*(.*?)\s*</loc>", re.S | re.I)
_A_RE = re.compile(r"""<a\b[^>]*?\bhref\s*=\s*["']([^"'#]+)["'][^>]*>(.*?)</a>""", re.S | re.I)
_TITLE_RE = re.compile(r"<title[^>]*>(.*?)</title>", re.S | re.I)
_TITLE_SEPARATORS = (" | ", " – ", " — ")


class SiteURLStore(Protocol):
    async def site_urls(self, source_id: str) -> set[str]: ...
    async def add_site_urls(self, source_id: str, urls: list[str]) -> None: ...


def sitemap_urls(body: str) -> dict[str, str]:
    """<loc> entries of a sitemap, mapped to an (empty) title hint."""
    return {html.unescape(u): "" for u in _LOC_RE.findall(body)}


def page_links(base_url: str, body: str) -> dict[str, str]:
    """Absolute link URLs on an HTML page, mapped to their longest anchor text."""
    links: dict[str, str] = {}
    for href, inner in _A_RE.findall(body):
        url = urljoin(base_url, html.unescape(href.strip()))
        text = _clean(inner, 200)
        if len(text) > len(links.get(url, "")):
            links[url] = text
        else:
            links.setdefault(url, "")
    return links


def title_from_url(url: str) -> str:
    """'…/launch/t/air-max-1-fv5029-100' -> 'Air Max 1 FV5029 100'. Supreme's
    preview URLs keep the product slug in a bare query ('…/all/30?=work-pant')."""
    parts = urlsplit(url)
    slug = parts.query[1:] if parts.query.startswith("=") else parts.path.rstrip("/").rsplit("/", 1)[-1]
    words = [w for w in re.split(r"[-_+\s]+", unquote(slug)) if w]
    return " ".join(
        w.upper() if re.search(r"\d", w) and re.search(r"[a-z]", w) else w.capitalize() for w in words
    )


def _meta(body: str, name: str) -> str | None:
    for pattern in (
        rf"""<meta[^>]+(?:property|name)=["']{name}["'][^>]+content=["']([^"']*)["']""",
        rf"""<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']{name}["']""",
    ):
        if m := re.search(pattern, body, re.I):
            return html.unescape(m.group(1)).strip() or None
    return None


def page_meta(body: str) -> dict:
    """Title, description, image and publish time from a page's meta tags."""
    title = _meta(body, "og:title")
    if not title and (m := _TITLE_RE.search(body)):
        title = _clean(m.group(1), 300)
        # "Supreme®/Spyder® – News – Supreme" -> "Supreme®/Spyder®"
        for sep in _TITLE_SEPARATORS:
            if sep in title:
                title = title.split(sep, 1)[0].strip()
                break
    return {
        "title": title,
        "summary": _clean(_meta(body, "og:description") or _meta(body, "description")),
        "image_url": _meta(body, "og:image"),
        "published_at": _parse_iso(_meta(body, "article:published_time")),
    }


class SiteWatcher:
    def __init__(self, store: SiteURLStore) -> None:
        self.store = store
        self._seen: dict[str, set[str]] = {}
        self._patterns: dict[str, list[re.Pattern]] = {}

    async def _listing(self, client: httpx.AsyncClient, source: Source, cache: dict) -> dict[str, str]:
        resp = await _get(client, source.url, cache)
        if source.type == "sitemap":
            links = sitemap_urls(resp.text)
        else:
            links = page_links(str(resp.url), resp.text)
        if source.id not in self._patterns:
            self._patterns[source.id] = [re.compile(p, re.I) for p in source.include_url]
        patterns = self._patterns[source.id]
        links = {u: t for u, t in links.items() if not patterns or any(p.search(u) for p in patterns)}
        if not links:
            # A listing that used to work and now matches nothing means the site changed or blocked us.
            cache.clear()
            raise ValueError("no URLs matched include_url; site layout changed or request blocked")
        return links

    async def fetch(self, client: httpx.AsyncClient, source: Source, cache: dict) -> list[FetchedItem]:
        listed = await self._listing(client, source, cache)
        if source.id not in self._seen:
            self._seen[source.id] = await self.store.site_urls(source.id)
        seen = self._seen[source.id]
        fresh = [u for u in listed if u not in seen]
        first = not seen
        if fresh:
            await self.store.add_site_urls(source.id, fresh)
            seen.update(fresh)
        if first:
            log.info("%-24s seeded %d existing URLs", source.id, len(fresh))
            return []
        if len(fresh) >= RESEED_MIN_NEW and len(fresh) > RESEED_SHARE * len(listed):
            log.warning("%s: %d of %d URLs are new; treating as a site redesign, not news",
                        source.id, len(fresh), len(listed))
            return []
        batch = fresh[:MAX_NEW_PER_POLL]
        enrich = set(batch[:MAX_ENRICH_PER_POLL]) if source.enrich else set()
        sem = asyncio.Semaphore(4)

        async def build(url: str) -> FetchedItem:
            meta = {}
            if url in enrich:
                async with sem:
                    meta = await self._page_meta(client, url)
            title = meta.get("title")
            if not title or title.strip().lower() == source.name.lower():
                title = listed[url] or title_from_url(url)
            elif urlsplit(url).query.startswith("="):
                # Supreme preview items share their season's page title; the slug names the product.
                title = f"{title_from_url(url)} — {title}"
            extra = {"via": source.type, "listing": source.url}
            if len(fresh) > len(batch):
                extra["batch_total"] = len(fresh)
            return FetchedItem(
                url=url, title=title, summary=meta.get("summary") or "",
                image_url=meta.get("image_url"), published_at=meta.get("published_at"),
                publisher=source.name, extra=extra,
            )

        return list(await asyncio.gather(*(build(u) for u in batch)))

    @staticmethod
    async def _page_meta(client: httpx.AsyncClient, url: str) -> dict:
        try:
            resp = await client.get(url)
            resp.raise_for_status()
            return page_meta(resp.text)
        except Exception as exc:  # the URL alone still makes a usable item
            log.debug("could not open %s: %s", url, exc)
            return {}
