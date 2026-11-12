"""FastAPI app: read-only views over what the poller has collected.

The poller runs inside this process by default (POLLER_ENABLED=true), so one
`uvicorn app.main:app` is the whole MVP backend.
"""
from __future__ import annotations

import asyncio
import logging
import os
import time
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import RedirectResponse

from app.config import get_settings
from app.internal_api import router as internal_router
from app.poller import Poller
from app.registration import from_env as registration_from_env
from app.sources import load_watchlist, planned_instagram_calls_per_hour
from app.store import Store

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logging.getLogger("httpx").setLevel(logging.WARNING)  # one line per request drowns the poller log
log = logging.getLogger("discovery")


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    store = Store(settings.mongodb_uri, settings.mongodb_db)
    await store.init()
    sources = load_watchlist(settings)
    # Primary sources added automatically by origin tracing in earlier runs.
    known = {s.id for s in sources}
    sources += [s for s in await store.discovered_sources() if s.id not in known]
    app.state.store = store
    app.state.sources = sources
    app.state.settings = settings
    app.state.poller = None

    task = None
    if os.getenv("POLLER_ENABLED", "true").lower() == "true":
        poller = Poller(settings, store, sources)
        app.state.poller = poller
        task = asyncio.create_task(poller.run_forever())
        log.info("poller started for %d sources", len(poller.sources))
    registration = registration_from_env()
    if registration:
        await registration.start()
    try:
        yield
    finally:
        if registration:
            await registration.stop()
        if task:
            task.cancel()
        if app.state.poller and app.state.poller.stories:
            await app.state.poller.stories.llm.close()
        store.client.close()


app = FastAPI(title="Centoire Discovery Engine", lifespan=lifespan)
app.include_router(internal_router)


@app.get("/", include_in_schema=False)
async def root() -> RedirectResponse:
    return RedirectResponse("/docs")


@app.get("/health")
async def health() -> dict:
    return {"ok": True}


@app.get("/items")
async def items(
    region: str | None = Query(None, description="ISO-2 country code or GLOBAL"),
    role: str | None = Query(None, description="publisher | benchmark | aggregator | community | retailer"),
    include_baseline: bool = False,
    limit: int = Query(100, le=500),
) -> list[dict]:
    return await app.state.store.recent_items(
        region=region, role=role, include_baseline=include_baseline, limit=limit
    )


@app.get("/sources")
async def sources() -> list[dict]:
    """Watchlist plus last poll result for each source."""
    status = {s["_id"]: s for s in await app.state.store.health()}
    poller = app.state.poller
    sources = poller.all_sources if poller else app.state.sources
    return [{**s.model_dump(), "status": status.get(s.id)} for s in sources]


@app.get("/stats")
async def stats() -> dict:
    return await app.state.store.stats()


@app.get("/instagram")
async def instagram_status() -> dict:
    """Whether Instagram is connected, and how the hourly call budget is being used."""
    settings, poller = app.state.settings, app.state.poller
    accounts = [s for s in app.state.sources if s.type == "instagram"]
    ig = poller.instagram if poller else None
    return {
        "configured": bool(ig and ig.configured),
        "accounts": len(accounts),
        "planned_calls_per_hour": round(planned_instagram_calls_per_hour(settings, accounts)),
        "budget_per_hour": settings.ig_max_calls_per_hour,
        "calls_last_hour": ig.calls_last_hour() if ig else 0,
        "paused": bool(ig and time.time() < ig.paused_until),
        "meta_usage_percent": ig.last_usage if ig else {},
    }


@app.get("/instagram/candidates")
async def instagram_candidates(limit: int = Query(50, le=200)) -> list[dict]:
    """Accounts tagged in watched posts that aren't on the watchlist yet: review and add the good ones."""
    watched = {s.handle for s in app.state.sources if s.type == "instagram"}
    return await app.state.store.candidates(watched, limit=limit)


@app.get("/origins")
async def origins(
    status: str | None = Query(None, description="new | watching | pending_instagram | waiting_budget | "
                                                 "not_watchable | rejected"),
    min_publishers: int = Query(1, ge=1),
    limit: int = Query(100, le=500),
) -> list[dict]:
    """Names publishers credit as where their stories came from, most-credited first.
    `watching` ones were added to the watchlist automatically (role `discovered`)."""
    rows = await app.state.store.origin_candidates(statuses=(status,) if status else None)
    rows = [r for r in rows if len(r.get("publishers", [])) >= min_publishers]
    rows.sort(key=lambda r: (len(r.get("publishers", [])), r.get("stories", 0)), reverse=True)
    return [{"id": r.pop("_id"), **{k: v for k, v in r.items() if k != "by"}} for r in rows[:limit]]


@app.post("/origins/{origin_id}/reject")
async def reject_origin(origin_id: str) -> dict:
    """Never add this name (wrong account, not an origin). Doesn't remove an already-added source."""
    if not await app.state.store.origins.find_one({"_id": origin_id}, {"_id": 1}):
        raise HTTPException(404, "unknown origin")
    await app.state.store.set_origin_status(origin_id, "rejected", reason="rejected by a person")
    return {"id": origin_id, "status": "rejected"}


def _story_view(s: dict) -> dict:
    """A story as people read it: who had it first, and how it spread site by site."""
    websites = sorted(s.get("websites", {}).values(), key=lambda w: w["first_at"])
    first = s.get("first") or {}
    return {
        "id": s["_id"],
        "headline": s["headline"],
        "category": s["category"],
        "entities": s.get("entities", []),
        "websites": s.get("website_count", len(websites)),
        "articles": s.get("article_count", 0),
        "first_published": {"website": first.get("name"), "title": first.get("title"),
                            "url": first.get("url"), "at": first.get("at")},
        # Null when every article was already out before the engine watched its source.
        "engine_saw_it_at": s.get("seen_live_at"),
        "spread": [{"website": w["name"], "first_at": w["first_at"], "articles": w["articles"],
                    "title": w["title"], "url": w["url"]} for w in websites],
        # Markets of the feeds that carried it (a Google News India search counts as IN).
        "seen_in_markets": s.get("markets", []),
        "last_at": s.get("last_at"),
    }


@app.get("/stories")
async def stories(
    hours: int = Query(48, ge=1, le=24 * 30, description="stories with an article in the last N hours"),
    min_websites: int = Query(1, ge=1),
    category: str | None = Query(None, description="release | collab | leak | business | runway | "
                                                   "campaign | retail | art | culture"),
    limit: int = Query(100, le=500),
) -> list[dict]:
    """Relevant articles grouped by the event they report, most widely covered first."""
    since = datetime.now(timezone.utc) - timedelta(hours=hours)
    rows = await app.state.store.list_stories(since=since, min_websites=min_websites, category=category,
                                              limit=limit)
    return [_story_view(s) for s in rows]


@app.get("/stories/{story_id}")
async def story(story_id: str) -> dict:
    s = await app.state.store.get_story(story_id)
    if not s:
        raise HTTPException(404, "unknown story")
    articles = await app.state.store.story_articles(story_id)
    articles.sort(key=lambda a: a.get("published_at") or a["first_seen_at"])
    return {**_story_view(s), "all_articles": [
        {"title": a["title"], "url": a["url"], "publisher": a.get("publisher"), "source_id": a["source_id"],
         "published_at": a.get("published_at"), "first_seen_at": a["first_seen_at"],
         "headline_en": (a.get("triage") or {}).get("headline")} for a in articles]}
