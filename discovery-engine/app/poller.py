"""Poller: one asyncio loop per source, on the interval of its tier.

Reddit sources share a lock and a minimum gap between requests, because Reddit
answers 429 to unauthenticated clients that poll several subreddits at once.
Instagram sources share one call budget (see app.instagram) and only start once
IG_USER_ID and IG_ACCESS_TOKEN are set. Brand sitemaps and pages are diffed
against every URL they have listed before (see app.sites).
"""
from __future__ import annotations

import asyncio
import logging
import random
import time

import httpx

from app.config import Settings
from app.fetchers import NotModified, fetch
from app.instagram import InstagramClient, InstagramSkipped
from app.models import FetchedItem, Source
from app.sites import SiteWatcher
from app.sources import ItemFilter, load_blocked_publishers, planned_instagram_calls_per_hour
from app.store import Store

log = logging.getLogger("discovery.poller")

# After this many failures in a row, a social account is retried only every few hours,
# so a misspelt handle or a personal (non-business) account doesn't burn the call budget.
ERROR_BACKOFF_AFTER = 3
ERROR_BACKOFF_SECONDS = 6 * 3600


class Poller:
    def __init__(self, settings: Settings, store: Store, sources: list[Source]) -> None:
        self.settings = settings
        self.store = store
        self.instagram = InstagramClient(settings)
        if not self.instagram.configured:
            skipped = sum(1 for s in sources if s.type == "instagram")
            if skipped:
                log.warning("Instagram not configured (IG_USER_ID / IG_ACCESS_TOKEN): "
                            "skipping %d accounts", skipped)
            sources = [s for s in sources if s.type != "instagram"]
        else:
            planned = planned_instagram_calls_per_hour(settings, sources)
            log.info("Instagram: %.0f planned calls/hour (budget %d)",
                     planned, settings.ig_max_calls_per_hour)
            if planned > settings.ig_max_calls_per_hour:
                log.warning("Instagram watchlist exceeds the hourly budget; some polls will be "
                            "skipped. Move accounts to slower tiers in instagram.yaml.")
        self.sources = sources
        self._http_cache: dict[str, dict[str, str]] = {s.id: {} for s in sources}
        self._errors: dict[str, int] = {s.id: 0 for s in sources}
        self._reddit_lock = asyncio.Lock()
        self._reddit_last = 0.0
        self._filter = ItemFilter(load_blocked_publishers(settings.sources_file))
        self.sites = SiteWatcher(store)

    def _interval(self, source: Source) -> int:
        return source.interval or self.settings.interval_for(source.type, source.tier)

    async def _fetch(self, client: httpx.AsyncClient, source: Source) -> list[FetchedItem]:
        if source.type == "instagram":
            return await self.instagram.fetch(client, source.handle)
        if source.type in ("sitemap", "page"):
            return await self.sites.fetch(client, source, self._http_cache[source.id])
        if source.type == "reddit":
            async with self._reddit_lock:
                wait = self.settings.reddit_gap_seconds - (time.monotonic() - self._reddit_last)
                if wait > 0:
                    await asyncio.sleep(wait)
                try:
                    return await fetch(client, source, self._http_cache[source.id])
                finally:
                    self._reddit_last = time.monotonic()
        return await fetch(client, source, self._http_cache[source.id])

    async def poll_once(self, client: httpx.AsyncClient, source: Source) -> None:
        # Items present on a source's very first successful poll were published before
        # we started watching, so they are flagged as baseline and never count as "early".
        baseline = not await self.store.has_polled(source.id)
        try:
            items = await self._fetch(client, source)
        except InstagramSkipped:
            return
        except NotModified:
            self._errors[source.id] = 0
            await self.store.record_poll(source, ok=True)
            return
        except Exception as exc:  # network, HTTP status, parse, API errors: log and retry later
            self._errors[source.id] += 1
            msg = f"{type(exc).__name__}: {exc}"[:300]
            log.warning("poll failed %s: %s", source.id, msg)
            await self.store.record_poll(source, ok=False, error=msg)
            return

        self._errors[source.id] = 0
        items = [i for i in items if self._filter.keep(source, i)]
        new = await self.store.save_items(source, items, baseline=baseline)
        await self.store.record_poll(source, ok=True, fetched=len(items), new=new)
        if new:
            log.info("%-24s +%d new%s", source.id, new, " (baseline)" if baseline else "")

    def _next_wait(self, source: Source) -> float:
        interval = self._interval(source)
        if source.type == "instagram" and self._errors[source.id] >= ERROR_BACKOFF_AFTER:
            return ERROR_BACKOFF_SECONDS
        return interval + random.uniform(-0.1, 0.1) * interval

    async def _loop(self, client: httpx.AsyncClient, source: Source) -> None:
        interval = self._interval(source)
        # Spread the first round out so we don't hit every host (or the IG budget) at once.
        spread = 300 if source.type == "instagram" else min(20, interval / 4)
        await asyncio.sleep(random.uniform(0, spread))
        while True:
            started = time.monotonic()
            await self.poll_once(client, source)
            await asyncio.sleep(max(5.0, self._next_wait(source) - (time.monotonic() - started)))

    def _client(self) -> httpx.AsyncClient:
        return httpx.AsyncClient(
            timeout=self.settings.request_timeout,
            follow_redirects=True,
            headers={"User-Agent": self.settings.user_agent},
            limits=httpx.Limits(max_connections=20),
        )

    async def run_forever(self) -> None:
        async with self._client() as client:
            await asyncio.gather(*(self._loop(client, s) for s in self.sources))

    async def run_round(self) -> None:
        """Poll every source once (for testing and `--once`)."""
        async with self._client() as client:
            await asyncio.gather(*(self.poll_once(client, s) for s in self.sources))
