"""The queue the Centoire backend pulls: /internal/discovery-engine/*.

Every route needs the `x-internal-secret` header (ENGINE_INTERNAL_SECRET). The gateway reaches
this router through the route the engine announces in app.registration.
"""
from __future__ import annotations

import hmac
import logging
import os
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from pydantic import BaseModel

from app.stories import _utc

log = logging.getLogger("discovery.internal")

PREFIX = "/internal/discovery-engine"
EPOCH = datetime(1970, 1, 1, tzinfo=timezone.utc)


def require_secret(x_internal_secret: str | None = Header(None)) -> None:
    expected = os.getenv("ENGINE_INTERNAL_SECRET", "dev-internal-secret")
    if not x_internal_secret or not hmac.compare_digest(x_internal_secret.encode(), expected.encode()):
        raise HTTPException(401, "invalid or missing x-internal-secret")


router = APIRouter(prefix=PREFIX, dependencies=[Depends(require_secret)])


def _parse_since(value: str | None) -> datetime:
    if not value:
        return EPOCH
    try:
        return _utc(datetime.fromisoformat(value.replace("Z", "+00:00")))
    except ValueError:
        raise HTTPException(422, "since must be an ISO datetime")


@router.get("/health")
async def health() -> dict:
    return {"ok": True}


@router.get("/queue")
async def queue(request: Request, since: str | None = Query(None),
                limit: int = Query(100, ge=1, le=200)) -> dict:
    since_dt = _parse_since(since)
    rows = await request.app.state.store.queued_stories(since_dt, limit)
    items = []
    for row in rows:
        review = row.get("review") or {}
        if review.get("status") not in (None, "pending_review") or not review.get("payload"):
            continue  # decided by an editor: not queued any more
        items.append({"storyId": row["_id"], "queuedAt": _utc(review["queued_at"]).isoformat(),
                      "payload": review["payload"]})
    items.sort(key=lambda i: i["queuedAt"])
    items = items[:limit]
    return {"items": items, "nextSince": items[-1]["queuedAt"] if items else (since or EPOCH.isoformat())}


class FetchBody(BaseModel):
    sourceId: str | None = None


@router.post("/fetch")
async def fetch(request: Request, body: FetchBody | None = None) -> dict:
    """Poll one source (or all), then one story pass and one queue-preparation pass."""
    source_id = body.sourceId if body else None
    poller = request.app.state.poller
    sources = list(poller.all_sources) if poller else []
    if source_id is not None:
        sources = [s for s in sources if s.id == f"app-{source_id}"]
        if not sources:
            raise HTTPException(404, "unknown source")
    polled = new_items = queued = 0
    if poller:
        live = [s for s in sources if s in poller.sources]
        client = poller.http_client()
        own = client is None
        if own:
            client = poller._client()
        try:
            for s in live:
                new_items += await poller.poll_once(client, s)
                polled += 1
        finally:
            if own:
                await client.aclose()
        if poller.stories:
            try:
                await poller.stories.run_pass()
            except Exception:
                log.exception("fetch: story pass failed")
        if poller.review:
            try:
                queued = await poller.review.prepare_stories()
            except Exception:
                log.exception("fetch: queue preparation failed")
    return {"polled": polled, "newItems": new_items, "queued": queued}
