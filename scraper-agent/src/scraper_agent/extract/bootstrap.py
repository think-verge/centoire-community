"""Writing a spec without a browser or an LLM when the site already offers what we need (an RSS/Atom feed)."""

from __future__ import annotations

import re
from typing import Any
from urllib.parse import urljoin

from parsel import Selector

from ..spec.models import ArticleSpec, ListingSpec, Policy, SourceSpec, Verify
from ..util import slugify
from .clean import html_to_text, sanitize_html
from .fetcher import Fetcher, FetchError
from .replay import parse_feed

FEED_TYPES = {"application/rss+xml", "application/atom+xml", "application/feed+json", "text/xml", "application/xml"}
MIN_BODY_CHARS = 500


def discover_feed_url(html: str, base_url: str) -> str | None:
    sel = Selector(text=html)
    for link in sel.css('link[rel="alternate"]'):
        if (link.attrib.get("type") or "").lower() in FEED_TYPES and link.attrib.get("href"):
            return urljoin(base_url, link.attrib["href"])
    return None


def body_coverage(xml: str, base_url: str) -> tuple[int, int]:
    """(entries, entries whose feed body already holds at least MIN_BODY_CHARS of text)."""
    items = parse_feed(xml, base_url)
    full = sum(1 for i in items if i.body_html and len(html_to_text(sanitize_html(i.body_html, i.url))) >= MIN_BODY_CHARS)
    return len(items), full


async def bootstrap_rss_spec(source: dict[str, Any], fetcher: Fetcher) -> SourceSpec | None:
    """Builds an RSS spec for `source`, trying its feedUrl and then feed autodiscovery on its site. None if no feed works."""
    candidates: list[str] = []
    if source.get("feedUrl"):
        candidates.append(source["feedUrl"])
    try:
        home = await fetcher.get(source["siteUrl"])
        found = discover_feed_url(home.html, home.final_url)
        if found and found not in candidates:
            candidates.append(found)
    except FetchError:
        pass

    for url in candidates:
        try:
            page = await fetcher.get(url)
        except FetchError:
            continue
        total, with_body = body_coverage(page.html, page.final_url)
        if total == 0:
            continue
        # A feed that carries full text can be kept in full; teaser-only feeds stay excerpt-only.
        store = "full" if with_body / total >= 0.5 else "excerpt"
        return SourceSpec(
            source=slugify(source["name"]),
            source_id=source["id"],
            site=source["siteUrl"],
            policy=Policy(store=store),
            listing=ListingSpec(strategy="rss", urls=[page.final_url]),
            article=ArticleSpec(),
            verify=Verify(sample_urls=[i.url for i in parse_feed(page.html, page.final_url)[:3]], min_body_chars=MIN_BODY_CHARS),
        )
    return None


def looks_like_feed(text: str) -> bool:
    return bool(re.search(r"<(rss|feed|rdf:RDF)\b", text[:2000], re.IGNORECASE))
