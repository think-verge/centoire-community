"""Executes a SourceSpec: list the source, extract each article. Deterministic: no LLM involved."""

from __future__ import annotations

import calendar
from dataclasses import dataclass, field
from datetime import UTC, datetime
from urllib.parse import urljoin

import feedparser
from parsel import Selector

from ..spec.models import SourceSpec
from .clean import html_to_text, make_excerpt, sanitize_html
from .fetcher import Fetcher, FetchError
from .fields import extract_body, extract_field, parse_date, select


class ReplayError(Exception):
    """The spec no longer matches the site, or access was lost. `code` is a backend error code."""

    def __init__(self, message: str, code: str):
        super().__init__(message)
        self.code = code


@dataclass
class ListingItem:
    url: str
    title: str | None = None
    published_at: datetime | None = None
    body_html: str = ""  # RSS content:encoded, when the feed carries the article
    summary: str = ""
    cover_image_url: str | None = None


@dataclass
class Candidate:
    url: str
    title: str
    excerpt: str
    content_html: str = ""
    content_text: str = ""
    cover_image_url: str | None = None
    published_at: datetime | None = None
    author: str | None = None
    extras: dict[str, str] = field(default_factory=dict)

    def to_payload(self, *, keep_body: bool, spec_hash: str | None) -> dict:
        payload: dict = {"url": self.url, "title": self.title[:300], "excerpt": self.excerpt}
        if keep_body and self.content_text:
            payload["contentText"] = self.content_text[:300_000]
            payload["contentHtml"] = self.content_html[:600_000]
        if self.cover_image_url:
            payload["coverImageUrl"] = self.cover_image_url
        if self.published_at:
            payload["publishedAt"] = self.published_at.isoformat()
        if spec_hash:
            payload["specHash"] = spec_hash
        return payload


# ── listing ───────────────────────────────────────────────────────────────────────


def _entry_time(entry) -> datetime | None:
    stamp = entry.get("published_parsed") or entry.get("updated_parsed")
    return datetime.fromtimestamp(calendar.timegm(stamp), tz=UTC) if stamp else None


def parse_feed(xml: str, base_url: str) -> list[ListingItem]:
    feed = feedparser.parse(xml)
    items: list[ListingItem] = []
    for entry in feed.entries:
        link = (entry.get("link") or "").strip()
        if not link:
            continue
        content = entry.get("content") or []
        body = content[0].get("value", "") if content else ""
        cover = None
        for media in entry.get("media_content", []) or []:
            if media.get("url"):
                cover = media["url"]
                break
        if not cover:
            for enc in entry.get("enclosures", []) or []:
                if (enc.get("type") or "").startswith("image") and enc.get("href"):
                    cover = enc["href"]
                    break
        items.append(
            ListingItem(
                url=urljoin(base_url, link),
                title=(entry.get("title") or "").strip() or None,
                published_at=_entry_time(entry),
                body_html=body,
                summary=entry.get("summary", "") or "",
                cover_image_url=cover,
            )
        )
    return items


def parse_html_listing(html: str, page_url: str, spec: SourceSpec) -> list[ListingItem]:
    listing = spec.listing
    sel = Selector(text=html)
    nodes = select(sel, listing.item_selector or "")
    items: list[ListingItem] = []
    for node in nodes:
        link = extract_field(node, listing.link, page_url)
        if not link:
            continue
        items.append(ListingItem(url=urljoin(page_url, link), title=extract_field(node, listing.title)))
    return items


async def list_items(spec: SourceSpec, fetcher: Fetcher) -> list[ListingItem]:
    """All listing items (deduplicated, capped at policy.max_items). Raises ReplayError if the layout is gone."""
    listing = spec.listing
    seen: set[str] = set()
    items: list[ListingItem] = []

    for start_url in listing.urls:
        url: str | None = start_url
        pages = 0
        max_pages = listing.pagination.max_pages if listing.pagination else 1
        while url and pages < max_pages and len(items) < spec.policy.max_items:
            page = await fetcher.get(url)
            batch = parse_feed(page.html, page.final_url) if listing.strategy == "rss" else parse_html_listing(page.html, page.final_url, spec)
            if not batch and pages == 0:
                kind = "feed entries" if listing.strategy == "rss" else f"items matching {listing.item_selector!r}"
                raise ReplayError(f"No {kind} found at {url}", code="layout_changed")
            for item in batch:
                if item.url not in seen:
                    seen.add(item.url)
                    items.append(item)
            pages += 1
            url = None
            if listing.pagination:
                nxt = extract_field(Selector(text=page.html), _single(listing.pagination.next_selector), page.final_url)
                url = urljoin(page.final_url, nxt) if nxt else None
    return items[: spec.policy.max_items]


def _single(selector: str):
    from ..spec.models import FieldRule

    return FieldRule(selectors=[selector])


# ── article ───────────────────────────────────────────────────────────────────────


def _body_from_feed(item: ListingItem) -> tuple[str, str]:
    html = sanitize_html(item.body_html, item.url) if item.body_html else ""
    return html, html_to_text(html)


async def extract_article(spec: SourceSpec, fetcher: Fetcher, item: ListingItem) -> Candidate:
    """Builds a Candidate for one listing item, fetching the article page when the spec describes one."""
    article = spec.article
    title = item.title
    published = item.published_at
    author = None
    cover = item.cover_image_url
    html, text = _body_from_feed(item)

    needs_page = article.body is not None and len(text) < spec.verify.min_body_chars
    if needs_page:
        page = await fetcher.get(item.url)
        sel = Selector(text=page.html)
        page_text = html_to_text(page.html) if article.paywall_markers else ""
        if any(marker.lower() in page_text.lower() for marker in article.paywall_markers):
            # The paywall teaser is showing: with a login configured that means the session was lost.
            raise ReplayError(f"Paywall marker found on {item.url}", code="login_expired" if spec.auth.required else "blocked")
        body_html, body_text = extract_body(sel, article.body, page.final_url)
        if len(body_text) > len(text):
            html, text = body_html, body_text
        title = extract_field(sel, article.title) or title
        author = extract_field(sel, article.author)
        published = parse_date(extract_field(sel, article.published_at), article.published_at.format if article.published_at else None) or published
        cover = extract_field(sel, article.cover_image, page.final_url) or cover

    if not title:
        raise ReplayError(f"No title for {item.url}", code="layout_changed")
    summary_text = html_to_text(sanitize_html(item.summary, item.url)) if item.summary else ""
    excerpt = make_excerpt(summary_text or text)
    return Candidate(
        url=item.url, title=title, excerpt=excerpt, content_html=html, content_text=text,
        cover_image_url=cover, published_at=published, author=author,
    )  # fmt: skip


__all__ = ["Candidate", "FetchError", "ListingItem", "ReplayError", "extract_article", "list_items", "parse_feed"]
