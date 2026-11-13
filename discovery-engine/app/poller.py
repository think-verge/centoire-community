"""Poller: one asyncio loop per source, on the interval of its tier.

Reddit sources share a lock and a minimum gap between requests, because Reddit
answers 429 to unauthenticated clients that poll several subreddits at once.
Instagram sources share one call budget (see app.instagram) and only start once
IG_USER_ID and IG_ACCESS_TOKEN are set. Brand sitemaps and pages are diffed
against every URL they have listed before (see app.sites). New items are read for
the sources they credit, and credited primary sources are added as they qualify
(see app.origins). Every new article is triaged and grouped into stories by Gemini
(see app.stories) once GEMINI_API_KEY is set.
"""
from __future__ import annotations

import asyncio
import logging
import random
import time

import httpx

from app.config import Settings
from app.fetchers import NotModified, fetch
from app.gemini import Gemini
from app.instagram import InstagramClient, InstagramSkipped
from app.models import FetchedItem, Source
from app.origins import OriginTracker
from app.review import CentoireApp, ReviewBridge
from app.sites import SiteWatcher
from app.sources import ItemFilter, load_blocked_publishers, planned_instagram_calls_per_hour
from app.stories import StoryBuilder
from app.store import Store

log = logging.getLogger("discovery.poller")

# After this many failures in a row, a social account is retried only every few hours,
# so a misspelt handle or a personal (non-business) account doesn't burn the call budget.
ERROR_BACKOFF_AFTER = 3
ERROR_BACKOFF_SECONDS = 6 * 3600
# How often credited origins are checked and, if they qualify, added to the watchlist.
PROMOTE_EVERY_SECONDS = 1800
# How often new articles are triaged and grouped into stories.
STORIES_EVERY_SECONDS = 60


class Poller:
    def __init__(self, settings: Settings, store: Store, sources: list[Source]) -> None:
        self.settings = settings
        self.store = store
        self.all_sources = list(sources)  # including Instagram accounts waiting for credentials
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
        self.origins = OriginTracker(self)
        self.stories: StoryBuilder | None = None
        if settings.stories_enabled and settings.gemini_api_key:
            llm = Gemini(settings.gemini_api_key, text_model=settings.story_triage_model,
                         embed_model=settings.embed_model)
            self.stories = StoryBuilder(store, llm, self.all_sources, triage_model=settings.story_triage_model,
                                        match_model=settings.story_match_model)
        else:
            log.warning("stories off: set GEMINI_API_KEY to triage and group articles")
        self.review: ReviewBridge | None = None
        if settings.centoire_api_url and settings.centoire_discovery_secret:
            self.review = ReviewBridge(self, CentoireApp(settings.centoire_api_url,
                                                         settings.centoire_discovery_secret),
                                       llm=self.stories.llm if self.stories else None)
        else:
            log.warning("review queue off: set CENTOIRE_API_URL and CENTOIRE_DISCOVERY_SECRET")
        self._client_live: httpx.AsyncClient | None = None
        self._tasks: dict[str, asyncio.Task] = {}

    def add_source(self, source: Source) -> None:
        """Start watching a source while running (used for discovered primary sources)."""
        if any(s.id == source.id for s in self.all_sources):
            return
        self.all_sources.append(source)
        if self.stories:
            self.stories.add_source(source)
        if source.type == "instagram" and not self.instagram.configured:
            return
        self.sources.append(source)
        self._http_cache[source.id] = {}
        self._errors[source.id] = 0
        if self._client_live:
            self._tasks[source.id] = asyncio.create_task(self._loop(self._client_live, source))

    def remove_source(self, source_id: str) -> None:
        """Stop watching a source (paused or removed in the app). Its items stay."""
        self.all_sources = [s for s in self.all_sources if s.id != source_id]
        self.sources = [s for s in self.sources if s.id != source_id]
        if task := self._tasks.pop(source_id, None):
            task.cancel()

    def http_client(self) -> httpx.AsyncClient | None:
        """The shared HTTP client while the poller runs (None before it starts)."""
        return self._client_live

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

    async def poll_once(self, client: httpx.AsyncClient, source: Source) -> int:
        """Poll one source; returns how many new items it saved."""
        # Items present on a source's very first successful poll were published before
        # we started watching, so they are flagged as baseline and never count as "early".
        baseline = not await self.store.has_polled(source.id)
        try:
            items = await self._fetch(client, source)
        except InstagramSkipped:
            return 0
        except NotModified:
            self._errors[source.id] = 0
            await self.store.record_poll(source, ok=True)
            return 0
        except Exception as exc:  # network, HTTP status, parse, API errors: log and retry later
            self._errors[source.id] += 1
            msg = f"{type(exc).__name__}: {exc}"[:300]
            log.warning("poll failed %s: %s", source.id, msg)
            await self.store.record_poll(source, ok=False, error=msg)
            return 0

        self._errors[source.id] = 0
        items = [i for i in items if self._filter.keep(source, i)]
        new = await self.store.save_items(source, items, baseline=baseline)
        await self.store.record_poll(source, ok=True, fetched=len(items), new=len(new))
        if new:
            log.info("%-24s +%d new%s", source.id, len(new), " (baseline)" if baseline else "")
            # Credits count even on the first poll: a story's origin doesn't depend on when we started.
            try:
                await self.origins.process(client, source, new)
            except Exception:
                log.exception("origin tracing failed for %s", source.id)
        return len(new)

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

    async def _promote_loop(self, client: httpx.AsyncClient) -> None:
        await asyncio.sleep(120)  # let the first round of polls record some credits
        while True:
            try:
                added = await self.origins.promote(client)
                if added:
                    log.info("origin tracing added %d primary sources", added)
            except Exception:
                log.exception("origin promotion failed")
            await asyncio.sleep(PROMOTE_EVERY_SECONDS)

    async def _stories_loop(self) -> None:
        while True:
            try:
                done = await self.stories.run_pass()
                if done:
                    log.info("stories: triaged and grouped %d articles", done)
            except Exception:
                log.exception("story grouping failed")
            await asyncio.sleep(STORIES_EVERY_SECONDS)

    async def run_forever(self) -> None:
        async with self._client() as client:
            self._client_live = client
            for s in list(self.sources):
                self._tasks[s.id] = asyncio.create_task(self._loop(client, s))
            loops = [self._promote_loop(client)]
            if self.stories:
                loops.append(self._stories_loop())
            if self.review:
                loops.append(self.review.run(client))
            try:
                await asyncio.gather(*loops)
            finally:
                for task in self._tasks.values():
                    task.cancel()

    async def run_round(self) -> None:
        """Poll every source once (for testing and `--once`)."""
        async with self._client() as client:
            await asyncio.gather(*(self.poll_once(client, s) for s in self.sources))
