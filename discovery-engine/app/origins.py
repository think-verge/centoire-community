"""Origin tracing: find the primary sources that news stories come from, and watch them.

Publishers credit where a story started: "Photos: acgtaiwan, runners_highest",
"Images via Nike", an embedded Instagram post ("A post shared by … (@travisscott)").
Every article we collect is read for those credits. A name credited by several
publishers is a primary source; if we can watch it (an Instagram business account,
a website with a feed) it is added to the watchlist automatically.
"""
from __future__ import annotations

import asyncio
import html
import logging
import re
from collections import Counter
from typing import TYPE_CHECKING
from urllib.parse import urljoin, urlsplit

import feedparser
import httpx

from app.citations import article_body, extract_citations
from app.instagram import InstagramError, InstagramSkipped
from app.models import FetchedItem, Source
from app.sources import planned_instagram_calls_per_hour
from app.urls import site_key

if TYPE_CHECKING:
    from app.poller import Poller

log = logging.getLogger("discovery.origins")

# A name becomes a primary source once this many publishers credited it, or it was
# credited on this many different days (one specialist publisher crediting it again and
# again; days, not stories, so one article in several language editions counts once).
MIN_PUBLISHERS = 2
MIN_DAYS = 3
# A website that is only ever linked (never credited) needs more publishers: articles
# link to shops and brand pages all the time without the story starting there.
MIN_PUBLISHERS_LINK_ONLY = 3
# Names a publisher attaches to most of its articles are its own accounts, not origins.
BOILERPLATE_SHARE = 0.4
BOILERPLATE_MIN_ITEMS = 5
# Articles opened per poll for publishers whose feed has no article text.
MAX_ARTICLES_PER_POLL = 10


def publisher_key(source: Source) -> str:
    """Who is doing the crediting. Editions of one outlet count once (see app.urls.site_key)."""
    if source.type == "instagram":
        return source.id
    return site_key(source.url)


def is_eligible(doc: dict) -> bool:
    publishers = len(doc.get("publishers", []))
    if set(doc.get("kinds", [])) <= {"link"}:
        # Links alone are weak evidence (shops, the outlet's own accounts, share buttons):
        # several outlets must link it, however often one of them does.
        return publishers >= (MIN_PUBLISHERS_LINK_ONLY if doc["platform"] == "website" else MIN_PUBLISHERS)
    return publishers >= MIN_PUBLISHERS or len(doc.get("days", [])) >= MIN_DAYS


def drop_boilerplate(doc: dict, totals: dict[str, int]) -> dict:
    """Remove publishers that attach this name to most of their articles (their own accounts)."""
    by = doc.get("by", {})
    keep = []
    for pub in doc.get("publishers", []):
        total, count = totals.get(pub, 0), by.get(pub.replace(".", "_"), 0)
        if total >= BOILERPLATE_MIN_ITEMS and count / total > BOILERPLATE_SHARE:
            continue
        keep.append(pub)
    return {**doc, "publishers": keep}


