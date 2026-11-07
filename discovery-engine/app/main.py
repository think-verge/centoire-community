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

from fastapi import FastAPI, HTTPException, Query
from fastapi.responses import RedirectResponse

from app.config import get_settings
from app.poller import Poller
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
    try:
        yield
    finally:
        if task:
            task.cancel()
        store.client.close()


app = FastAPI(title="Centoire Discovery Engine", lifespan=lifespan)


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
