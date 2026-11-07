"""Data shapes: watchlist sources and the items fetched from them."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

SourceType = Literal["rss", "reddit", "shopify", "instagram", "sitemap", "page"]
SourceRole = Literal[
    "publisher", "benchmark", "aggregator", "community", "retailer",
    "brand", "insider", "collaborator",
    "discovered",  # added automatically: publishers credited it as a story's origin (app.origins)
]
Tier = Literal["fast", "normal", "slow"]


class Source(BaseModel):
    id: str
    name: str
    type: SourceType
    url: str
    region: str  # ISO-3166 alpha-2, or GLOBAL
    role: SourceRole
    tier: Tier = "normal"
    # Per-item region override keyed on the item's feed category (e.g. subreddit name).
    region_by_tag: dict[str, str] = Field(default_factory=dict)
    # Regexes (case-insensitive); items whose title matches any of them are dropped.
    exclude_title: list[str] = Field(default_factory=list)
    # Sitemap / page sources: regexes (case-insensitive); only matching URLs are watched.
    include_url: list[str] = Field(default_factory=list)
    # Sitemap / page sources: open each new URL to read its real title, image and date.
    enrich: bool = True
    # Publishers whose feed has no article text: open new articles to read their credits.
    fetch_article: bool = False
    # Poll interval in seconds, overriding the tier (for very large sitemaps).
    interval: int | None = None

    @property
    def handle(self) -> str:
        """Account name for social sources, taken from the profile URL."""
        return self.url.rstrip("/").rsplit("/", 1)[-1].lstrip("@").lower()

    def regions_for(self, tag: str | None) -> list[str]:
        # Case-insensitive: Reddit reports r/IndianStreetwear as "IndianStreetWear".
        lookup = {k.lower(): v for k, v in self.region_by_tag.items()}
        return [lookup.get((tag or "").lower(), self.region)]


class FetchedItem(BaseModel):
    """One item as a fetcher returns it, before storage adds first-seen bookkeeping."""

    url: str
    title: str
    summary: str = ""
    image_url: str | None = None
    published_at: datetime | None = None
    # Google News wraps other publishers; this is the original outlet when known.
    publisher: str | None = None
    extra: dict = Field(default_factory=dict)


class Item(FetchedItem):
    """Stored item. `first_seen_at` is the clock that lead-time claims are built on."""

    key: str  # dedupe key (hash of canonical URL, or of publisher + title)
    source_id: str
    source_role: SourceRole
    regions: list[str]
    first_seen_at: datetime
    # True when the item was already in the feed on the source's first poll,
    # so its first_seen_at says nothing about how early we were.
    baseline: bool = False
    # Like/comment snapshots over time (social sources), for engagement velocity.
    engagement: list[dict] = Field(default_factory=list)