class OriginTracker:
    """Reads credits out of new items and records them; promotes primary sources to the watchlist."""

    def __init__(self, poller: "Poller") -> None:
        self.poller = poller
        self.store = poller.store

    # ---------- reading credits ----------

    async def process(self, client: httpx.AsyncClient, source: Source, items: list[FetchedItem]) -> None:
        # Google News and the BoF/WWD benchmarks carry headlines only; nothing to trace.
        if source.role in ("benchmark", "aggregator") or not items:
            return
        if source.fetch_article:
            sem = asyncio.Semaphore(2)

            async def open_article(item: FetchedItem) -> None:
                async with sem:
                    try:
                        resp = await client.get(item.url)
                        resp.raise_for_status()
                    except Exception as exc:
                        log.debug("could not open %s: %s", item.url, exc)
                        return
                    item.extra["citations"] = extract_citations(
                        article_body(resp.text), str(resp.url), urlsplit(source.url).netloc)

            await asyncio.gather(*(open_article(i) for i in items[:MAX_ARTICLES_PER_POLL]))
        pub = publisher_key(source)
        for item in items:
            cites = [c for c in item.extra.get("citations") or []
                     if not (source.type == "reddit" and c["platform"] == "reddit")]
            if item.extra.get("mentions"):  # accounts tagged in a watched Instagram post
                cites += [{"platform": "instagram", "name": m, "kind": "mention",
                           "context": item.title[:160]} for m in item.extra["mentions"]]
            await self.store.record_citations(pub, source, item, cites)

    # ---------- promoting primary sources ----------

    def _watched(self) -> tuple[set[str], set[str]]:
        sources = self.poller.all_sources
        handles = {s.handle for s in sources if s.type == "instagram"}
        hosts = {urlsplit(s.url).netloc.lower().removeprefix("www.") for s in sources if s.type != "instagram"}
        return handles, hosts

    async def promote(self, client: httpx.AsyncClient) -> int:
        """One pass over open candidates; returns how many sources were added."""
        handles, hosts = self._watched()
        totals = await self.store.citing_totals()
        added = 0
        statuses = ("new", "pending_instagram", "waiting_budget")
        for doc in await self.store.origin_candidates(statuses=statuses):
            doc = drop_boilerplate(doc, totals)
            if not is_eligible(doc):
                continue
            platform, name = doc["platform"], doc["name"]
            if (platform == "instagram" and name in handles) or (
                platform == "website" and any(name == h or name.endswith("." + h) for h in hosts)
            ):
                await self.store.set_origin_status(doc["_id"], "watching", reason="already on the watchlist")
            elif platform == "instagram":
                added += await self._promote_instagram(client, doc)
            elif platform == "website":
                added += await self._promote_website(client, doc)
            elif doc["status"] == "new":
                await self.store.set_origin_status(
                    doc["_id"], "not_watchable",
                    reason="a name, not an account: find its Instagram or website by hand" if platform == "name"
                    else f"no {platform} connector yet: review by hand")
        return added

    def _region(self, doc: dict) -> str:
        regions = Counter(doc.get("regions", []))
        regions.pop("GLOBAL", None)
        return regions.most_common(1)[0][0] if regions else "GLOBAL"

    async def _promote_instagram(self, client: httpx.AsyncClient, doc: dict) -> int:
        ig, settings = self.poller.instagram, self.poller.settings
        if self.poller.review:  # an admin decides; the account is watched once Instagram is connected
            source = Source(id=f"ig-{doc['name']}", name=f"@{doc['name']}", type="instagram",
                            url=f"https://www.instagram.com/{doc['name']}/", region=self._region(doc),
                            role="discovered", tier="slow")
            return await self._add(doc, source)
        if not ig.configured:
            if doc["status"] != "pending_instagram":
                await self.store.set_origin_status(doc["_id"], "pending_instagram",
                                                   reason="Instagram not connected yet; added once it is")
            return 0
        per_hour = 3600 / settings.interval_for("instagram", "slow")
        if planned_instagram_calls_per_hour(settings, self.poller.sources) + per_hour > settings.ig_max_calls_per_hour:
            await self.store.set_origin_status(doc["_id"], "waiting_budget", reason="hourly Instagram budget is full")
            return 0
        try:
            await ig.fetch(client, doc["name"])
        except InstagramSkipped:
            return 0  # budget used up or paused; try next round
        except InstagramError as exc:
            if not exc.throttled:
                await self.store.set_origin_status(
                    doc["_id"], "not_watchable", reason=f"not a readable business/creator account ({exc})")
            return 0
        source = Source(id=f"ig-{doc['name']}", name=f"@{doc['name']}", type="instagram",
                        url=f"https://www.instagram.com/{doc['name']}/", region=self._region(doc),
                        role="discovered", tier="slow")
        return await self._add(doc, source)

    async def _promote_website(self, client: httpx.AsyncClient, doc: dict) -> int:
        feed = await find_feed(client, doc["name"])
        if not feed:
            await self.store.set_origin_status(doc["_id"], "not_watchable", reason="no RSS/Atom feed found")
            return 0
        sid = "site-" + re.sub(r"[^a-z0-9]+", "-", doc["name"]).strip("-")
        source = Source(id=sid, name=doc["name"], type="rss", url=feed, region=self._region(doc),
                        role="discovered", tier="slow")
        return await self._add(doc, source)

    async def _add(self, doc: dict, source: Source) -> int:
        if self.poller.review:
            # With the Centoire app connected, an admin approves new sources on its Sources page.
            lines = [f'{c["publisher"]}: "{c["context"][:120]}" in "{c["title"][:80]}"'
                     for c in doc.get("citations", [])[-6:]]
            reason = (f"Credited as a story's origin by {len(doc['publishers'])} publishers "
                      f"({', '.join(doc['publishers'][:5])})")
            await self.poller.review.suggest_origin(source, reason, lines)
            await self.store.set_origin_status(doc["_id"], "suggested", reason="sent to the app for an admin")
            return 0
        await self.store.add_discovered_source(source, origin_id=doc["_id"])
        await self.store.set_origin_status(doc["_id"], "watching", reason=f"added as {source.id}")
        self.poller.add_source(source)
        log.info("discovered primary source %s (credited by %s)", source.id, ", ".join(doc["publishers"]))
        return 1


async def find_feed(client: httpx.AsyncClient, host: str) -> str | None:
    """A site's RSS/Atom feed: advertised on its homepage, or a Shopify/WordPress default."""
    for base in (f"https://{host}/", f"https://www.{host}/"):
        try:
            resp = await client.get(base)
            resp.raise_for_status()
        except Exception:
            continue
        candidates = [urljoin(str(resp.url), p) for p in ("blogs/news.atom", "feed/", "rss")]
        for tag in re.findall(r"<link\b[^>]+>", resp.text, re.I):
            if re.search(r"""type=["']application/(?:rss|atom)\+xml["']""", tag, re.I):
                if m := re.search(r"""href=["']([^"']+)["']""", tag, re.I):
                    candidates = [urljoin(str(resp.url), html.unescape(m.group(1)))]
                    break
        for url in candidates:
            try:
                r = await client.get(url)
                if r.status_code == 200 and feedparser.parse(r.content).entries:
                    return str(r.url)
            except Exception:
                continue
        return None
    return None
